require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const csv = require('./src/csv');
const config = require('./src/config');
const jobRunner = require('./server/jobRunner');

const app = express();
const PORT = process.env.PORT || 5000;
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || '';

const DATA = file => path.join(config.DATA_DIR, file);
const UPLOADS_DIR = path.join(config.DATA_DIR, 'uploads');

const HEADERS = {
  senders: ['sender_email', 'display_name', 'profile_dir', 'enabled'],
  templates: ['template_key', 'body'],
  subjects: ['subject_id', 'subject'],
  schedule: [
    'queue_id', 'sender_email', 'recipient_email', 'subject', 'template_key',
    'scheduled_at', 'category', 'company_name', 'website', 'day_name',
    'per_sender_sequence', 'notes',
  ],
  failed: [
    'queue_id', 'sender_email', 'recipient_email', 'subject', 'scheduled_at',
    'error_code', 'error_message', 'failed_at', 'screenshot_path',
  ],
};

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));

// ---------------------------------------------------------------------------
// Auth: if DASHBOARD_TOKEN is set, every /api request must carry it.
// Header "x-dashboard-token", "Authorization: Bearer <token>", or ?token=
// (query form is needed for <img> screenshot links).
// ---------------------------------------------------------------------------
app.use('/api', (req, res, next) => {
  if (!DASHBOARD_TOKEN) return next();
  const header = req.headers['x-dashboard-token'];
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const query = req.query.token;
  if (header === DASHBOARD_TOKEN || bearer === DASHBOARD_TOKEN || query === DASHBOARD_TOKEN) {
    return next();
  }
  res.status(401).json({ error: 'Invalid or missing dashboard token' });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}_${safe}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const wrap = fn => (req, res) => {
  try {
    const out = fn(req, res);
    if (out && typeof out.catch === 'function') {
      out.catch(err => res.status(500).json({ error: err.message }));
    }
  } catch (err) {
    const status = err.code === 'JOB_BUSY' ? 409 : 500;
    res.status(status).json({ error: err.message });
  }
};

// ---------------------------------------------------------------------------
// Health & stats
// ---------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), authRequired: !!DASHBOARD_TOKEN });
});

app.get('/api/stats', wrap((req, res) => {
  const senders = csv.readCsv(DATA('sender_accounts.csv'));
  const schedule = csv.readCsv(DATA('schedule_tracker.csv'));
  const templates = csv.readCsv(DATA('templates.csv'));
  const subjects = csv.readCsv(DATA('subject_pool.csv'));
  const scheduled = csv.readCsv(DATA('scheduled_results.csv'));
  const failed = csv.readCsv(DATA('failed_results.csv'));

  const doneIds = new Set(scheduled.map(r => r.queue_id));
  const pending = schedule.filter(r => !doneIds.has(r.queue_id));

  const perSenderPending = {};
  pending.forEach(r => {
    perSenderPending[r.sender_email] = (perSenderPending[r.sender_email] || 0) + 1;
  });

  res.json({
    senders_total: senders.length,
    senders_enabled: senders.filter(s => s.enabled === 'true').length,
    schedule_total: schedule.length,
    schedule_pending: pending.length,
    scheduled_success: scheduled.length,
    failed_total: failed.length,
    templates_total: templates.length,
    subjects_total: subjects.length,
    per_sender_pending: perSenderPending,
  });
}));

// ---------------------------------------------------------------------------
// CSV data: senders / templates / subjects (read + replace whole file)
// ---------------------------------------------------------------------------
function csvResource(route, file, headers) {
  app.get(`/api/${route}`, wrap((req, res) => {
    res.json(csv.readCsv(DATA(file)));
  }));
  app.put(`/api/${route}`, wrap((req, res) => {
    const rows = req.body.rows;
    if (!Array.isArray(rows)) return res.status(400).json({ error: 'Body must be { rows: [...] }' });
    backupFile(DATA(file));
    csv.writeCsv(DATA(file), rows, headers);
    res.json({ ok: true, count: rows.length });
  }));
}

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const backupDir = path.join(config.DATA_DIR, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(filePath, path.join(backupDir, `${stamp}_${path.basename(filePath)}`));
}

csvResource('senders', 'sender_accounts.csv', HEADERS.senders);
csvResource('templates', 'templates.csv', HEADERS.templates);
csvResource('subjects', 'subject_pool.csv', HEADERS.subjects);

