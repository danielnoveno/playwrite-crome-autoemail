const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const csv = require('../src/csv');
const config = require('../src/config');
const dataLoader = require('../src/dataLoader');

dayjs.extend(utc);
dayjs.extend(timezone);

const SCHEDULE_HEADERS = [
  'queue_id', 'sender_email', 'recipient_email', 'subject', 'template_key',
  'scheduled_at', 'category', 'company_name', 'website', 'day_name',
  'per_sender_sequence', 'notes',
];

const argv = yargs(hideBin(process.argv))
  .option('input', { type: 'string', demandOption: true })
  .option('output', { type: 'string', default: 'data/schedule_tracker.csv' })
  .option('start-date', { type: 'string', description: 'YYYY-MM-DD (ignored when Excel already has scheduled_at)' })
  .option('start-time', { type: 'string', default: '21:00' })
  .option('gap-minutes', { type: 'number', default: 7 })
  .argv;

function detectMode(data) {
  if (data.length === 0) return 'distribute';
  const first = data[0];
  // If it already has scheduled_at with a real value, treat as pre-scheduled
  if (first.scheduled_at && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(first.scheduled_at).trim())) {
    return 'passthrough';
  }
  return 'distribute';
}

function copyRow(rawRow) {
  return {
    queue_id: String(rawRow.queue_id || '').trim(),
    sender_email: String(rawRow.sender_email || '').trim(),
    recipient_email: String(rawRow.recipient_email || '').trim(),
    subject: String(rawRow.subject || '').trim(),
    template_key: String(rawRow.template_key || '').trim(),
    scheduled_at: String(rawRow.scheduled_at || '').trim(),
    category: String(rawRow.category || '').trim(),
    company_name: String(rawRow.company_name || '').trim(),
    website: String(rawRow.website || '').trim(),
    day_name: String(rawRow.day_name || '').trim(),
    per_sender_sequence: String(rawRow.per_sender_sequence || '').trim(),
    notes: String(rawRow.notes || '').trim(),
  };
}

async function run() {
  console.log('--- Converting Excel to Schedule CSV ---');

  const workbook = xlsx.readFile(argv.input);
  // Prefer sheet named "Schedule", otherwise use the first sheet.
  const sheetName = workbook.SheetNames.includes('Schedule') ? 'Schedule' : workbook.SheetNames[0];
  const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const mode = detectMode(rawData);
  console.log(`Mode: ${mode} (${rawData.length} rows)`);

  if (mode === 'passthrough') {
    // Excel already has full schedule data — copy as-is.
    const scheduleRows = rawData.map(copyRow);
    csv.writeCsv(argv.output, scheduleRows, SCHEDULE_HEADERS);
    console.log(`Copied ${scheduleRows.length} rows to ${argv.output}`);
    return;
  }

  // --- Distribute mode: Excel only has recipient data, generate dates ---
  const senders = dataLoader.loadSenders();
  const templates = dataLoader.loadTemplates();
  const templateKeys = Object.keys(templates);
  const data = rawData;

  const startDate = argv['start-date'] ? dayjs(argv['start-date']) : dayjs();
  const startTime = argv['start-time'];
  const gapMinutes = argv['gap-minutes'];

  const distribution = {
    'Tuesday': 15, 'Wednesday': 18, 'Thursday': 20, 'Friday': 20, 'Sunday': 19,
  };

  const scheduleRows = [];
  let currentDate = startDate;
  let dataIndex = 0;

  while (dataIndex < data.length) {
    const dayName = currentDate.format('dddd');
    const targetPerSender = distribution[dayName];

    if (targetPerSender) {
      console.log(`Scheduling for ${currentDate.format('YYYY-MM-DD')} (${dayName})...`);

      for (let s = 0; s < senders.length; s++) {
        const sender = senders[s];
        const [hh, mm] = startTime.split(':');
        let senderTime = currentDate.hour(parseInt(hh)).minute(parseInt(mm)).second(0);

        for (let i = 0; i < targetPerSender; i++) {
          if (dataIndex >= data.length) break;

          const rawRow = data[dataIndex];
          const queueId = `Q-${currentDate.format('YYYYMMDD')}-${String(dataIndex + 1).padStart(6, '0')}`;

          const recipientEmail = rawRow['To Email'] || rawRow['recipient_email'] || rawRow['Email'] || rawRow['email'];
          const subject = rawRow['Subject'] || rawRow['subject'] || '';
          const templateKey = rawRow['Template'] || rawRow['template_key'] || templateKeys[0];

          scheduleRows.push({
            queue_id: queueId,
            sender_email: sender.sender_email,
            recipient_email: recipientEmail,
            subject: subject,
            template_key: templateKey,
            scheduled_at: senderTime.format('YYYY-MM-DD HH:mm'),
            category: rawRow['Category'] || rawRow['category'] || '',
            company_name: rawRow['Company'] || rawRow['company_name'] || rawRow['Company Name'] || '',
            website: rawRow['Website'] || rawRow['website'] || '',
            day_name: dayName,
            per_sender_sequence: i + 1,
            notes: '',
          });

          senderTime = senderTime.add(gapMinutes, 'minute');
          dataIndex++;
        }
      }
    }

    currentDate = currentDate.add(1, 'day');
    if (currentDate.diff(startDate, 'month') > 2) {
      console.log('Safety break: reached 2 months ahead.');
      break;
    }
  }

  csv.writeCsv(argv.output, scheduleRows, SCHEDULE_HEADERS);
  console.log(`Generated ${scheduleRows.length} schedule rows to ${argv.output}`);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
