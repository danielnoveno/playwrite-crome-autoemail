import React, { useEffect, useState } from 'react';
import { RefreshCw, Image } from 'lucide-react';
import { get, screenshotUrl } from '../api';

const ResultsPage: React.FC = () => {
  const [tab, setTab] = useState<'scheduled' | 'failed'>('scheduled');
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [failed, setFailed] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [s, f] = await Promise.all([get('/api/results/scheduled'), get('/api/results/failed')]);
      setScheduled(s.reverse());
      setFailed(f.reverse());
      setError('');
    } catch (e: any) { setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="table-section">
      <div className="form-row" style={{ marginBottom: '1.5rem', alignItems: 'center' }}>
        <div className="tab-group">
          <button className={`tab-btn ${tab === 'scheduled' ? 'active' : ''}`} onClick={() => setTab('scheduled')}>
            Scheduled ({scheduled.length})
          </button>
          <button className={`tab-btn ${tab === 'failed' ? 'active' : ''}`} onClick={() => setTab('failed')}>
            Failed ({failed.length})
          </button>
        </div>
        <button className="btn btn-small btn-outline" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>
      {error && <p className="error-text">{error}</p>}

      {tab === 'scheduled' ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Queue ID</th><th>Sender</th><th>Recipient</th><th>Subject</th><th>Scheduled At</th><th>Created</th></tr>
            </thead>
            <tbody>
              {scheduled.map((r, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.queue_id}</td>
                  <td>{r.sender_email}</td>
                  <td>{r.recipient_email}</td>
                  <td>{r.subject}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.scheduled_at}</td>
                  <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                    {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                  </td>
                </tr>
              ))}
              {scheduled.length === 0 && <tr><td colSpan={6} className="empty-cell">No successful schedules yet.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Queue ID</th><th>Sender</th><th>Recipient</th><th>Error</th><th>Failed At</th><th>Screenshot</th></tr>
            </thead>
            <tbody>
              {failed.map((r, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.queue_id}</td>
                  <td>{r.sender_email}</td>
                  <td>{r.recipient_email}</td>
                  <td>
                    <span className="status-badge row-failed"><span className="status-dot"></span>{r.error_code}</span>
                    <div className="text-muted" style={{ fontSize: '0.75rem', maxWidth: 320 }}>{r.error_message}</div>
                  </td>
                  <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                    {r.failed_at ? new Date(r.failed_at).toLocaleString() : ''}
                  </td>
                  <td>
                    {r.screenshot_path ? (
                      <a
                        className="btn btn-small btn-outline"
                        href={screenshotUrl(r.screenshot_path.split(/[\\/]/).pop())}
                        target="_blank" rel="noreferrer"
                      >
                        <Image size={14} /> View
                      </a>
                    ) : <span className="text-muted">—</span>}
                  </td>
                </tr>
              ))}
              {failed.length === 0 && <tr><td colSpan={6} className="empty-cell">No failures. 🎉</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ResultsPage;
