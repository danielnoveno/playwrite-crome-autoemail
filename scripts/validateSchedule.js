const path = require('path');
const config = require('../src/config');
const csv = require('../src/csv');
const dataLoader = require('../src/dataLoader');
const dateHelper = require('../src/date');

async function run() {
  console.log('--- Validating Schedule Tracker ---');

  // Load enabled senders (for skip check) AND all senders (to detect disabled)
  const enabledSenders = dataLoader.loadSenders(); // only enabled=true
  const allSenders = csv.readCsv(path.join(config.DATA_DIR, 'sender_accounts.csv'));
  const enabledEmails = new Set(enabledSenders.map(s => s.sender_email));
  const disabledEmails = new Set(
    allSenders.filter(s => s.enabled !== 'true').map(s => s.sender_email)
  );

  const templates = dataLoader.loadTemplates();
  const scheduleRows = dataLoader.loadScheduleRows();

  const errors = [];
  const warnings = [];
  const skippedSenders = new Set();
  const queueIds = new Set();
  const senderDailyCount = {};

  scheduleRows.forEach((row, index) => {
    const line = index + 2;

    // queue_id
    if (!row.queue_id) {
      errors.push(`Line ${line}: Missing queue_id`);
    } else if (queueIds.has(row.queue_id)) {
      errors.push(`Line ${line}: Duplicate queue_id ${row.queue_id}`);
    }
    queueIds.add(row.queue_id);

    // sender — disabled = warning (skip), unknown = error
    if (disabledEmails.has(row.sender_email)) {
      skippedSenders.add(row.sender_email);
      // don't count in daily summary for disabled senders
      return;
    } else if (!enabledEmails.has(row.sender_email)) {
      errors.push(`Line ${line}: Sender tidak dikenal "${row.sender_email}" — tambahkan di menu Accounts`);
      return;
    }

    // recipient
    if (!row.recipient_email || !row.recipient_email.includes('@')) {
      errors.push(`Line ${line}: recipient_email tidak valid "${row.recipient_email}"`);
    }

    // template
    if (!templates[row.template_key]) {
      errors.push(`Line ${line}: template_key tidak ditemukan "${row.template_key}"`);
    }

    // scheduled_at
    try {
      const dt = dateHelper.parseJktDateTime(row.scheduled_at);
      if (!dt.isValid()) {
        errors.push(`Line ${line}: scheduled_at tidak valid "${row.scheduled_at}"`);
      } else {
        const dateStr = dt.format('YYYY-MM-DD');
        if (!senderDailyCount[row.sender_email]) senderDailyCount[row.sender_email] = {};
        if (!senderDailyCount[row.sender_email][dateStr]) senderDailyCount[row.sender_email][dateStr] = 0;
        senderDailyCount[row.sender_email][dateStr]++;
      }
    } catch (e) {
      errors.push(`Line ${line}: Gagal parse scheduled_at "${row.scheduled_at}"`);
    }
  });

  // Gap check (only for enabled senders)
  try {
    const enabledRows = scheduleRows.filter(r => enabledEmails.has(r.sender_email));
    dateHelper.assertMinimumGapPerSender(enabledRows, 7);
  } catch (e) {
    errors.push(`Gap Error: ${e.message}`);
  }

  // Output
  console.log(`Total rows checked: ${scheduleRows.length}`);

  if (skippedSenders.size > 0) {
    const skippedRows = scheduleRows.filter(r => disabledEmails.has(r.sender_email)).length;
    console.log(`\nINFO: ${skippedRows} baris di-skip karena sender di-nonaktifkan (disabled):`);
    skippedSenders.forEach(s => console.log(`  - ${s}`));
    console.log('  → Aktifkan kembali di menu Accounts jika ingin diproses.');
  }

  if (warnings.length > 0) {
    console.log(`\nWARNINGS (${warnings.length}):`);
    warnings.forEach(w => console.log(`  ⚠ ${w}`));
  }

  if (errors.length > 0) {
    console.log(`\nERRORS (${errors.length}):`);
    errors.forEach(e => console.error(`  ✗ ${e}`));
    console.log('\nPerbaiki error di atas sebelum run.');
  } else {
    const activeRows = scheduleRows.filter(r => enabledEmails.has(r.sender_email));
    console.log(`\n✓ VALID: ${activeRows.length} baris siap diproses (dari ${enabledSenders.length} sender aktif).`);

    if (Object.keys(senderDailyCount).length > 0) {
      console.log('\nRingkasan per sender per hari:');
      Object.keys(senderDailyCount).forEach(sender => {
        console.log(`\n  ${sender}`);
        Object.keys(senderDailyCount[sender]).sort().forEach(date => {
          console.log(`    ${date}: ${senderDailyCount[sender][date]} email`);
        });
      });
    }
  }
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
