const { chromium } = require('playwright');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const config = require('./config');
const dataLoader = require('./dataLoader');
const gmailUi = require('./gmailUi');
const dateHelper = require('./date');
const csv = require('./csv');

const FAILED_HEADERS = ['queue_id', 'sender_email', 'recipient_email', 'subject', 'scheduled_at', 'error_code', 'error_message', 'failed_at', 'screenshot_path'];

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

  // Drop rows with missing/invalid scheduled_at before sorting
  const invalidRows = scheduleRows.filter(r => !r.scheduled_at || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(r.scheduled_at));
  if (invalidRows.length > 0) {
    console.warn(`[SKIP] ${invalidRows.length} baris dilewati karena scheduled_at kosong/tidak valid:`);
    invalidRows.forEach(r => console.warn(`  ${r.queue_id} — "${r.scheduled_at}"`));
  }
  scheduleRows = scheduleRows.filter(r => r.scheduled_at && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(r.scheduled_at));
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
      if (!sender) {
        console.log(`[${row.queue_id}] Skipping – sender disabled or not found: ${row.sender_email}`);
        continue;
      }

      const subject = dataLoader.resolveSubject(row, subjectPool);
      const body = dataLoader.resolveBody(row, templates);
      const scheduledAt = dateHelper.parseJktDateTime(row.scheduled_at);

      // -------------------------------------------------------
      // Skip rows where the scheduled time is already in the past.
      // Gmail does not allow scheduling in the past, so we simply
      // log and continue. This also prevents unnecessary Playwright
      // work and confusing "SUCCESS" logs for dates that cannot be
      // processed.
      // -------------------------------------------------------
      const now = dateHelper.nowJkt(); // returns dayjs in JKT timezone
      if (scheduledAt.isBefore(now)) {
        const message = `Jadwal sudah lewat (${row.scheduled_at}). Ubah jadwal ke waktu mendatang lalu run lagi.`;
        console.log(`[${row.queue_id}] Failed - ${message}`);
        appendFailure(row, 'SCHEDULE_IN_PAST', message);
        continue;
      }

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
      appendFailure(row, err.message.includes('LOGIN_REQUIRED') ? 'LOGIN_REQUIRED' : 'ERROR', err.message, err.screenshotPath || '');
    }
  }

  console.log('\n--- Processing Finished ---');
}

async function processRow(sender, row, subject, body, scheduledAt) {
  let context;
  let page;
  try {
    context = await chromium.launchPersistentContext(path.resolve(sender.profile_dir), {
      headless: config.HEADLESS,
      channel: 'chrome', // harus sama dengan loginProfiles.js - profil dibuat oleh Chrome asli
      slowMo: config.SLOW_MO_MS,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    page = await context.newPage();
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
    // Screenshot the Gmail page itself, not context.pages()[0] which is
    // the initial blank tab of the persistent context.
    if (page) {
      try {
        err.screenshotPath = await gmailUi.takeFailureScreenshot(page, row.queue_id);
        console.log(`Screenshot saved: ${err.screenshotPath}`);
      } catch (_) { /* screenshot is best-effort */ }
    }
    throw err;
  } finally {
    if (context) await context.close();
  }
}

function appendFailure(row, errorCode, errorMessage, screenshotPath = '') {
  const failedPath = path.join(config.DATA_DIR, 'failed_results.csv');
  const exists = csv.readCsv(failedPath).some(r => r.queue_id === row.queue_id && r.error_code === errorCode);
  if (exists) return;
  csv.appendCsv(failedPath, {
    queue_id: row.queue_id,
    sender_email: row.sender_email,
    recipient_email: row.recipient_email,
    subject: row.subject,
    scheduled_at: row.scheduled_at,
    error_code: errorCode,
    error_message: errorMessage,
    failed_at: new Date().toISOString(),
    screenshot_path: screenshotPath,
  }, FAILED_HEADERS);
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
