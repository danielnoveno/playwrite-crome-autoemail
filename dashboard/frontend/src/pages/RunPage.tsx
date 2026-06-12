import React, { useEffect, useState } from 'react';
import { Play, FlaskConical, ShieldAlert, Trash2 } from 'lucide-react';
import { get, post, del, Job } from '../api';
import LogViewer from '../components/LogViewer';

const RunPage: React.FC = () => {
  const [dryRun, setDryRun] = useState(true);
  const [limit, setLimit] = useState('3');
  const [limitPerSender, setLimitPerSender] = useState('');
  const [force, setForce] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadJobs = async () => {
    try { setJobs(await get<Job[]>('/api/jobs')); } catch { /* server offline */ }
  };

  useEffect(() => {
    loadJobs();
    const t = setInterval(loadJobs, 5000);
    return () => clearInterval(t);
  }, []);

  const start = async (overrides: Partial<{ dryRun: boolean; limit: string; limitPerSender: string; force: boolean }> = {}) => {
    setError('');
    const payload = {
      dryRun: overrides.dryRun ?? dryRun,
      limit: (overrides.limit ?? limit) ? parseInt(overrides.limit ?? limit, 10) : undefined,
      limitPerSender: (overrides.limitPerSender ?? limitPerSender) ? parseInt(overrides.limitPerSender ?? limitPerSender, 10) : undefined,
      force: overrides.force ?? force,
    };
    if (!payload.dryRun && !payload.limit && !payload.limitPerSender) {
      if (!confirm('Run the FULL schedule without any limit? This opens Chrome and schedules every pending email.')) return;
    }
    try {
      const job = await post<Job>('/api/jobs/schedule', payload);
      setActiveJobId(job.id);
      loadJobs();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="table-section" style={{ marginBottom: '1.5rem' }}>
        <h2>Run Automation</h2>
        <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          The automation opens Chrome <strong>on the worker PC</strong>, composes each email and uses Gmail's native <strong>Schedule send</strong>.
          Always start with a dry run, then a small test.
        </p>

        <div className="form-row">
          <label className="checkbox-label">
            <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
            Dry run (no browser, just preview)
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
            Force (ignore duplicate check)
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>Total limit</span>
            <input type="number" min="0" placeholder="no limit" value={limit} onChange={e => setLimit(e.target.value)} />
          </label>
          <label className="field">
            <span>Limit per sender</span>
            <input type="number" min="0" placeholder="no limit" value={limitPerSender} onChange={e => setLimitPerSender(e.target.value)} />
          </label>
        </div>

        <div className="form-row" style={{ marginTop: '1rem' }}>
          <button className="btn" onClick={() => start()}>
            <Play size={16} /> Start with options above
          </button>
          <button className="btn btn-outline" onClick={() => start({ dryRun: true, limit: '3', limitPerSender: '', force: false })}>
            <FlaskConical size={16} /> Quick Dry Run (3)
          </button>
          <button className="btn btn-outline" onClick={() => start({ dryRun: false, limit: '3', limitPerSender: '', force: false })}>
            <FlaskConical size={16} /> Test Real (3 emails)
          </button>
          <button className="btn btn-outline" onClick={() => start({ dryRun: false, limit: '', limitPerSender: '1', force: false })}>
            <ShieldAlert size={16} /> 1 per sender
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      {activeJobId && (
        <div className="table-section" style={{ marginBottom: '1.5rem' }}>
          <h2>Live Output</h2>
          <LogViewer jobId={activeJobId} onStatusChange={() => loadJobs()} />
        </div>
      )}

      <div className="table-section">
        <div className="form-row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Job History</h2>
          <button
            className="btn btn-small btn-danger"
            onClick={async () => {
              if (!confirm('Hapus semua riwayat job dan file log-nya? (Job yang sedang berjalan tidak ikut terhapus)')) return;
              try {
                await del('/api/jobs');
                setActiveJobId(null);
                loadJobs();
              } catch (e: any) { setError(e.message); }
            }}
          >
            <Trash2 size={14} /> Hapus Riwayat
          </button>
        </div>
        <table>
          <thead>
            <tr><th>Job</th><th>Status</th><th>Started</th><th>Finished</th><th></th></tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{j.label}</div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>{j.command}</div>
                </td>
                <td><span className={`status-badge job-${j.status}`}><span className="status-dot"></span>{j.status}</span></td>
                <td className="text-muted">{new Date(j.startedAt).toLocaleString()}</td>
                <td className="text-muted">{j.endedAt ? new Date(j.endedAt).toLocaleString() : '—'}</td>
                <td>
                  <button className="btn btn-small btn-outline" onClick={() => setActiveJobId(j.id)}>View Logs</button>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && <tr><td colSpan={5} className="empty-cell">No jobs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RunPage;
