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
    console.log(`\nMembuka Chrome untuk login akun: ${sender.sender_email}`);
    console.log(`Profile directory: ${sender.profile_dir}`);
    
    const context = await chromium.launchPersistentContext(path.resolve(sender.profile_dir), {
      headless: false,
      channel: 'chrome', // pakai Chrome asli, bukan Chromium bawaan Playwright
      slowMo: config.SLOW_MO_MS,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const page = await context.newPage();
    await page.setContent(`
      <html>
        <head><title>Login Gmail - ${sender.sender_email}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 48px; color: #111;">
          <h1 style="font-size: 28px; margin-bottom: 12px;">Login Gmail</h1>
          <p style="font-size: 18px; line-height: 1.6;">Chrome ini dibuka untuk login akun:</p>
          <p style="font-size: 24px; font-weight: 700; padding: 16px 20px; background: #fff7ed; border-left: 5px solid #fb923c; display: inline-block;">
            ${sender.sender_email}
          </p>
          <p style="font-size: 16px; color: #555; margin-top: 24px;">Sebentar lagi Gmail akan terbuka otomatis. Login sampai inbox muncul, lalu tutup Chrome.</p>
        </body>
      </html>
    `);
    await page.waitForTimeout(2500);
    // Buka halaman login Gmail langsung agar user bisa login
    await page.goto('https://mail.google.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    console.log(`Silakan login manual untuk ${sender.sender_email}. Menunggu ${argv.minutes} menit...`);
    
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
