const xlsx = require('xlsx');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const csv = require('../src/csv');
const dataLoader = require('../src/dataLoader');

dayjs.extend(utc);
dayjs.extend(timezone);

// ── Constants ─────────────────────────────────────────────────────────────
const TZ          = 'Asia/Jakarta';
const GAP_MIN     = 7;
const MAX_PER_DAY = 20;
const MORNING_N   = 8;   // 08:00–08:49 → 8 slots
const EVENING_N   = 12;  // 18:00–19:17 → 12 slots

const HEADERS = [
  'queue_id','sender_email','recipient_email','subject','template_key',
  'scheduled_at','category','company_name','website','day_name',
  'per_sender_sequence','notes',
];

const argv = yargs(hideBin(process.argv))
  .option('input',      { type: 'string', demandOption: true })
  .option('output',     { type: 'string', default: 'data/schedule_tracker.csv' })
  .option('start-date', { type: 'string', description: 'YYYY-MM-DD (override Setup sheet)' })
  .argv;

// ── Helpers ────────────────────────────────────────────────────────────────
// Parse Excel date: could be serial number (number) or string
function parseExcelDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel serial: days since 1899-12-30
    return dayjs('1899-12-30').add(val, 'day').format('YYYY-MM-DD');
  }
  const s = String(val).trim();
  // Accept YYYY-MM-DD or DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = dayjs(s);
  return d.isValid() ? d.format('YYYY-MM-DD') : null;
}

// Spread slots randomly across the FULL best-time windows:
//   Morning : 08:00–11:00 WIB (180 min) → up to MORNING_N slots
//   Evening : 18:00–06:00+1 WIB (720 min) → up to EVENING_N slots
// minFromMidnight: skip any slot before this many minutes (used on start day
// to avoid scheduling in the past). A 10-min buffer is always added on top.
function daySlots(dateStr, minFromMidnight = 0) {
  const slots = [];

  const fmt = (totalMin) => {
    const dayOffset = Math.floor(totalMin / 1440);
    const minOfDay  = totalMin % 1440;
    const hh = String(Math.floor(minOfDay / 60)).padStart(2, '0');
    const mm = String(minOfDay % 60).padStart(2, '0');
    const d  = dayjs(dateStr).add(dayOffset, 'day').format('YYYY-MM-DD');
    return `${d} ${hh}:${mm}`;
  };

  // Morning window: 480–660 min
  const M_SUB = (11 * 60 - 8 * 60) / MORNING_N;
  let last = Math.max(8 * 60, minFromMidnight);
  for (let i = 0; i < MORNING_N; i++) {
    const lo = 8 * 60 + i * M_SUB;
    const hi = lo + M_SUB - GAP_MIN;
    const earliest = Math.max(lo, i === 0 ? last : last + GAP_MIN);
    if (earliest > hi || earliest >= 11 * 60) continue; // window already past
    const t = Math.round(earliest + Math.random() * Math.max(0, hi - earliest));
    last = t;
    slots.push(fmt(t));
  }

  // Evening window: 1080–1800 min (18:00–06:00+1)
  const E_SUB = (30 * 60 - 18 * 60) / EVENING_N;
  last = Math.max(18 * 60, minFromMidnight, last + GAP_MIN);
  for (let i = 0; i < EVENING_N; i++) {
    const lo = 18 * 60 + i * E_SUB;
    const hi = lo + E_SUB - GAP_MIN;
    const earliest = Math.max(lo, i === 0 ? last : last + GAP_MIN);
    if (earliest > hi) continue;
    const t = Math.round(earliest + Math.random() * Math.max(0, hi - earliest));
    last = t;
    slots.push(fmt(t));
  }

  return slots; // up to MAX_PER_DAY = 20
}

// Return minutes-from-midnight (WIB) for the current moment + buffer,
// only when dateStr == today. Returns 0 for future dates.
const BUFFER_MIN = 10; // Gmail needs at least ~5 min; we use 10 to be safe
function minStartForDate(dateStr) {
  const nowWib  = dayjs().tz(TZ);
  const todayWib = nowWib.format('YYYY-MM-DD');
  if (dateStr > todayWib) return 0; // future date — all slots valid
  if (dateStr < todayWib) return 24 * 60; // past date — no slots (force next day)
  // Same day: skip anything before now + buffer
  return nowWib.hour() * 60 + nowWib.minute() + BUFFER_MIN;
}

