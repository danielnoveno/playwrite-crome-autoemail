const { chromium } = require('playwright');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const config = require('./config');
const dataLoader = require('./dataLoader');
const gmailUi = require('./gmailUi');

const argv = yargs(hideBin(process.argv))
  .option('sender', {
    type: 'string',
    description: 'Sender email to login',
  })
  .option('minutes', {
    type: 'number',
    default: 10,
    description: 'Time to wait for manual login in minutes',
  })
  .argv;

async function run() {
  const allSenders = dataLoader.loadSenders();
  const targetSenders = argv.sender 
    ? allSenders.filter(s => s.sender_email === argv.sender)
    : allSenders;

  if (targetSenders.length === 0) {
    console.log('No matching senders found.');
    return;
  }

  for (const sender of targetSenders) {
    console.log(`\nOpening browser for: ${sender.sender_email}`);
    console.log(`Profile directory: ${sender.profile_dir}`);
    
    const context = await chromium.launchPersistentContext(path.resolve(sender.profile_dir), {
      headless: false, // Always headful for manual login
      slowMo: config.SLOW_MO_MS,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await context.newPage();
    await gmailUi.openGmail(page);
    
    console.log(`Please login manually if required. Waiting for ${argv.minutes} minutes...`);
    
    // Wait for the specified time or until the user closes the browser
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, argv.minutes * 60 * 1000);
      context.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    await context.close();
    console.log(`Closed session for ${sender.sender_email}`);
  }
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
