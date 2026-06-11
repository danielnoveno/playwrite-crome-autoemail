const { chromium } = require('playwright');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const config = require('./config');
const dataLoader = require('./dataLoader');
const gmailUi = require('./gmailUi');
const dateHelper = require('./date');
const csv = require('./csv');

const argv = yargs(hideBin(process.argv))
  .option('dry-run', {
    type: 'boolean',
    default: false,
    description: 'Run without actually scheduling',
  })
  .option('limit', {
    type: 'number',
    description: 'Total limit of emails to schedule',
  })
  .option('limit-per-sender', {
    type: 'number',
    description: 'Limit of emails per sender',
  })
  .option('force', {
    type: 'boolean',
    default: false,
    description: 'Ignore already scheduled queue_ids',
  })
  .argv;

async function run() {
  console.log('--- Gmail Native Scheduler Starting ---');
  if (argv['dry-run']) console.log('MODE: DRY RUN');

  const senders = dataLoader.loadSenders();
  const templates = dataLoader.loadTemplates();
  const subjectPool = dataLoader.loadSubjects();
  let scheduleRows = dataLoader.loadScheduleRows();
  const alreadyScheduled = argv.force ? new Set() : dataLoader.loadAlreadyScheduledQueueIds();

  // Filter and sort
  scheduleRows = scheduleRows.filter(r => !alreadyScheduled.has(r.queue_id));
  scheduleRows = dateHelper.sortRowsByScheduledAt(scheduleRows);

  if (argv.limit) {
    scheduleRows = scheduleRows.slice(0, argv.limit);
  }

  const senderCounts = {};
  const finalRows = [];

  for (const row of scheduleRows) {
    const sender = row.sender_email;
    if (argv['limit-per-sender']) {
      senderCounts[sender] = (senderCounts[sender] || 0) + 1;
      if (senderCounts[sender] > argv['limit-per-sender']) continue;
    }
    finalRows.push(row);
  }

  console.log(`Total rows to process: ${finalRows.length}`);

  for (const row of finalRows) {
    try {
      dataLoader.validateRow(row);
      const sender = senders.find(s => s.sender_email === row.sender_email);
      if (!sender) throw new Error(`Sender account not found or disabled: ${row.sender_email}`);

      const subject = dataLoader.resolveSubject(row, subjectPool);
      const body = dataLoader.resolveBody(row, templates);
      const scheduledAt = dateHelper.parseJktDateTime(row.scheduled_at);

      console.log(`\n[${row.queue_id}] Sender: ${row.sender_email} -> ${row.recipient_email}`);
      console.log(`Subject: ${subject}`);
      console.log(`Scheduled At (JKT): ${row.scheduled_at}`);

      if (argv['dry-run']) {
        console.log('DRY RUN: Skipping browser automation.');
        continue;
      }

      const success = await processRow(sender, row, subject, body, scheduledAt);
      if (success) {
        csv.appendCsv(path.join(config.DATA_DIR, 'scheduled_results.csv'), {
          queue_id: row.queue_id,
          sender_email: row.sender_email,
          recipient_email: row.recipient_email,
          subject: subject,
          scheduled_at: row.scheduled_at,
          status: 'SUCCESS',
          scheduled_native_at: scheduledAt.toISOString(),
          created_at: new Date().toISOString(),
          notes: '',
        }, ['queue_id', 'sender_email', 'recipient_email', 'subject', 'scheduled_at', 'status', 'scheduled_native_at', 'created_at', 'notes']);
      }
    } catch (err) {
      console.error(`Error processing ${row.queue_id}:`, err.message);
      csv.appendCsv(path.join(config.DATA_DIR, 'failed_results.csv'), {
        queue_id: row.queue_id,
        sender_email: row.sender_email,
        recipient_email: row.recipient_email,
        subject: row.subject,
        scheduled_at: row.scheduled_at,
        error_code: err.message.includes('LOGIN_REQUIRED') ? 'LOGIN_REQUIRED' : 'ERROR',
        error_message: err.message,
        failed_at: new Date().toISOString(),
        screenshot_path: '',
      }, ['queue_id', 'sender_email', 'recipient_email', 'subject', 'scheduled_at', 'error_code', 'error_message', 'failed_at', 'screenshot_path']);
    }
  }

  console.log('\n--- Processing Finished ---');
}

async function processRow(sender, row, subject, body, scheduledAt) {
  let context;
  try {
    context = await chromium.launchPersistentContext(path.resolve(sender.profile_dir), {
      headless: config.HEADLESS,
      slowMo: config.SLOW_MO_MS,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await context.newPage();
    await gmailUi.openGmail(page);
    await gmailUi.ensureLoggedIn(page);
    
    await gmailUi.clickCompose(page);
    await gmailUi.fillRecipient(page, row.recipient_email);
    await gmailUi.fillSubject(page, subject);
    await gmailUi.fillBody(page, body);
    
    await gmailUi.openScheduleSend(page);
    await gmailUi.setScheduleDateTime(page, scheduledAt);
    await gmailUi.confirmSchedule(page);
    
    console.log('Successfully scheduled native.');
    return true;
  } catch (err) {
    if (context) {
      const screenshotPath = await gmailUi.takeFailureScreenshot(await context.pages()[0] || null, row.queue_id);
      console.log(`Screenshot saved: ${screenshotPath}`);
    }
    throw err;
  } finally {
    if (context) await context.close();
  }
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