// Passthrough row normalizer (old Schedule-sheet format)
function copyRow(raw) {
  return {
    queue_id:            String(raw.queue_id || '').trim(),
    sender_email:        String(raw.sender_email || '').trim(),
    recipient_email:     String(raw.recipient_email || '').trim(),
    subject:             String(raw.subject || '').trim(),
    template_key:        String(raw.template_key || '').trim(),
    scheduled_at:        String(raw.scheduled_at || '').trim(),
    category:            String(raw.category || '').trim(),
    company_name:        String(raw.company_name || '').trim(),
    website:             String(raw.website || '').trim(),
    day_name:            String(raw.day_name || '').trim(),
    per_sender_sequence: String(raw.per_sender_sequence || '').trim(),
    notes:               String(raw.notes || '').trim(),
  };
}

// ── Smart mode ─────────────────────────────────────────────────────────────
// Reads "Penerima" + "Setup" sheets, auto-assigns sender / template / time.
async function runSmartMode(workbook) {
  const nowWib = dayjs().tz(TZ);
  console.log('Mode: SMART (sheet "Penerima" terdeteksi)');
  console.log(`Waktu sekarang (WIB): ${nowWib.format('YYYY-MM-DD HH:mm')}`);
  console.log(`Windows WIB: 08:00–11:00 (${MORNING_N} email) + 18:00–06:00+1 (${EVENING_N} email) per sender/hari`);

  // ── Read start date (CLI arg > Setup sheet > today) ─────────────────────
  let startDateStr = argv['start-date'] || null;
  if (!startDateStr) {
    const setupSheet = workbook.Sheets['Setup'];
    if (setupSheet) {
      const setupRows = xlsx.utils.sheet_to_json(setupSheet, { header: 1, defval: '' });
      for (const row of setupRows) {
        if (String(row[0] || '').includes('Tanggal Mulai')) {
          startDateStr = parseExcelDate(row[1]);
          if (startDateStr) {
            console.log(`Tanggal mulai dari Setup sheet: ${startDateStr}`);
            break;
          }
        }
      }
    }
  }
  const todayWib = nowWib.format('YYYY-MM-DD');
  startDateStr = startDateStr || todayWib;

  // If start date is in the past, clamp to today
  if (startDateStr < todayWib) {
    console.log(`⚠  Start date ${startDateStr} sudah lewat → otomatis pakai hari ini (${todayWib})`);
    startDateStr = todayWib;
  }

  // Detect which windows are still available today and log a hint
  const nowMin = nowWib.hour() * 60 + nowWib.minute();
  if (startDateStr === todayWib) {
    if (nowMin >= 11 * 60 && nowMin < 18 * 60) {
      console.log(`ℹ  Sekarang ${nowWib.format('HH:mm')} — window pagi (08:00–11:00) sudah lewat.`);
      console.log(`   Slot hari ini mulai dari window malam (18:00 WIB ke atas).`);
    } else if (nowMin >= 18 * 60 || nowMin < 6 * 60) {
      console.log(`ℹ  Sekarang ${nowWib.format('HH:mm')} — sedang dalam window malam.`);
      console.log(`   Slot hari ini mulai dari sekitar ${nowWib.add(BUFFER_MIN, 'minute').format('HH:mm')} WIB.`);
    } else if (nowMin >= 6 * 60 && nowMin < 8 * 60) {
      console.log(`ℹ  Sekarang ${nowWib.format('HH:mm')} — sebelum window pagi. Semua slot hari ini tersedia.`);
    }
  }
  console.log(`Start date: ${startDateStr}`);

  // ── Load system data ─────────────────────────────────────────────────────
  const senders      = dataLoader.loadSenders();
  const templatesMap = dataLoader.loadTemplates();
  const templateKeys = Object.keys(templatesMap);
  const subjectPool  = dataLoader.loadSubjects(); // [{subject: '...'}]

  if (senders.length === 0) {
    console.error('ERROR: Tidak ada sender aktif. Tambahkan di menu Accounts dulu.');
    process.exit(1);
  }
  if (templateKeys.length === 0) {
    console.error('ERROR: Tidak ada template. Tambahkan di menu Templates dulu.');
    process.exit(1);
  }

  console.log(`Sender  : ${senders.length} akun → ${senders.map(s => s.sender_email).join(', ')}`);
  console.log(`Template: ${templateKeys.length} key  → ${templateKeys.join(', ')}`);
  console.log(`Subject : ${subjectPool.length} entri di pool`);

  // ── Read recipients from "Penerima" sheet ────────────────────────────────
  const penerimaSheet = workbook.Sheets['Penerima'];
  const rawRecipients = xlsx.utils.sheet_to_json(penerimaSheet, { defval: '' });
  // Filter empty rows
  const recipients = rawRecipients.filter(r => {
    const email = String(r.recipient_email || r['Email'] || r['email'] || '').trim();
    return email.includes('@');
  });

  if (recipients.length === 0) {
    console.error('ERROR: Sheet "Penerima" kosong atau kolom recipient_email tidak ditemukan.');
    process.exit(1);
  }
  console.log(`\nPenerima: ${recipients.length} baris`);

  // ── Generate schedule ────────────────────────────────────────────────────
  const scheduleRows = [];
  let currentDate = dayjs(startDateStr);
  let recipientIdx = 0;     // global index into recipients[]
  let templateRotation = 0; // global template rotation counter
  let subjectRotation  = 0; // global subject rotation counter
  let dayCount = 0;

  while (recipientIdx < recipients.length) {
    const dateStr = currentDate.format('YYYY-MM-DD');
    const dayName = currentDate.format('dddd');
    const slots   = daySlots(dateStr, minStartForDate(dateStr));

    const dayStart = recipientIdx;

    for (const sender of senders) {
      let senderSeq = 0;

      for (const slot of slots) {
        if (recipientIdx >= recipients.length) break;

        const raw = recipients[recipientIdx];
        const recipientEmail = String(raw.recipient_email || raw['Email'] || raw['email'] || '').trim();
        if (!recipientEmail.includes('@')) { recipientIdx++; continue; }

        const category    = String(raw.category    || raw['Category']     || '').trim();
        const companyName = String(raw.company_name || raw['Company Name'] || raw['Company'] || '').trim();
        const website     = String(raw.website      || raw['Website']      || '').trim();
        const notes       = String(raw.notes        || raw['Notes']        || '').trim();

        // Rotate template & subject
        const templateKey = templateKeys[templateRotation % templateKeys.length];
        templateRotation++;

        let subject = '';
        if (subjectPool.length > 0) {
          subject = subjectPool[subjectRotation % subjectPool.length].subject || '';
          subjectRotation++;
        }

        senderSeq++;
        const queueId = `Q-${currentDate.format('YYYYMMDD')}-${String(recipientIdx + 1).padStart(6, '0')}`;

        scheduleRows.push({
          queue_id:            queueId,
          sender_email:        sender.sender_email,
          recipient_email:     recipientEmail,
          subject:             subject,
          template_key:        templateKey,
          scheduled_at:        slot,
          category:            category,
          company_name:        companyName,
          website:             website,
          day_name:            dayName,
          per_sender_sequence: String(senderSeq),
          notes:               notes,
        });

        recipientIdx++;
      }
      if (recipientIdx >= recipients.length) break;
    }

    const addedToday = recipientIdx - dayStart;
    const slotDesc = slots.length < MAX_PER_DAY
      ? `${slots.length} slot (terpangkas — window sebagian lewat)`
      : `${slots.length} slot`;
    console.log(`${dateStr} (${dayName}): ${addedToday} email dijadwalkan [${slotDesc}/sender]`);

    currentDate = currentDate.add(1, 'day');
    dayCount++;
    if (dayCount > 90) {
      console.log('Safety break: 90 hari terlampaui.');
      break;
    }
  }

  csv.writeCsv(argv.output, scheduleRows, HEADERS);
  console.log(`\n✓ ${scheduleRows.length} baris jadwal → ${argv.output}`);
  if (scheduleRows.length > 0) {
    console.log(`  Rentang: ${scheduleRows[0].scheduled_at} s/d ${scheduleRows[scheduleRows.length - 1].scheduled_at}`);
  }

  // Summary per sender
  const byEmail = {};
  for (const r of scheduleRows) byEmail[r.sender_email] = (byEmail[r.sender_email] || 0) + 1;
  console.log('\nRingkasan per sender:');
  for (const [email, count] of Object.entries(byEmail)) {
    console.log(`  ${email}: ${count} email`);
  }

  // Template distribution
  const byTpl = {};
  for (const r of scheduleRows) byTpl[r.template_key] = (byTpl[r.template_key] || 0) + 1;
  console.log('\nDistribusi template:');
  for (const [k, count] of Object.entries(byTpl)) {
    console.log(`  ${k}: ${count} email`);
  }
}

