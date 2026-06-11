const dataLoader = require('../src/dataLoader');
const dateHelper = require('../src/date');

async function run() {
  console.log('--- Validating Schedule Tracker ---');
  
  const senders = dataLoader.loadSenders();
  const senderEmails = new Set(senders.map(s => s.sender_email));
  const templates = dataLoader.loadTemplates();
  const scheduleRows = dataLoader.loadScheduleRows();
  
  const errors = [];
  const queueIds = new Set();
  const senderDailyCount = {}; // sender -> date -> count

  scheduleRows.forEach((row, index) => {
    const line = index + 2; // CSV line number
    
    // Check queue_id
    if (!row.queue_id) {
      errors.push(`Line ${line}: Missing queue_id`);
    } else if (queueIds.has(row.queue_id)) {
      errors.push(`Line ${line}: Duplicate queue_id ${row.queue_id}`);
    }
    queueIds.add(row.queue_id);

    // Check emails
    if (!row.recipient_email || !row.recipient_email.includes('@')) {
      errors.push(`Line ${line}: Invalid recipient_email "${row.recipient_email}"`);
    }
    if (!senderEmails.has(row.sender_email)) {
      errors.push(`Line ${line}: Unknown or disabled sender_email "${row.sender_email}"`);
    }

    // Check template
    if (!templates[row.template_key]) {
      errors.push(`Line ${line}: Unknown template_key "${row.template_key}"`);
    }

    // Check scheduled_at
    try {
      const dt = dateHelper.parseJktDateTime(row.scheduled_at);
      if (!dt.isValid()) {
        errors.push(`Line ${line}: Invalid scheduled_at "${row.scheduled_at}"`);
      } else {
        const dateStr = dt.format('YYYY-MM-DD');
        if (!senderDailyCount[row.sender_email]) senderDailyCount[row.sender_email] = {};
        if (!senderDailyCount[row.sender_email][dateStr]) senderDailyCount[row.sender_email][dateStr] = 0;
        senderDailyCount[row.sender_email][dateStr]++;
      }
    } catch (e) {
      errors.push(`Line ${line}: Error parsing scheduled_at "${row.scheduled_at}"`);
    }
  });

  // Check gaps
  try {
    dateHelper.assertMinimumGapPerSender(scheduleRows, 7);
  } catch (e) {
    errors.push(`Gap Error: ${e.message}`);
  }

  // Summary
  console.log(`Total rows checked: ${scheduleRows.length}`);
  console.log(`Errors found: ${errors.length}`);
  
  if (errors.length > 0) {
    console.error('\nERRORS:');
    errors.forEach(err => console.error(`- ${err}`));
  } else {
    console.log('\nSUCCESS: All rows are valid.');
    
    console.log('\nDaily Summary (emails per sender):');
    Object.keys(senderDailyCount).forEach(sender => {
      console.log(`\nSender: ${sender}`);
      Object.keys(senderDailyCount[sender]).sort().forEach(date => {
        console.log(`  ${date}: ${senderDailyCount[sender][date]} emails`);
      });
    });
  }
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
