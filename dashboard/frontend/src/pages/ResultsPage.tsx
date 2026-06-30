import React, { useEffect, useState } from 'react';
import { RefreshCw, Image, Trash2, RotateCcw } from 'lucide-react';
import { get, del, post, screenshotUrl } from '../api';

const ResultsPage: React.FC = () => {
  const [tab, setTab] = useState<'scheduled' | 'failed'>('scheduled');
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [failed, setFailed] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      const [s, f] = await Promise.all([get('/api/results/scheduled'), get('/api/results/failed')]);
      setScheduled(s.reverse());
      setFailed(f.reverse());
      setError('');
    } catch (e: any) { setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  const retry = async (queue_id: string) => {
    setRetrying(prev => new Set(prev).add(queue_id));
    try {
      const res = await post('/api/results/failed/retry', { queue_id });
      alert(`✅ Dijadwalkan ulang!\nQueue ID baru: ${res.new_queue_id}\nWaktu: ${res.scheduled_at}`);
      load();
    } catch (e: any) {
      alert(`❌ Gagal retry: ${e.message}`);
    } finally {
      setRetrying(prev => { const s = new Set(prev); s.delete(queue_id); return s; });
    }
  };

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
        {tab === 'failed' && failed.length > 0 && (<>
          <button
            className="btn btn-small btn-outline"
            onClick={async () => {
              if (!confirm(`Retry semua ${failed.length} email gagal dengan waktu jadwal aslinya?`)) return;
              try {
                const res = await post('/api/results/failed/retry-all', {});
                alert(`✅ ${res.retried} email dijadwalkan ulang.${res.skipped ? `\n⚠️ ${res.skipped} dilewati (tidak ada di schedule tracker).` : ''}`);
                load();
              } catch (e: any) { setError(e.message); }
            }}
          >
            <RotateCcw size={14} /> Retry All ({failed.length})
          </button>
          <button
            className="btn btn-small btn-danger"
            onClick={async () => {
              if (!confirm('Hapus semua log Failed? (Backup otomatis disimpan di data/backups)')) return;
              try { await del('/api/results/failed'); load(); } catch (e: any) { setError(e.message); }
            }}
          >
            <Trash2 size={14} /> Hapus Semua Failed
          </button>
        </>)}
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
              <tr><th>Queue ID</th><th>Sender</th><th>Recipient</th><th>Error</th><th>Failed At</th><th>Screenshot</th><th>Action</th></tr>
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
                  <td>
                    <button
                      className="btn btn-small btn-outline"
                      disabled={retrying.has(r.queue_id)}
                      onClick={() => retry(r.queue_id)}
                      title="Jadwalkan ulang email ini sekarang"
                    >
                      <RotateCcw size={14} />
                      {retrying.has(r.queue_id) ? ' ...' : ' Retry'}
                    </button>
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