// ---------------------------------------------------------------------------
// Schedule tracker (joined with results status)
// ---------------------------------------------------------------------------
app.get('/api/schedule', wrap((req, res) => {
  const rows = csv.readCsv(DATA('schedule_tracker.csv'));
  const scheduled = new Set(csv.readCsv(DATA('scheduled_results.csv')).map(r => r.queue_id));
  const failedRows = csv.readCsv(DATA('failed_results.csv'));
  const failed = new Map(failedRows.map(r => [r.queue_id, r.error_code]));

  res.json(rows.map(r => ({
    ...r,
    status: scheduled.has(r.queue_id) ? 'SCHEDULED'
      : failed.has(r.queue_id) ? 'FAILED'
      : 'PENDING',
    error_code: failed.get(r.queue_id) || '',
  })));
}));

app.put('/api/schedule', wrap((req, res) => {
  const rows = req.body.rows;
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'Body must be { rows: [...] }' });
  backupFile(DATA('schedule_tracker.csv'));
  csv.writeCsv(DATA('schedule_tracker.csv'), rows, HEADERS.schedule);
  res.json({ ok: true, count: rows.length });
}));

// Append a single new email row; queue_id is generated server-side.
app.post('/api/schedule/rows', wrap((req, res) => {
  const { sender_email, recipient_email, subject, template_key, scheduled_at, category, company_name, website, notes } = req.body || {};

  const senders = csv.readCsv(DATA('sender_accounts.csv'));
  const sender = senders.find(s => s.sender_email === sender_email && s.enabled === 'true');
  if (!sender) return res.status(400).json({ error: `Sender tidak ditemukan / tidak aktif: ${sender_email}` });

  if (!recipient_email || !recipient_email.includes('@')) {
    return res.status(400).json({ error: `recipient_email tidak valid: ${recipient_email}` });
  }

  const templates = csv.readCsv(DATA('templates.csv'));
  if (!templates.find(t => t.template_key === template_key)) {
    return res.status(400).json({ error: `Template tidak ditemukan: ${template_key}` });
  }

  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(scheduled_at || '')) {
    return res.status(400).json({ error: `Format scheduled_at harus YYYY-MM-DD HH:mm, dapat: ${scheduled_at}` });
  }

  const rows = csv.readCsv(DATA('schedule_tracker.csv'));
  const datePart = scheduled_at.slice(0, 10).replace(/-/g, '');
  const existingIds = new Set(rows.map(r => r.queue_id));
  let seq = rows.length + 1;
  let queueId;
  do {
    queueId = `Q-${datePart}-${String(seq).padStart(6, '0')}`;
    seq += 1;
  } while (existingIds.has(queueId));

  const dayName = new Date(scheduled_at.replace(' ', 'T')).toLocaleDateString('en-US', { weekday: 'long' });
  const perSenderSeq = rows.filter(r => r.sender_email === sender_email).length + 1;

  const newRow = {
    queue_id: queueId,
    sender_email,
    recipient_email,
    subject: subject || '',
    template_key,
    scheduled_at,
    category: category || '',
    company_name: company_name || '',
    website: website || '',
    day_name: dayName,
    per_sender_sequence: String(perSenderSeq),
    notes: notes || '',
  };

  csv.appendCsv(DATA('schedule_tracker.csv'), newRow, HEADERS.schedule);
  res.json({ ok: true, row: newRow });
}));

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
app.get('/api/results/scheduled', wrap((req, res) => {
  res.json(csv.readCsv(DATA('scheduled_results.csv')));
}));

app.get('/api/results/failed', wrap((req, res) => {
  res.json(csv.readCsv(DATA('failed_results.csv')));
}));

// Clear the failed-results log (a backup copy is kept in data/backups).
app.delete('/api/results/failed', wrap((req, res) => {
  backupFile(DATA('failed_results.csv'));
  csv.writeCsv(DATA('failed_results.csv'), [], HEADERS.failed);
  res.json({ ok: true });
}));