// ── Legacy / passthrough mode ───────────────────────────────────────────────
async function runLegacyMode(workbook) {
  const sheetName = workbook.SheetNames.includes('Schedule')
    ? 'Schedule'
    : workbook.SheetNames[0];
  const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  console.log(`Sheet "${sheetName}": ${rawData.length} baris`);

  if (rawData.length === 0) {
    console.error('Sheet kosong.');
    process.exit(1);
  }

  const first = rawData[0];
  const hasTime = first.scheduled_at &&
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(first.scheduled_at).trim());

  if (hasTime) {
    // Passthrough: already has scheduled_at
    console.log('Mode: passthrough (scheduled_at sudah ada — copy as-is)');
    const rows = rawData.map(copyRow);
    csv.writeCsv(argv.output, rows, HEADERS);
    console.log(`✓ ${rows.length} baris disalin.`);
    return;
  }

  // Distribute: auto-generate times (old behaviour)
  console.log('Mode: distribute (scheduled_at kosong — generate waktu otomatis)');
  const senders     = dataLoader.loadSenders();
  const templatesMap = dataLoader.loadTemplates();
  const templateKeys = Object.keys(templatesMap);

  const startDateStr = argv['start-date'] || dayjs().format('YYYY-MM-DD');
  let currentDate = dayjs(startDateStr);
  const scheduleRows = [];
  let dataIndex = 0;
  let dayCount = 0;

  while (dataIndex < rawData.length) {
    const dateStr = currentDate.format('YYYY-MM-DD');
    const dayName = currentDate.format('dddd');
    const slots   = daySlots(dateStr, minStartForDate(dateStr));

    for (const sender of senders) {
      let senderSeq = 0;
      for (const slot of slots) {
        if (dataIndex >= rawData.length) break;
        const raw = rawData[dataIndex];
        const recipientEmail = String(
          raw.recipient_email || raw['To Email'] || raw['Email'] || raw['email'] || ''
        ).trim();
        if (!recipientEmail) { dataIndex++; continue; }

        const templateKey = String(raw.template_key || raw['Template'] || templateKeys[0] || '').trim();
        senderSeq++;
        const queueId = `Q-${currentDate.format('YYYYMMDD')}-${String(dataIndex + 1).padStart(6, '0')}`;

        scheduleRows.push({
          queue_id:            queueId,
          sender_email:        sender.sender_email,
          recipient_email:     recipientEmail,
          subject:             String(raw.subject || '').trim(),
          template_key:        templateKey,
          scheduled_at:        slot,
          category:            String(raw.category || '').trim(),
          company_name:        String(raw.company_name || raw['Company'] || '').trim(),
          website:             String(raw.website || '').trim(),
          day_name:            dayName,
          per_sender_sequence: String(senderSeq),
          notes:               String(raw.notes || '').trim(),
        });
        dataIndex++;
      }
      if (dataIndex >= rawData.length) break;
    }

    currentDate = currentDate.add(1, 'day');
    dayCount++;
    if (dayCount > 90) break;
  }

  csv.writeCsv(argv.output, scheduleRows, HEADERS);
  console.log(`✓ ${scheduleRows.length} baris jadwal → ${argv.output}`);
}

