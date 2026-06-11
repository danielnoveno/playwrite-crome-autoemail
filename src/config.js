require('dotenv').config();
const path = require('path');

module.exports = {
  HEADLESS: process.env.HEADLESS === 'true',
  SLOW_MO_MS: parseInt(process.env.SLOW_MO_MS || '150'),
  GMAIL_URL: process.env.GMAIL_URL || 'https://mail.google.com/mail/u/0/#inbox',
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || 'Asia/Jakarta',
  MIN_GAP_MINUTES: parseInt(process.env.MIN_GAP_MINUTES || '7'),
  SCREENSHOT_DIR: path.resolve(process.env.SCREENSHOT_DIR || './screenshots'),
  LOGS_DIR: path.resolve(process.env.LOGS_DIR || './logs'),
  PROFILES_DIR: path.resolve(process.env.PROFILES_DIR || './profiles'),
  DATA_DIR: path.resolve(process.env.DATA_DIR || './data'),
};
