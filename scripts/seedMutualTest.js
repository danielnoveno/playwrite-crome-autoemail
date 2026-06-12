// Generate a mutual-send test schedule: every enabled sender emails the
// other enabled senders in rotation. Appends to data/schedule_tracker.csv.
//
// Usage:
//   node scripts/seedMutualTest.js --per-sender=10 --start="2026-06-13 06:00" --gap-minutes=7
//   node scripts/seedMutualTest.js --per-sender=10   (start = 1 hour from now, rounded to 5 min)

const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const dayjs = require('dayjs');
const config = require('../src/config');
const csv = require('../src/csv');

const argv = yargs(hideBin(process.argv))
  .option('per-sender', { type: 'number', default: 10 })
  .option('start', { type: 'string', description: 'YYYY-MM-DD HH:mm (default: now + 1h)' })
  .option('gap-minutes', { type: 'number', default: 7 })
  .argv;

const HEADERS = [
  'queue_id', 'sender_email', 'recipient_email', 'subject', 'template_key',
  'scheduled_at', 'category', 'company_name', 'website', 'day_name',
  'per_sender_sequence', 'notes',
];

function run() {
  const senders = csv.readCsv(path.join(config.DATA_DIR, 'sender_accounts.csv'))
    .filter(s => s.enabled === 'true')
    .map(s => s.sender_email);
  if (senders.length < 2) {
    console.error('Need at least 2 enabled senders for a mutual test.');
    process.exit(1);
  }

  const templates = csv.readCsv(path.join(config.DATA_DIR, 'templates.csv')).map(t => t.template_key);
  if (templates.length === 0) {
    console.error('No templates found in templates.csv.');
    process.exit(1);
  }

  const existing = csv.readCsv(path.join(config.DATA_DIR, 'schedule_tracker.csv'));
  const existingIds = new Set(existing.map(r => r.queue_id));

  let start;
  if (argv.start) {
    start = dayjs(argv.start, 'YYYY-MM-DD HH:mm');
  } else {
    start = dayjs().add(1, 'hour');
    start = start.minute(Math.ceil(start.minute() / 5) * 5).second(0);
  }
  console.log(`Mutual test: ${senders.length} senders x ${argv['per-sender']} emails, start ${start.format('YYYY-MM-DD HH:mm')}, gap ${argv['gap-minutes']}m`);

  const rows = [];
  let tplIndex = 0;
  let idSeq = 1;

  senders.forEach((sender, sIdx) => {
    const others = senders.filter(s => s !== sender);
    // offset each sender a couple of minutes so sends don't all fire at :00
    let t = start.add(sIdx * 2, 'minute');

    for (let i = 0; i < argv['per-sender']; i++) {
      const recipient = others[i % others.length];
      const template = templates[tplIndex % templates.length];
      tplIndex += 1;

      let queueId;
      do {
        queueId = `Q-${t.format('YYYYMMDD')}-9${String(idSeq).padStart(5, '0')}`;
        idSeq += 1;
      } while (existingIds.has(queueId));
      existingIds.add(queueId);

      rows.push({
        queue_id: queueId,
        sender_email: sender,
        recipient_email: recipient,
        subject: '', // blank = rotated from subject_pool.csv
        template_key: template,
        scheduled_at: t.format('YYYY-MM-DD HH:mm'),
        category: 'mutual-test',
        company_name: '',
        website: '',
        day_name: t.format('dddd'),
        per_sender_sequence: String(i + 1),
        notes: 'internal warm-up test',
      });

      t = t.add(argv['gap-minutes'], 'minute');
    }
  });

  csv.writeCsv(path.join(config.DATA_DIR, 'schedule_tracker.csv'), [...existing, ...rows], HEADERS);
  console.log(`Appended ${rows.length} rows (existing ${existing.length} kept).`);
  rows.slice(0, 6).forEach(r => console.log(`  ${r.queue_id}  ${r.sender_email} -> ${r.recipient_email}  ${r.scheduled_at}  ${r.template_key}`));
  console.log('  …');
}

run();
