const path = require('path');
const config = require('./config');

async function openGmail(page) {
  await page.goto(config.GMAIL_URL, { waitUntil: 'networkidle' });
}

async function ensureLoggedIn(page) {
  // Check if we are on a login page
  const isLoginPage = page.url().includes('accounts.google.com');
  if (isLoginPage) {
    throw new Error('LOGIN_REQUIRED');
  }

  // Check for some Gmail elements to confirm we are logged in
  try {
    await page.waitForSelector('text=Compose', { timeout: 15000 });
  } catch (e) {
    // Check if security check is required
    const bodyText = await page.innerText('body');
    if (bodyText.includes('Verify it\'s you') || bodyText.includes('security check')) {
      throw new Error('SECURITY_CHECK_REQUIRED');
    }
    throw new Error('GMAIL_NOT_LOADED');
  }
}

async function clickCompose(page) {
  // Gmail "Compose" button usually has role="button" and text "Compose"
  const composeBtn = page.getByRole('button', { name: 'Compose' });
  await composeBtn.click();
  // Wait for the compose window to appear (usually "New Message" header)
  await page.waitForSelector('text=New Message', { timeout: 10000 });
}

async function fillRecipient(page, email) {
  // The "To" field is usually an input or a div with aria-label "To"
  // Try different ways to find it
  const toField = page.locator('input[aria-label="To recipients"], [aria-label="To"] input, [name="to"]');
  await toField.first().fill(email);
  await page.keyboard.press('Enter');
}

async function fillSubject(page, subject) {
  const subjectField = page.locator('input[name="subjectbox"], [aria-label="Subject"]');
  await subjectField.fill(subject);
}

async function fillBody(page, body) {
  // The body is usually a div with role="textbox" and aria-label "Message Body"
  const bodyField = page.locator('[role="textbox"][aria-label="Message Body"]');
  await bodyField.fill(body);
}

async function openScheduleSend(page) {
  // The "More send options" button is next to "Send"
  const moreOptionsBtn = page.getByRole('button', { name: 'More send options' });
  await moreOptionsBtn.click();

  // Now a menu appears, click "Schedule send"
  const scheduleSendMenu = page.getByRole('menuitem', { name: 'Schedule send' });
  await scheduleSendMenu.click();
}

async function setScheduleDateTime(page, scheduledAtDayjs) {
  // Wait for "Schedule send" dialog
  await page.waitForSelector('text=Schedule send', { timeout: 5000 });

  // Click "Pick date & time"
  const pickDateTimeBtn = page.getByText('Pick date & time');
  await pickDateTimeBtn.click();

  // Now the custom picker appears
  // Date input: usually an input field
  // Time input: usually an input field
  
  // Gmail's date picker is tricky. Sometimes it's better to just fill the input if it exists.
  // The date input usually has an aria-label or is the first input in the dialog
  const dateInput = page.locator('.Kj-JD-Jz input').first(); // Fallback selector for Gmail dialog inputs
  await dateInput.fill(scheduledAtDayjs.format('MMM D, YYYY'));
  
  const timeInput = page.locator('.Kj-JD-Jz input').last();
  await timeInput.fill(scheduledAtDayjs.format('HH:mm'));
  
  // Press Enter to confirm if needed or click "Schedule send" button in dialog
}

async function confirmSchedule(page) {
  const confirmBtn = page.getByRole('button', { name: 'Schedule send' }).filter({ hasText: 'Schedule send' });
  // There might be two buttons with this text, one in the compose window and one in the dialog.
  // We want the one in the dialog which is usually the last one or has specific class.
  await confirmBtn.last().click();
  
  // Wait for "Send scheduled for..." toast or dialog to close
  await page.waitForSelector('text=Send scheduled for', { timeout: 10000 });
}

async function verifyScheduled(page, subject, recipient) {
  // Go to "Scheduled" label
  await page.goto(config.GMAIL_URL.replace('#inbox', '#scheduled'), { waitUntil: 'networkidle' });
  
  // Check if the email is in the list
  const list = page.locator('div[role="main"]');
  const text = await list.innerText();
  if (!text.includes(subject)) {
    throw new Error(`Email with subject "${subject}" not found in Scheduled folder`);
  }
}

async function takeFailureScreenshot(page, queueId) {
  const fileName = `failed_${queueId}_${Date.now()}.png`;
  const filePath = path.join(config.SCREENSHOT_DIR, fileName);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

module.exports = {
  openGmail,
  ensureLoggedIn,
  clickCompose,
  fillRecipient,
  fillSubject,
  fillBody,
  openScheduleSend,
  setScheduleDateTime,
  confirmSchedule,
  verifyScheduled,
  takeFailureScreenshot,
};
