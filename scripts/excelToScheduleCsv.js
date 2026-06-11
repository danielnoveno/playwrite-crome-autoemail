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

const argv = yargs(hideBin(process.argv))
  .option('input', { type: 'string', demandOption: true })
  .option('output', { type: 'string', default: 'data/schedule_tracker.csv' })
  .option('start-date', { type: 'string', description: 'YYYY-MM-DD' })
  .option('start-time', { type: 'string', default: '21:00' })
  .option('gap-minutes', { type: 'number', default: 7 })
  .argv;

async function run() {
  console.log('--- Converting Excel to Schedule CSV ---');
  
  const workbook = xlsx.readFile(argv.input);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const senders = dataLoader.loadSenders();
  const templates = dataLoader.loadTemplates();
  const templateKeys = Object.keys(templates);

  const startDate = argv['start-date'] ? dayjs(argv['start-date']) : dayjs();
  const startTime = argv['start-time'];
  const gapMinutes = argv['gap-minutes'];

  // Distribution settings
  const distribution = {
    'Tuesday': 15,
    'Wednesday': 18,
    'Thursday': 20,
    'Friday': 20,
    'Sunday': 19,
  };

  const scheduleRows = [];
  let senderIndex = 0;
  let currentDate = startDate;
  
  // Group data by day based on distribution
  let dataIndex = 0;
  
  // We want to generate schedule for several weeks if needed, or just follow the distribution
  // Let's iterate day by day starting from startDate until all data is scheduled
  while (dataIndex < data.length) {
    const dayName = currentDate.format('dddd');
    const targetPerSender = distribution[dayName];

    if (targetPerSender) {
      console.log(`Scheduling for ${currentDate.format('YYYY-MM-DD')} (${dayName})...`);
      
      // For each sender, schedule targetPerSender emails
      for (let s = 0; s < senders.length; s++) {
        const sender = senders[s];
        let senderTime = currentDate.hour(parseInt(startTime.split(':')[0])).minute(parseInt(startTime.split(':')[1])).second(0);
        
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

  csv.writeCsv(argv.output, scheduleRows, [
    'queue_id', 'sender_email', 'recipient_email', 'subject', 'template_key', 
    'scheduled_at', 'category', 'company_name', 'website', 'day_name', 
    'per_sender_sequence', 'notes'
  ]);

  console.log(`Successfully converted ${scheduleRows.length} rows to ${argv.output}`);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
