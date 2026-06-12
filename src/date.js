const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');
const config = require('./config');

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

// Set default timezone
dayjs.tz.setDefault(config.DEFAULT_TIMEZONE);

function nowJkt() {
  // Returns current time in the default JKT timezone
  return dayjs().tz(config.DEFAULT_TIMEZONE);
}
  // Assuming value is YYYY-MM-DD HH:mm and in JKT timezone
  return dayjs.tz(value, 'YYYY-MM-DD HH:mm', config.DEFAULT_TIMEZONE);
}

function formatForGmailCustomDate(date) {
  // Gmail custom date picker format: MMM D, YYYY or depends on locale?
  // Usually it accepts "Jun 10, 2026"
  return date.format('MMM D, YYYY');
}

function formatForGmailCustomTime(date) {
  // Gmail custom time picker format: HH:mm
  return date.format('HH:mm');
}

function assertMinimumGapPerSender(rows, minGapMinutes = 7) {
  const senderGroups = {};
  
  rows.forEach(row => {
    if (!senderGroups[row.sender_email]) {
      senderGroups[row.sender_email] = [];
    }
    senderGroups[row.sender_email].push(row);
  });

  for (const sender in senderGroups) {
    const sorted = senderGroups[sender].sort((a, b) => 
      parseJktDateTime(a.scheduled_at).valueOf() - parseJktDateTime(b.scheduled_at).valueOf()
    );

    for (let i = 1; i < sorted.length; i++) {
      const prev = parseJktDateTime(sorted[i-1].scheduled_at);
      const curr = parseJktDateTime(sorted[i].scheduled_at);
      const diff = curr.diff(prev, 'minute');
      
      if (diff < minGapMinutes) {
        throw new Error(`Gap too small for ${sender}: ${sorted[i-1].queue_id} and ${sorted[i].queue_id} (${diff} min < ${minGapMinutes} min)`);
      }
    }
  }
  return true;
}

function sortRowsByScheduledAt(rows) {
  return [...rows].sort((a, b) => 
    parseJktDateTime(a.scheduled_at).valueOf() - parseJktDateTime(b.scheduled_at).valueOf()
  );
}

module.exports = {
  parseJktDateTime,
  formatForGmailCustomDate,
  formatForGmailCustomTime,
  assertMinimumGapPerSender,
  sortRowsByScheduledAt,
};
