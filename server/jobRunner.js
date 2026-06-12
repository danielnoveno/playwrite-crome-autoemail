const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(ROOT, 'logs');

const MAX_LOG_LINES = 5000;
const MAX_JOBS_KEPT = 50;

// Jobs that open a real Chrome window / persistent profile.
// Only one of these may run at a time (never run the same profile in parallel).
const BROWSER_JOB_TYPES = new Set(['schedule', 'login']);

const jobs = new Map();
let seq = 0;

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function runningBrowserJob() {
  for (const job of jobs.values()) {
    if (job.status === 'running' && BROWSER_JOB_TYPES.has(job.type)) return job;
  }
  return null;
}

function pruneOldJobs() {
  if (jobs.size <= MAX_JOBS_KEPT) return;
  const finished = [...jobs.values()]
    .filter(j => j.status !== 'running')
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  while (jobs.size > MAX_JOBS_KEPT && finished.length > 0) {
    jobs.delete(finished.shift().id);
  }
}

/**
 * Start a node script as a tracked background job.
 * @param {string} type - job type: schedule | login | validate | convert
 * @param {string} script - path to the node script, relative to project root
 * @param {string[]} args - CLI arguments
 * @param {string} label - human readable description
 */
function startJob(type, script, args, label) {
  if (BROWSER_JOB_TYPES.has(type)) {
    const busy = runningBrowserJob();
    if (busy) {
      const err = new Error(
        `Another browser job is still running (${busy.type} ${busy.id}). ` +
        'Wait for it to finish or stop it first - Gmail profiles must never run in parallel.'
      );
      err.code = 'JOB_BUSY';
      throw err;
    }
  }

  ensureLogsDir();
  seq += 1;
  const id = `job-${Date.now()}-${seq}`;
  const logFile = path.join(LOGS_DIR, `${id}.log`);

  const job = {
    id,
    type,
    label: label || type,
    command: `node ${script} ${args.join(' ')}`.trim(),
    status: 'running',
    exitCode: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    lines: [],
    logFile,
    pid: null,
  };

  const child = spawn(process.execPath, [path.join(ROOT, script), ...args], {
    cwd: ROOT,
    env: process.env,
    windowsHide: true,
  });

  job.pid = child.pid;
  job._child = child;

  const pushChunk = (chunk, stream) => {
    const text = chunk.toString();
    try { fs.appendFileSync(logFile, text); } catch (_) { /* log file best-effort */ }
    for (const line of text.split(/\r?\n/)) {
      if (line.trim() === '') continue;
      job.lines.push({ t: new Date().toISOString(), s: stream, m: line });
    }
    if (job.lines.length > MAX_LOG_LINES) {
      job.lines.splice(0, job.lines.length - MAX_LOG_LINES);
    }
  };

  child.stdout.on('data', c => pushChunk(c, 'out'));
  child.stderr.on('data', c => pushChunk(c, 'err'));

  child.on('error', err => {
    pushChunk(`Failed to start process: ${err.message}\n`, 'err');
    job.status = 'failed';
    job.endedAt = new Date().toISOString();
  });

  child.on('exit', (code, signal) => {
    job.exitCode = code;
    job.endedAt = new Date().toISOString();
    if (job.status === 'stopping') {
      job.status = 'stopped';
    } else {
      job.status = code === 0 ? 'success' : 'failed';
    }
    pushChunk(`\n[process exited with code ${code}${signal ? `, signal ${signal}` : ''}]\n`, 'out');
    delete job._child;
  });

  jobs.set(id, job);
  pruneOldJobs();
  return publicJob(job);
}

function stopJob(id) {
  const job = jobs.get(id);
  if (!job) throw new Error(`Job not found: ${id}`);
  if (job.status !== 'running') return publicJob(job);

  job.status = 'stopping';
  if (process.platform === 'win32') {
    // Kill the whole process tree so the spawned Chrome closes too.
    spawn('taskkill', ['/pid', String(job.pid), '/t', '/f'], { windowsHide: true });
  } else if (job._child) {
    job._child.kill('SIGTERM');
  }
  return publicJob(job);
}

function publicJob(job) {
  return {
    id: job.id,
    type: job.type,
    label: job.label,
    command: job.command,
    status: job.status,
    exitCode: job.exitCode,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    lineCount: job.lines.length,
  };
}

function listJobs() {
  return [...jobs.values()]
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
    .map(publicJob);
}

function getJob(id) {
  const job = jobs.get(id);
  return job ? publicJob(job) : null;
}

function getJobLogs(id, offset = 0) {
  const job = jobs.get(id);
  if (!job) return null;
  const safeOffset = Math.max(0, Math.min(offset, job.lines.length));
  return {
    id: job.id,
    status: job.status,
    exitCode: job.exitCode,
    lines: job.lines.slice(safeOffset),
    nextOffset: job.lines.length,
  };
}

function clearFinishedJobs() {
  let cleared = 0;
  for (const [id, job] of jobs) {
    if (job.status === 'running' || job.status === 'stopping') continue;
    jobs.delete(id);
    cleared += 1;
    try { if (fs.existsSync(job.logFile)) fs.unlinkSync(job.logFile); } catch (_) { /* best-effort */ }
  }
  // Also remove orphan .log files left over from previous server runs.
  try {
    const activeLogs = new Set([...jobs.values()].map(j => path.basename(j.logFile)));
    for (const f of fs.readdirSync(LOGS_DIR)) {
      if (f.endsWith('.log') && !activeLogs.has(f)) {
        fs.unlinkSync(path.join(LOGS_DIR, f));
      }
    }
  } catch (_) { /* logs dir may not exist yet */ }
  return cleared;
}

module.exports = { startJob, stopJob, listJobs, getJob, getJobLogs, clearFinishedJobs };
