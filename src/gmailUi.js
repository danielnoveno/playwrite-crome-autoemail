const path = require('path');
const config = require('./config');
require('dayjs/locale/id'); // Indonesian month names for Gmail in Bahasa Indonesia

async function openGmail(page) {
  await page.goto(config.GMAIL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
}

async function ensureLoggedIn(page) {
  // Check if we are on a login page
  const isLoginPage = page.url().includes('accounts.google.com') || page.url().includes('signin');
  if (isLoginPage) {
    throw new Error('LOGIN_REQUIRED');
  }

  // Check for some Gmail elements to confirm we are logged in
  try {
    const composeSelector = page.getByRole('button', { name: /(Compose|Tulis)/i }).first();
    await composeSelector.waitFor({ timeout: 60000 });
  } catch (e) {
    // Fallback to legacy selector in case role/button text changed
    try {
      const legacySelector = page.locator('text=/Compose|Tulis/i, .T-I-KE, [role="button"]:has-text("Compose"), [role="button"]:has-text("Tulis")').first();
      await legacySelector.waitFor({ timeout: 30000 });
    } catch (e2) {
      console.error(`[debug] ensureLoggedIn failed. URL: ${page.url()}, Title: ${await page.title()}`);
      const bodyText = await page.innerText('body');
      if (bodyText.includes('Verify it\'s you') || bodyText.includes('security check') || bodyText.includes('Verifikasi diri Anda')) {
        throw new Error('SECURITY_CHECK_REQUIRED');
      }
      throw new Error('GMAIL_NOT_LOADED');
    }
  }
}

async function clickCompose(page) {
  // Gmail "Compose" button usually has role="button" and text "Compose" or "Tulis"
  const composeBtn = page.locator('[role="button"]:has-text("Compose"), [role="button"]:has-text("Tulis"), .T-I-KE');
  await composeBtn.first().click();
  // Wait for the compose window to appear (usually "New Message" or "Pesan Baru" header)
  await page.locator('text=/New Message|Pesan Baru/i').first().waitFor({ timeout: 10000 });
}

async function fillRecipient(page, email) {
  // The "To" field is usually an input or a div with aria-label "To recipients" / "Kepada"
  const toField = page.locator('input[aria-label="To recipients"], [aria-label="To"] input, [aria-label="Kepada"] input, input[aria-label="Kepada"], input[name="to"], [name="to"] input, input[aria-label*="To" i], input[aria-label*="Kepada" i], [role="combobox"][aria-label*="To" i], [role="combobox"][aria-label*="Kepada" i]');
  await toField.first().fill(email);
  await page.keyboard.press('Enter');
}

async function fillSubject(page, subject) {
  const subjectField = page.locator('input[name="subjectbox"], [aria-label="Subject"], [aria-label="Subjek"], [aria-label*="Subject" i], [aria-label*="Subjek" i]');
  await subjectField.first().fill(subject);
}

async function fillBody(page, body) {
  // The body is usually a div with role="textbox" and aria-label "Message Body" or "Teks pesan"
  const bodyField = page.locator('[role="textbox"][aria-label="Message Body"], [role="textbox"][aria-label="Teks pesan"], [role="textbox"][aria-label*="Body" i], [role="textbox"][aria-label*="pesan" i], [role="textbox"]');
  await bodyField.first().fill(body);
}

async function openScheduleSend(page) {
  // The "More send options" button is next to "Send" ("Opsi pengiriman lain")
  const moreOptionsBtn = page.locator('[role="button"][aria-label*="More send options" i], [role="button"][aria-label*="Opsi pengiriman" i], [role="button"][aria-label*="pengiriman lain" i]');
  await moreOptionsBtn.first().click();

  // Now a menu appears, click "Schedule send" or "Jadwalkan pengiriman"
  const scheduleSendMenu = page.locator('[role="menuitem"]', { hasText: /Schedule send|Jadwalkan pengiriman/i });
  await scheduleSendMenu.first().click();
}

async function setScheduleDateTime(page, scheduledAtDayjs) {
  // Step 1: the Schedule-send popup shows preset options plus a
  // "Pick date & time" link - the custom date/time dialog only appears
  // after clicking it.
  const pickBtn = page.locator(
    'text=/Pick date & time|Pilih tanggal & waktu|Pilih tanggal dan waktu/i'
  ).first();
  await pickBtn.waitFor({ timeout: 10000 });
  await pickBtn.click();

  // Step 2: fill the date input inside the dialog.
  // Gmail validates the text against the account language: English UI
  // wants "Jun 13, 2026", Indonesian UI wants "13 Jun 2026". Try each
  // format until the "invalid date" warning disappears.
  const dateInput = page.locator('[role="dialog"] input[aria-label*="Date" i], [role="dialog"] input[aria-label*="Tanggal" i]').first();
  await dateInput.waitFor({ timeout: 10000 });

  const dateCandidates = [
    scheduledAtDayjs.format('MMM D, YYYY'),              // English Gmail
    scheduledAtDayjs.locale('id').format('D MMM YYYY'),  // Indonesian Gmail
    scheduledAtDayjs.format('YYYY-MM-DD'),               // last-resort ISO
  ];
  let dateAccepted = false;
  for (const candidate of dateCandidates) {
    await dateInput.click();
    await dateInput.fill(candidate);
    await page.keyboard.press('Tab'); // commit so Gmail validates
    await page.waitForTimeout(400);
    const invalid = await page
      .locator('text=/Invalid date|Tanggal tidak valid/i')
      .first()
      .isVisible()
      .catch(() => false);
    if (!invalid) { dateAccepted = true; break; }
  }
  if (!dateAccepted) {
    throw new Error(`DATE_FORMAT_REJECTED: Gmail refused all date formats for ${scheduledAtDayjs.format('YYYY-MM-DD')}`);
  }

  // Step 3: fill the time input. English Gmail expects "9:00 PM",
  // Indonesian Gmail usually accepts "21.00" / "21:00".
  const timeInput = page.locator('[role="dialog"] input[aria-label*="Time" i], [role="dialog"] input[aria-label*="Waktu" i]').last();
  await timeInput.waitFor({ timeout: 10000 });

  const timeCandidates = [
    scheduledAtDayjs.format('h:mm A'),  // English Gmail
    scheduledAtDayjs.format('HH:mm'),   // 24h with colon
    scheduledAtDayjs.format('HH.mm'),   // Indonesian style
  ];
  let timeAccepted = false;
  for (const candidate of timeCandidates) {
    await timeInput.click();
    await timeInput.fill(candidate);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(400);
    const invalid = await page
      .locator('text=/Invalid time|Waktu tidak valid|time is in the past|sudah berlalu/i')
      .first()
      .isVisible()
      .catch(() => false);
    if (!invalid) { timeAccepted = true; break; }
  }
  if (!timeAccepted) {
    throw new Error(`TIME_FORMAT_REJECTED: Gmail refused the time ${scheduledAtDayjs.format('HH:mm')} (wrong format or already in the past)`);
  }
}

async function confirmSchedule(page) {
  const confirmBtn = page.locator('button:has-text("Schedule send"), button:has-text("Jadwalkan pengiriman"), .Kj-JD-Jz button');
  // There might be two buttons with this text, one in the compose window and one in the dialog.
  // We want the one in the dialog which is usually the last one or has specific class.
  await confirmBtn.last().click();
  
  // Wait for "Send scheduled for..." or "dijadwalkan" toast or dialog to close
  await page.locator('text=/Send scheduled for|dijadwalkan/i').first().waitFor({ timeout: 10000 });
}

async function verifyScheduled(page, subject, recipient) {
  // Go to "Scheduled" label
  await page.goto(config.GMAIL_URL.replace('#inbox', '#scheduled'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  
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
