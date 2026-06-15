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

app.get('/api/config', (req, res) => {
  res.json({
    DATA_DIR: config.DATA_DIR,
    PROFILES_DIR: config.PROFILES_DIR,
    SCREENSHOT_DIR: config.SCREENSHOT_DIR,
    LOGS_DIR: config.LOGS_DIR,
  });
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

// Clear the scheduled-results log — use with care: automation will re-process all rows.
app.delete('/api/results/scheduled', wrap((req, res) => {
  backupFile(DATA('scheduled_results.csv'));
  csv.writeCsv(DATA('scheduled_results.csv'), [], [
    'queue_id','sender_email','recipient_email','subject','scheduled_at',
    'status','scheduled_native_at','created_at','notes',
  ]);
  res.json({ ok: true });
}));

app.get('/api/screenshots/:name', (req, res) => {
  const name = path.basename(req.params.name); // no path traversal
  const file = path.join(config.SCREENSHOT_DIR, name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Screenshot not found' });
  res.sendFile(file);
});

// ---------------------------------------------------------------------------
// Smart Excel template — formula-driven tracking sheet.
// Setup sheet has editable yellow cells (date B4, time B5, gap B6) and
// editable sender/template/subject lists (B9:B28, B31:B50, B53:B74).
// Jadwal sheet has 200 formula rows that auto-update when Setup cells change.
// ---------------------------------------------------------------------------
app.get('/api/schedule/template', wrap(async (req, res) => {
  const ExcelJS  = require('exceljs');
  const dayjs    = require('dayjs');
  const dayjsUtc = require('dayjs/plugin/utc');
  const dayjsTz  = require('dayjs/plugin/timezone');
  dayjs.extend(dayjsUtc);
  dayjs.extend(dayjsTz);

  const TZ       = 'Asia/Jakarta';
  const GAP_MIN  = 7;
  const NUM_ROWS = 2000;  // 2000 formula rows (~15 hari worth of valid slots)

  const senderRows   = csv.readCsv(DATA('sender_accounts.csv')).filter(s => s.enabled === 'true');
  const templateRows = csv.readCsv(DATA('templates.csv'));
  const subjectRows  = csv.readCsv(DATA('subject_pool.csv'));

  const nowWib = dayjs().tz(TZ);

  // Best send windows (JKT): 18:00–06:00 and 08:00–11:00.
  // Bad windows: 06:00–08:00 and 11:00–18:00.
  // If the computed first slot falls in a bad window, jump to the next good window start.
  const snapToWindow = (dt) => {
    const min = dt.hour() * 60 + dt.minute();
    if (min >= 6 * 60 && min < 8 * 60)   return dt.startOf('day').add(8, 'hour');   // 06:00–08:00 → jump to 08:00
    if (min >= 11 * 60 && min < 18 * 60) return dt.startOf('day').add(18, 'hour');  // 11:00–18:00 → jump to 18:00
    return dt;
  };
  const firstSlot = snapToWindow(nowWib.add(GAP_MIN, 'minute').startOf('minute'));

  // Excel date serial: days since 1899-12-30 (Excel epoch with 1900 leap year bug)
  const dateSerial = dayjs.utc(firstSlot.format('YYYY-MM-DD')).diff(dayjs.utc('1899-12-30'), 'day');
  const timeFrac   = (firstSlot.hour() * 60 + firstSlot.minute()) / 1440;

  // Valid-minute cycle (900 min/day): [0,360)=00:00-06:00 | [480,660)=08:00-11:00 | [1080,1440)=18:00-24:00
  // vpStart = index of firstSlot within the 900-min cycle
  const t0min   = firstSlot.hour() * 60 + firstSlot.minute();
  const vpStart = t0min < 360 ? t0min
                : t0min < 480 ? 360              // in 06-08 blackout → snap to 08:00 slot
                : t0min < 660 ? t0min - 120
                : t0min < 1080 ? 540             // in 11-18 blackout → snap to 18:00 slot
                : t0min - 540;

  // ── Colour / style helpers ────────────────────────────────────────────────
  const C = {
    NAVY: '1F3864', BLUE: '2E75B6', YELLOW: 'FFF2CC', LBLUE: 'DEEAF1',
    GREEN: 'E2EFDA', PURPLE: 'EAD1DC', DGRAY: 'F2F2F2', LGRAY: 'F8F8F8',
    TEAL: 'D9F0E8', EX_ROW: 'FCE4D6',
  };
  const mkFill = hex => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } });
  const sc = (cell, value, { bg, color = '404040', bold = false, italic = false, size = 10, hAlign = 'left', numFmt } = {}) => {
    if (value !== undefined) cell.value = value;
    if (bg) cell.fill = mkFill(bg);
    cell.font = { size, bold, italic, color: { argb: 'FF' + color } };
    cell.alignment = { horizontal: hAlign, vertical: 'middle' };
    if (numFmt) cell.numFmt = numFmt;
  };

  // ── Formula references (must match Setup row layout below) ────────────────
  // B4=date | B5=time | B6=gap | B9:B28=senders | B31:B50=templates | B53:B74=subjects
  const REF = {
    D: 'Setup!$B$4', TM: 'Setup!$B$5', G: 'Setup!$B$6',
    SR: 'Setup!$B$9:$B$28', TR: 'Setup!$B$31:$B$50', XR: 'Setup!$B$53:$B$74',
  };
  // Setup!B76 = helper cell: maps B5 (start time) to valid-cycle index.
  // Formula: IF(B5*1440<360, B5*1440, IF(B5*1440<480, 360, IF(B5*1440<660, B5*1440-120, IF(B5*1440<1080, 540, B5*1440-540))))
  const VP_CELL = 'Setup!$B$76';
  // TVP = total valid minutes elapsed for row n (0-based from row 3)
  // DO  = day offset (whole cycles of 900 valid min)
  // POS = position within current 900-min cycle
  // CLK = actual clock minutes from midnight (maps valid-cycle pos back to real time)
  const _TVP = `(${VP_CELL}+(ROW()-3)*Setup!$B$6)`;
  const _DO  = `INT(${_TVP}/900)`;
  const _POS = `MOD(${_TVP},900)`;
  const _CLK = `IF(${_POS}<360,${_POS},IF(${_POS}<540,${_POS}+120,${_POS}+540))`;
  const _DT  = `Setup!$B$4+${_DO}+${_CLK}/1440`;

  const F = {
    dt:  `=TEXT(${_DT},"YYYY-MM-DD HH:MM")`,
    day: `=TEXT(${_DT},"DDDD")`,
    snd: `=IF(COUNTA(${REF.SR})=0,"",INDEX(${REF.SR},MOD(ROW()-3,COUNTA(${REF.SR}))+1))`,
    tpl: `=IF(COUNTA(${REF.TR})=0,"",INDEX(${REF.TR},MOD(ROW()-3,COUNTA(${REF.TR}))+1))`,
    sub: `=IF(COUNTA(${REF.XR})=0,"",INDEX(${REF.XR},MOD(ROW()-3,COUNTA(${REF.XR}))+1))`,
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gmail Scheduler';

  // ════════════════════════════════════════════════════════════════════════
  // Sheet 1: Setup  — editable yellow cells feed the Jadwal formulas
  //   B4 = Tanggal Mulai (date serial)
  //   B5 = Jam Mulai     (time fraction, numFmt HH:MM)
  //   B6 = Gap menit
  //   B9:B28   = sender emails  (up to 20)
  //   B31:B50  = template keys  (up to 20)
  //   B53:B74  = subject values (up to 22)
  // ════════════════════════════════════════════════════════════════════════
  const wsSetup = wb.addWorksheet('Setup');
  wsSetup.columns = [{ width: 38 }, { width: 48 }];

  // Row 1: title
  wsSetup.mergeCells('A1:B1');
  sc(wsSetup.getCell('A1'), '  KONFIGURASI JADWAL EMAIL', { bg: C.NAVY, color: 'FFFFFF', bold: true, size: 13, hAlign: 'center' });
  wsSetup.getRow(1).height = 28;

  // Row 2: subtitle
  wsSetup.mergeCells('A2:B2');
  sc(wsSetup.getCell('A2'), '  Edit sel KUNING untuk ubah tanggal, jam, gap — sheet Jadwal otomatis berubah (tekan F9 jika perlu refresh)', { bg: C.NAVY, color: 'ADC8E8', italic: true, size: 9, hAlign: 'center' });
  wsSetup.getRow(2).height = 16;

  // Row 3: spacer
  wsSetup.getRow(3).height = 6;

  // Row 4: date input  ← B4
  sc(wsSetup.getCell('A4'), '  ✏  Tanggal Mulai', { bg: C.YELLOW, color: '1F3864', bold: true });
  const dcell = wsSetup.getCell('B4');
  dcell.value = dateSerial;  dcell.numFmt = 'YYYY-MM-DD';
  dcell.fill = mkFill(C.YELLOW);
  dcell.font = { bold: true, size: 11, color: { argb: 'FF1F3864' } };
  dcell.alignment = { horizontal: 'left', vertical: 'middle' };
  wsSetup.getRow(4).height = 24;

  // Row 5: time input  ← B5
  sc(wsSetup.getCell('A5'), '  ✏  Jam Mulai  (format HH:MM, 24 jam WIB)', { bg: C.YELLOW, color: '1F3864', bold: true });
  const tcell = wsSetup.getCell('B5');
  tcell.value = timeFrac;  tcell.numFmt = 'HH:MM';
  tcell.fill = mkFill(C.YELLOW);
  tcell.font = { bold: true, size: 11, color: { argb: 'FF1F3864' } };
  tcell.alignment = { horizontal: 'left', vertical: 'middle' };
  wsSetup.getRow(5).height = 24;

  // Row 6: gap input   ← B6
  sc(wsSetup.getCell('A6'), '  ✏  Gap antar email (menit)', { bg: C.YELLOW, color: '1F3864', bold: true });
  const gcell = wsSetup.getCell('B6');
  gcell.value = GAP_MIN;
  gcell.fill = mkFill(C.YELLOW);
  gcell.font = { bold: true, size: 11, color: { argb: 'FF1F3864' } };
  gcell.alignment = { horizontal: 'left', vertical: 'middle' };
  wsSetup.getRow(6).height = 24;

  // Row 7: spacer
  wsSetup.getRow(7).height = 6;

  // Row 8: senders header
  wsSetup.mergeCells('A8:B8');
  sc(wsSetup.getCell('A8'), `  AKUN PENGIRIM  (${senderRows.length} aktif — edit kolom B untuk ubah rotasi sender)`, { bg: C.BLUE, color: 'FFFFFF', bold: true });
  wsSetup.getRow(8).height = 20;

  // Rows 9-28: sender emails  ← B9:B28
  for (let i = 0; i < 20; i++) {
    const rn = 9 + i;
    const s  = senderRows[i];
    sc(wsSetup.getCell(`A${rn}`), `    Sender ${i + 1}`, { bg: s ? C.GREEN : C.LGRAY, color: s ? '375623' : '999999' });
    const bc = wsSetup.getCell(`B${rn}`);
    if (s) { bc.value = s.sender_email; bc.fill = mkFill(C.GREEN); bc.font = { color: { argb: 'FF375623' } }; }
    else   { bc.fill = mkFill(C.LGRAY); }
    wsSetup.getRow(rn).height = 18;
  }

  // Row 29: spacer
  wsSetup.getRow(29).height = 6;

  // Row 30: templates header
  wsSetup.mergeCells('A30:B30');
  sc(wsSetup.getCell('A30'), `  TEMPLATE  (${templateRows.length} template — key harus ada di menu Templates)`, { bg: C.BLUE, color: 'FFFFFF', bold: true });
  wsSetup.getRow(30).height = 20;

  // Rows 31-50: template keys  ← B31:B50
  for (let i = 0; i < 20; i++) {
    const rn = 31 + i;
    const t  = templateRows[i];
    sc(wsSetup.getCell(`A${rn}`), `    Template ${i + 1}`, { bg: t ? C.PURPLE : C.LGRAY, color: t ? '4A235A' : '999999' });
    const bc = wsSetup.getCell(`B${rn}`);
    if (t) { bc.value = t.template_key; bc.fill = mkFill(C.PURPLE); bc.font = { color: { argb: 'FF4A235A' } }; }
    else   { bc.fill = mkFill(C.LGRAY); }
    wsSetup.getRow(rn).height = 18;
  }

  // Row 51: spacer
  wsSetup.getRow(51).height = 6;

  // Row 52: subjects header
  wsSetup.mergeCells('A52:B52');
  sc(wsSetup.getCell('A52'), `  SUBJECT POOL  (${subjectRows.length} subject — bisa edit)`, { bg: C.BLUE, color: 'FFFFFF', bold: true });
  wsSetup.getRow(52).height = 20;

  // Rows 53-74: subject values  ← B53:B74
  for (let i = 0; i < 22; i++) {
    const rn = 53 + i;
    const s  = subjectRows[i];
    sc(wsSetup.getCell(`A${rn}`), `    Subject ${i + 1}`, { bg: s ? C.LBLUE : C.LGRAY, color: s ? '1F3864' : '999999' });
    const bc = wsSetup.getCell(`B${rn}`);
    if (s) { bc.value = s.subject || ''; bc.fill = mkFill(C.LBLUE); bc.font = { color: { argb: 'FF1F3864' } }; }
    else   { bc.fill = mkFill(C.LGRAY); }
    wsSetup.getRow(rn).height = 18;
  }

  // Row 76: hidden helper — valid-cycle start index for blackout-skip formula
  {
    const vp = wsSetup.getCell('B76');
    vp.value = {
      formula: '=IF(B5*1440<360,B5*1440,IF(B5*1440<480,360,IF(B5*1440<660,B5*1440-120,IF(B5*1440<1080,540,B5*1440-540))))',
      result: vpStart,
    };
    wsSetup.getRow(76).height = 3; // visually hidden
  }

  wsSetup.views = [{ state: 'frozen', ySplit: 3 }];

  // ════════════════════════════════════════════════════════════════════════
  // Sheet 2: Jadwal — 200 formula rows; auto-updates when Setup cells change
  // ════════════════════════════════════════════════════════════════════════
  const wsJadwal = wb.addWorksheet('Jadwal');
  wsJadwal.columns = [
    { key: 'no',              width: 6  },  // A
    { key: 'scheduled_at',   width: 20 },  // B: waktu (formula, skips blackout)
    { key: 'day_name',       width: 12 },  // C: hari (formula)
    { key: 'recipient_email', width: 36 }, // D: ← INPUT kuning
    { key: 'category',        width: 14 }, // E: ← INPUT opsional
    { key: 'sender_email',   width: 32 },  // F: sender (formula)
    { key: 'template_key',   width: 12 },  // G: template (formula)
    { key: 'subject',        width: 28 },  // H: subject (formula)
    { key: 'Terjadwal?',     width: 13 },  // I: tracking
    { key: 'Terkirim?',      width: 11 },  // J: tracking
  ];

  // Row 1: header
  {
    const r = wsJadwal.addRow(['No','scheduled_at','day_name','recipient_email','category','sender_email','template_key','subject','Terjadwal?','Terkirim?']);
    r.height = 22;
    r.eachCell(c => { c.fill = mkFill(C.NAVY); c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }; c.alignment = { horizontal: 'center', vertical: 'middle' }; });
  }

  // Row 2: hint
  {
    const r = wsJadwal.addRow(['#','waktu kirim','hari','← ISI EMAIL PENERIMA','← opsional','sender (auto)','template (auto)','subject (auto)','✓ terjadwal?','✓ terkirim?']);
    r.height = 15;
    r.eachCell((c, col) => {
      const inp = col === 4 || col === 5;
      c.fill = mkFill(inp ? 'FFF2CC' : 'DEEAF1');
      c.font = { italic: true, size: 9, color: { argb: inp ? 'FF7B5E00' : 'FF5B7CA6' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  }

  // Column colors (index 1-based)
  const COL_BG = ['','F5F5F5','F5F5F5','F5F5F5','FFFBE6','FEFCF0','EEF4FB','EEF4FB','EEF4FB',C.TEAL,C.TEAL];

  // Rows 3-202: formula rows (all slots are valid — formula skips blackout windows)
  for (let i = 0; i < NUM_ROWS; i++) {
    // Compute cached slot time (same logic as F.dt formula, in JS)
    const tvp     = vpStart + i * GAP_MIN;
    const dayOff  = Math.floor(tvp / 900);
    const pos     = tvp % 900;
    const clkMin  = pos < 360 ? pos : pos < 540 ? pos + 120 : pos + 540;
    const slot    = firstSlot.startOf('day').add(dayOff, 'day')
                      .hour(Math.floor(clkMin / 60)).minute(clkMin % 60).second(0);

    const sEmail  = senderRows.length   > 0 ? senderRows[i % senderRows.length].sender_email        : '';
    const tKey    = templateRows.length > 0 ? templateRows[i % templateRows.length].template_key     : '';
    const subj    = subjectRows.length  > 0 ? (subjectRows[i % subjectRows.length].subject || '')    : '';

    const r = wsJadwal.getRow(i + 3);
    r.height = 18;

    r.getCell(1).value = { formula: '=ROW()-2', result: i + 1 };
    r.getCell(2).value = { formula: F.dt,  result: slot.format('YYYY-MM-DD HH:mm') };
    r.getCell(3).value = { formula: F.day, result: slot.format('dddd') };
    // col 4 (D) & 5 (E): left blank for worker
    r.getCell(6).value = senderRows.length   > 0 ? { formula: F.snd, result: sEmail } : '';
    r.getCell(7).value = templateRows.length > 0 ? { formula: F.tpl, result: tKey }   : '';
    r.getCell(8).value = subjectRows.length  > 0 ? { formula: F.sub, result: subj }   : '';
    // col 9-10: blank tracking

    for (let c = 1; c <= 10; c++) {
      const cell = r.getCell(c);
      if (COL_BG[c]) cell.fill = mkFill(COL_BG[c]);
      cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'center' : 'left' };
      cell.font = { size: 10, color: { argb: c === 4 ? 'FF1F3864' : 'FF404040' } };
    }
  }

  // Dropdowns
  wsJadwal.dataValidations.add(`E3:E${2 + NUM_ROWS}`, {
    type: 'list', allowBlank: true, formulae: ['"SaaS,Agency,Retail"'],
    showErrorMessage: false, showInputMessage: true, promptTitle: 'Kategori', prompt: 'SaaS / Agency / Retail',
  });
  for (const col of ['I', 'J']) {
    wsJadwal.dataValidations.add(`${col}3:${col}${2 + NUM_ROWS}`, {
      type: 'list', allowBlank: true, formulae: ['"Y,N"'],
      showErrorMessage: false, showInputMessage: true,
      promptTitle: col === 'I' ? 'Terjadwal?' : 'Terkirim?', prompt: 'Y = sudah, N = belum',
    });
  }
  wsJadwal.views = [{ state: 'frozen', xSplit: 3, ySplit: 2 }];

  // ════════════════════════════════════════════════════════════════════════
  // Sheet 3: Panduan
  // ════════════════════════════════════════════════════════════════════════
  const wsPanduan = wb.addWorksheet('Panduan');
  wsPanduan.columns = [{ width: 82 }];
  const ap = (text, { bg, font: fnt, height = 16 } = {}) => {
    const r = wsPanduan.addRow([text]);
    r.height = height;
    if (bg)  r.getCell(1).fill = mkFill(bg);
    r.getCell(1).font = fnt || { size: 10, color: { argb: 'FF404040' } };
    r.getCell(1).alignment = { vertical: 'middle', wrapText: true };
    return r;
  };
  const WHT = { color: { argb: 'FFFFFFFF' } };

  let h;
  h = ap('  PANDUAN TRACKING JADWAL EMAIL', { bg: C.NAVY, height: 26, font: { bold: true, size: 13, ...WHT } });
  h.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  ap('');
  ap('  ① Setup sheet — ubah kalau perlu (formulas Jadwal otomatis ikut)', { bg: C.BLUE, height: 20, font: { bold: true, ...WHT } });
  ap(`     → Sel B4 (KUNING): tanggal mulai — sekarang ${firstSlot.format('YYYY-MM-DD')}`, { bg: C.YELLOW, font: { size: 10, color: { argb: 'FF1F3864' } } });
  ap(`     → Sel B5 (KUNING): jam mulai — sekarang ${firstSlot.format('HH:mm')} WIB`, { bg: C.YELLOW, font: { size: 10, color: { argb: 'FF1F3864' } } });
  ap(`     → Sel B6 (KUNING): gap antar email — sekarang ${GAP_MIN} menit`, { bg: C.YELLOW, font: { size: 10, color: { argb: 'FF1F3864' } } });
  ap('     → Edit B4/B5/B6 → sheet Jadwal auto-hitung ulang. Tekan F9 kalau perlu paksa refresh.', { bg: C.LBLUE });
  ap('     → Daftar sender (B9:B28), template (B31:B50), subject (B53:B74) juga bisa diedit', { bg: C.LBLUE });

  ap('');
  ap('  ② Sheet "Jadwal" — isi kolom recipient_email saja', { bg: C.BLUE, height: 20, font: { bold: true, ...WHT } });
  ap('     → Kolom D (background KUNING) = recipient_email — satu-satunya yang WAJIB diisi', { bg: C.YELLOW, font: { size: 10, color: { argb: 'FF7B5E00' } } });
  ap('     → Kolom E = category — opsional, dropdown SaaS / Agency / Retail', { bg: C.LBLUE });
  ap('     → Kolom B/C/F/G/H = formula otomatis — JANGAN diubah manual', { bg: C.DGRAY });
  ap(`     → ${NUM_ROWS} baris formula tersedia — isi sebanyak yang dibutuhkan, baris kosong di-skip saat convert`, { bg: C.LBLUE });

  ap('');
  ap('  ③ Upload & Convert', { bg: C.BLUE, height: 20, font: { bold: true, ...WHT } });
  ap('     → Menu Schedule → Upload Excel / CSV → pilih file ini', { bg: C.LBLUE });
  ap('     → Klik "Convert & Generate Jadwal" — hanya baris dengan recipient_email yang diproses', { bg: C.LBLUE });

  ap('');
  ap('  ④ Tracking setelah automasi berjalan', { bg: C.BLUE, height: 20, font: { bold: true, ...WHT } });
  ap('     → Kolom I "Terjadwal?" → isi Y jika email sudah masuk folder Scheduled Gmail', { bg: C.TEAL });
  ap('     → Kolom J "Terkirim?" → isi Y setelah email terkirim (setelah waktu jadwal berlalu)', { bg: C.TEAL });

  // ── Stream response ──────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="tracking_jadwal_email.xlsx"');
  await wb.xlsx.write(res);
  res.end();
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
  const { input, startDate } = req.body || {};
  if (!input) return res.status(400).json({ error: 'input file path is required' });
  // Only allow files inside the data directory.
  const resolved = path.resolve(input);
  if (!resolved.startsWith(config.DATA_DIR)) {
    return res.status(400).json({ error: 'input must be inside the data directory' });
  }
  const output = path.join(config.DATA_DIR, 'schedule_tracker.csv');
  const args = [`--input=${resolved}`, `--output=${output}`];
  if (startDate) args.push(`--start-date=${startDate}`);
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