app.get('/api/screenshots/:name', (req, res) => {
  const name = path.basename(req.params.name); // no path traversal
  const file = path.join(config.SCREENSHOT_DIR, name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Screenshot not found' });
  res.sendFile(file);
});

// ---------------------------------------------------------------------------
// Downloadable CSV template for bulk upload. Uses the team's real sender
// accounts and template keys so the example rows are instantly valid.
// ---------------------------------------------------------------------------
app.get('/api/schedule/template', wrap((req, res) => {
  const senders = csv.readCsv(DATA('sender_accounts.csv')).filter(s => s.enabled === 'true');
  const templates = csv.readCsv(DATA('templates.csv'));
  const sender1 = senders[0]?.sender_email || 'akun-pengirim@gmail.com';
  const sender2 = senders[1]?.sender_email || sender1;
  const tplKey = templates[0]?.template_key || 'T1';

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dateStr = tomorrow.toISOString().slice(0, 10);

  const exampleRows = [
    {
      queue_id: '', // kosongkan - dibuat otomatis oleh sistem
      sender_email: sender1,
      recipient_email: 'tujuan1@contoh.com',
      subject: '',
      template_key: tplKey,
      scheduled_at: `${dateStr} 21:00`,
      category: '', company_name: '', website: '', day_name: '', per_sender_sequence: '', notes: '',
    },
    {
      queue_id: '',
      sender_email: sender2,
      recipient_email: 'tujuan2@contoh.com',
      subject: 'subject khusus (opsional, kosong = otomatis dari pool)',
      template_key: tplKey,
      scheduled_at: `${dateStr} 21:07`,
      category: '', company_name: '', website: '', day_name: '', per_sender_sequence: '', notes: '',
    },
  ];

  const { stringify } = require('csv-stringify/sync');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="template_jadwal_email.csv"');
  res.send(stringify(exampleRows, { header: true, columns: HEADERS.schedule }));
}));

// ---------------------------------------------------------------------------
// Upload: .xlsx is saved (then converted via job), .csv replaces the tracker.
// Uploaded CSVs are normalized: queue_id / day_name / per_sender_sequence
// may be left blank and are generated here, and required fields are
// validated before anything is written.
// ---------------------------------------------------------------------------
app.post('/api/upload', upload.single('file'), wrap((req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: file)' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const savedPath = req.file.path;

  if (ext === '.csv' && req.body.target === 'schedule') {
    const uploaded = csv.readCsv(savedPath);
    if (uploaded.length === 0) {
      return res.status(400).json({ error: 'CSV kosong atau header tidak terbaca. Gunakan template dari tombol Download Template.' });
    }

    const senders = new Set(
      csv.readCsv(DATA('sender_accounts.csv')).filter(s => s.enabled === 'true').map(s => s.sender_email)
    );
    const templateKeys = new Set(csv.readCsv(DATA('templates.csv')).map(t => t.template_key));

    const errors = [];
    const seenIds = new Set();
    const perSenderCount = {};
    const normalized = uploaded.map((row, i) => {
      const line = i + 2; // +1 header, +1 zero-index
      const senderEmail = (row.sender_email || '').trim();
      const recipient = (row.recipient_email || '').trim();
      const tplKey = (row.template_key || '').trim();
      const schedAt = (row.scheduled_at || '').trim();

      if (!senders.has(senderEmail)) errors.push(`Baris ${line}: sender_email "${senderEmail}" tidak terdaftar/tidak aktif`);
      if (!recipient.includes('@')) errors.push(`Baris ${line}: recipient_email "${recipient}" tidak valid`);
      if (!templateKeys.has(tplKey)) errors.push(`Baris ${line}: template_key "${tplKey}" tidak ditemukan`);
      if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(schedAt)) errors.push(`Baris ${line}: scheduled_at "${schedAt}" harus format YYYY-MM-DD HH:mm`);

      // Auto-generate queue_id when blank
      let queueId = (row.queue_id || '').trim();
      if (!queueId && /^\d{4}-\d{2}-\d{2}/.test(schedAt)) {
        const datePart = schedAt.slice(0, 10).replace(/-/g, '');
        let seq = i + 1;
        do {
          queueId = `Q-${datePart}-${String(seq).padStart(6, '0')}`;
          seq += 1;
        } while (seenIds.has(queueId));
      }
      if (seenIds.has(queueId)) errors.push(`Baris ${line}: queue_id "${queueId}" duplikat`);
      seenIds.add(queueId);

      perSenderCount[senderEmail] = (perSenderCount[senderEmail] || 0) + 1;
      const dayName = /^\d{4}-\d{2}-\d{2}/.test(schedAt)
        ? new Date(schedAt.replace(' ', 'T')).toLocaleDateString('en-US', { weekday: 'long' })
        : '';

      return {
        queue_id: queueId,
        sender_email: senderEmail,
        recipient_email: recipient,
        subject: row.subject || '',
        template_key: tplKey,
        scheduled_at: schedAt,
        category: row.category || '',
        company_name: row.company_name || '',
        website: row.website || '',
        day_name: row.day_name || dayName,
        per_sender_sequence: row.per_sender_sequence || String(perSenderCount[senderEmail]),
        notes: row.notes || '',
      };
    });

    if (errors.length > 0) {
      return res.status(400).json({
        error: `Upload ditolak - ${errors.length} masalah ditemukan:\n` + errors.slice(0, 10).join('\n') +
          (errors.length > 10 ? `\n…dan ${errors.length - 10} lainnya` : ''),
      });
    }

    backupFile(DATA('schedule_tracker.csv'));
    csv.writeCsv(DATA('schedule_tracker.csv'), normalized, HEADERS.schedule);
    return res.json({ ok: true, applied: 'schedule_tracker.csv', count: normalized.length });
  }

  res.json({ ok: true, applied: null, path: savedPath, ext });
}));