// ── Tracking mode ──────────────────────────────────────────────────────────
// Reads "Jadwal" sheet (pre-filled tracking template). Only copies rows where
// recipient_email is filled; scheduled_at, sender, template, subject come from
// the pre-filled cells.
async function runTrackingMode(workbook) {
  console.log('Mode: TRACKING (sheet "Jadwal" terdeteksi — data sudah pre-filled)');

  const sheet   = workbook.Sheets['Jadwal'];
  const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  const nowWib = dayjs().tz(TZ);

  // Skip: (1) recipient kosong, (2) waktu sudah lewat
  let skippedEmpty = 0, skippedPast = 0;
  const rows = rawData.filter(r => {
    const email = String(r.recipient_email || '').trim();
    if (!email.includes('@')) { skippedEmpty++; return false; }
    const scheduledAt = String(r.scheduled_at || '').trim();
    if (scheduledAt) {
      const slotTime = dayjs.tz(scheduledAt, TZ);
      if (slotTime.isValid() && slotTime.isBefore(nowWib)) { skippedPast++; return false; }
    }
    return true;
  });

  if (rows.length === 0) {
    console.error('ERROR: Tidak ada baris yang valid untuk dijadwalkan.');
    if (skippedPast > 0)  console.error(`  → ${skippedPast} baris di-skip karena waktunya sudah lewat.`);
    if (skippedEmpty > 0) console.error(`  → ${skippedEmpty} baris di-skip karena recipient_email kosong.`);
    process.exit(1);
  }
  console.log(`Penerima terisi: ${rows.length} baris akan dijadwalkan`);
  if (skippedPast  > 0) console.log(`  ↷ ${skippedPast} baris di-skip (waktu sudah lewat)`);
  if (skippedEmpty > 0) console.log(`  ↷ ${skippedEmpty} baris di-skip (recipient kosong)`);

  // Track per-sender sequence counter
  const senderSeq = {};

  const scheduleRows = rows.map((raw, idx) => {
    const scheduledAt    = String(raw.scheduled_at    || '').trim();
    const recipientEmail = String(raw.recipient_email  || '').trim();
    const senderEmail    = String(raw.sender_email     || '').trim();
    const templateKey    = String(raw.template_key     || '').trim();
    const subject        = String(raw.subject          || '').trim();
    const category       = String(raw.category         || '').trim();
    const dayName        = String(raw.day_name         || '').trim();

    senderSeq[senderEmail] = (senderSeq[senderEmail] || 0) + 1;
    const dateDigits = scheduledAt.slice(0, 10).replace(/-/g, '') || dayjs().format('YYYYMMDD');
    const queueId    = `Q-${dateDigits}-${String(idx + 1).padStart(6, '0')}`;

    return {
      queue_id:            queueId,
      sender_email:        senderEmail,
      recipient_email:     recipientEmail,
      subject:             subject,
      template_key:        templateKey,
      scheduled_at:        scheduledAt,
      category:            category,
      company_name:        '',
      website:             '',
      day_name:            dayName,
      per_sender_sequence: String(senderSeq[senderEmail]),
      notes:               '',
    };
  });

  csv.writeCsv(argv.output, scheduleRows, HEADERS);
  console.log(`\n✓ ${scheduleRows.length} baris jadwal → ${argv.output}`);
  if (scheduleRows.length > 0) {
    console.log(`  Rentang: ${scheduleRows[0].scheduled_at} s/d ${scheduleRows[scheduleRows.length - 1].scheduled_at}`);
  }

  const byEmail = {};
  for (const r of scheduleRows) byEmail[r.sender_email] = (byEmail[r.sender_email] || 0) + 1;
  console.log('\nRingkasan per sender:');
  for (const [email, count] of Object.entries(byEmail)) {
    console.log(`  ${email}: ${count} email`);
  }
}

// ── Entry point ────────────────────────────────────────────────────────────
async function run() {
  console.log('--- Converting Excel to Schedule CSV ---');

  const workbook = xlsx.readFile(argv.input);
  console.log(`Sheet tersedia: ${workbook.SheetNames.join(', ')}`);

  if (workbook.SheetNames.includes('Jadwal')) {
    await runTrackingMode(workbook);
  } else if (workbook.SheetNames.includes('Penerima')) {
    console.log(`Aturan: max ${MAX_PER_DAY}/sender/hari | gap ${GAP_MIN}menit | window 08:00-11:00 + 18:00-06:00 WIB`);
    await runSmartMode(workbook);
  } else {
    await runLegacyMode(workbook);
  }
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
