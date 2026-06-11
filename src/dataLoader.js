const path = require('path');
const config = require('./config');
const csv = require('./csv');

function loadSenders() {
  const filePath = path.join(config.DATA_DIR, 'sender_accounts.csv');
  return csv.readCsv(filePath).filter(s => s.enabled === 'true');
}

function loadTemplates() {
  const filePath = path.join(config.DATA_DIR, 'templates.csv');
  const rows = csv.readCsv(filePath);
  const map = {};
  rows.forEach(r => {
    map[r.template_key] = r.body;
  });
  return map;
}

function loadSubjects() {
  const filePath = path.join(config.DATA_DIR, 'subject_pool.csv');
  return csv.readCsv(filePath);
}

function loadScheduleRows() {
  const filePath = path.join(config.DATA_DIR, 'schedule_tracker.csv');
  return csv.readCsv(filePath);
}

function loadAlreadyScheduledQueueIds() {
  const filePath = path.join(config.DATA_DIR, 'scheduled_results.csv');
  const rows = csv.readCsv(filePath);
  return new Set(rows.map(r => r.queue_id));
}

let subjectRotationIndex = 0;
function resolveSubject(row, subjectPool) {
  if (row.subject && row.subject.trim() !== '') {
    return row.subject;
  }
  if (!subjectPool || subjectPool.length === 0) {
    return '(no subject)';
  }
  const subjectObj = subjectPool[subjectRotationIndex % subjectPool.length];
  subjectRotationIndex++;
  return subjectObj.subject;
}

function resolveBody(row, templates) {
  const body = templates[row.template_key];
  if (!body) {
    throw new Error(`Template not found: ${row.template_key}`);
  }
  return body;
}

function validateRow(row) {
  if (!row.queue_id) throw new Error('Missing queue_id');
  if (!row.sender_email) throw new Error(`Missing sender_email for ${row.queue_id}`);
  if (!row.recipient_email) throw new Error(`Missing recipient_email for ${row.queue_id}`);
  if (!row.scheduled_at) throw new Error(`Missing scheduled_at for ${row.queue_id}`);
  if (!row.template_key) throw new Error(`Missing template_key for ${row.queue_id}`);
  return true;
}

module.exports = {
  loadSenders,
  loadTemplates,
  loadSubjects,
  loadScheduleRows,
  loadAlreadyScheduledQueueIds,
  resolveSubject,
  resolveBody,
  validateRow,
};