// ---------------------------------------------------------------------------
// Jobs (run the existing CLI scripts as background processes)
// ---------------------------------------------------------------------------
app.post('/api/jobs/schedule', wrap((req, res) => {
  const { dryRun, limit, limitPerSender, force } = req.body || {};
  const args = [];
  if (dryRun) args.push('--dry-run');
  if (limit) args.push(`--limit=${parseInt(limit, 10)}`);
  if (limitPerSender) args.push(`--limit-per-sender=${parseInt(limitPerSender, 10)}`);
  if (force) args.push('--force');
  const label = dryRun ? 'Dry run' : `Schedule run${limit ? ` (limit ${limit})` : ''}${limitPerSender ? ` (per sender ${limitPerSender})` : ''}`;
  res.json(jobRunner.startJob('schedule', 'src/scheduleNative.js', args, label));
}));

app.post('/api/jobs/validate', wrap((req, res) => {
  res.json(jobRunner.startJob('validate', 'scripts/validateSchedule.js', [], 'Validate schedule'));
}));

app.post('/api/jobs/convert', wrap((req, res) => {
  const { input, startDate, startTime, gapMinutes } = req.body || {};
  if (!input) return res.status(400).json({ error: 'input file path is required' });
  // Only allow files inside the data directory.
  const resolved = path.resolve(input);
  if (!resolved.startsWith(config.DATA_DIR)) {
    return res.status(400).json({ error: 'input must be inside the data directory' });
  }
  const output = path.join(config.DATA_DIR, 'schedule_tracker.csv');
  const args = [`--input=${resolved}`, `--output=${output}`];
  if (startDate) args.push(`--start-date=${startDate}`);
  args.push(`--start-time=${startTime || '21:00'}`);
  args.push(`--gap-minutes=${gapMinutes || 7}`);
  res.json(jobRunner.startJob('convert', 'scripts/excelToScheduleCsv.js', args, 'Convert Excel to schedule CSV'));
}));

app.post('/api/jobs/login', wrap((req, res) => {
  const { sender, minutes } = req.body || {};
  const args = [];
  if (sender) args.push(`--sender=${sender}`);
  args.push(`--minutes=${minutes || 10}`);
  const label = `Login window${sender ? `: ${sender}` : ' (all senders)'}`;
  res.json(jobRunner.startJob('login', 'src/loginProfiles.js', args, label));
}));

app.get('/api/jobs', (req, res) => res.json(jobRunner.listJobs()));

// Clear job history + log files (running jobs are kept).
app.delete('/api/jobs', wrap((req, res) => {
  res.json({ ok: true, cleared: jobRunner.clearFinishedJobs() });
}));

app.get('/api/jobs/:id', (req, res) => {
  const job = jobRunner.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.get('/api/jobs/:id/logs', (req, res) => {
  const logs = jobRunner.getJobLogs(req.params.id, parseInt(req.query.offset || '0', 10));
  if (!logs) return res.status(404).json({ error: 'Job not found' });
  res.json(logs);
});

app.post('/api/jobs/:id/stop', wrap((req, res) => {
  res.json(jobRunner.stopJob(req.params.id));
}));

// ---------------------------------------------------------------------------
// Serve the built frontend (dashboard/frontend/dist) when available
// ---------------------------------------------------------------------------
const DIST = path.resolve(__dirname, 'dashboard', 'frontend', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gmail Scheduler dashboard server running on http://localhost:${PORT}`);
  if (!fs.existsSync(DIST)) {
    console.log('Frontend build not found. Run "npm run dashboard:build" to serve the UI from this server,');
    console.log('or run "npm run dashboard:dev" for the Vite dev server on port 3000.');
  }
  if (!DASHBOARD_TOKEN) {
    console.log('WARNING: DASHBOARD_TOKEN is not set - the API is unprotected. Set it in .env before exposing this server.');
  }
});
