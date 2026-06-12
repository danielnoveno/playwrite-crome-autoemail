import React, { useEffect, useRef, useState } from 'react';
import { Upload, CheckCheck, RefreshCw } from 'lucide-react';
import { api, get, post, Job } from '../api';
import LogViewer from '../components/LogViewer';

interface ScheduleRow {
  queue_id: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  template_key: string;
  scheduled_at: string;
  status: 'SCHEDULED' | 'FAILED' | 'PENDING';
  error_code: string;
  [key: string]: string;
}

const SchedulePage: React.FC = () => {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [logJobId, setLogJobId] = useState<string | null>(null);
  const [uploadedXlsx, setUploadedXlsx] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('21:00');
  const [gapMinutes, setGapMinutes] = useState('7');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try { setRows(await get<ScheduleRow[]>('/api/schedule')); } catch (e: any) { setMessage(e.message); }
  };
  useEffect(() => { load(); }, []);

  const onUpload = async (file: File) => {
    setMessage('');
    const fd = new FormData();
    fd.append('file', file);
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    if (isCsv) {
      if (!confirm('This CSV will REPLACE data/schedule_tracker.csv (a backup is kept). Continue?')) return;
      fd.append('target', 'schedule');
    }
    try {
      const res = await api('/api/upload', { method: 'POST', body: fd });
      if (isCsv) {
        setMessage('schedule_tracker.csv replaced. Run Validate to check it.');
        load();
      } else {
        setUploadedXlsx(res.path);
        setMessage(`Excel uploaded. Set the start date below and click Convert.`);
      }
    } catch (e: any) {
      setMessage(`Upload failed: ${e.message}`);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const runConvert = async () => {
    if (!uploadedXlsx) return;
    try {
      const job = await post<Job>('/api/jobs/convert', {
        input: uploadedXlsx,
        startDate: startDate || undefined,
        startTime,
        gapMinutes: parseInt(gapMinutes, 10) || 7,
      });
      setLogJobId(job.id);
    } catch (e: any) { setMessage(e.message); }
  };

  const runValidate = async () => {
    try {
      const job = await post<Job>('/api/jobs/validate');
      setLogJobId(job.id);
    } catch (e: any) { setMessage(e.message); }
  };

  const filtered = rows.filter(r => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return [r.queue_id, r.sender_email, r.recipient_email, r.subject, r.scheduled_at]
      .some(v => (v || '').toLowerCase().includes(q));
  });

  const shown = filtered.slice(0, 300);

  return (
    <div>
      <div className="table-section" style={{ marginBottom: '1.5rem' }}>
        <h2>Import & Validate</h2>
        <div className="form-row">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Upload Excel / CSV
          </button>
          <button className="btn btn-outline" onClick={runValidate}>
            <CheckCheck size={16} /> Validate Tracker
          </button>
          <button className="btn btn-outline" onClick={load}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {uploadedXlsx && (
          <div className="convert-box">
            <div className="form-row">
              <label className="field"><span>Start date (first scheduling day)</span>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </label>
              <label className="field"><span>Start time (JKT)</span>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </label>
              <label className="field"><span>Gap minutes per sender</span>
                <input type="number" min="1" value={gapMinutes} onChange={e => setGapMinutes(e.target.value)} />
              </label>
              <button className="btn" style={{ alignSelf: 'flex-end' }} onClick={runConvert}>Convert to Tracker</button>
            </div>
          </div>
        )}
        {message && <p className="info-text">{message}</p>}
      </div>

      {logJobId && (
        <div className="table-section" style={{ marginBottom: '1.5rem' }}>
          <h2>Output</h2>
          <LogViewer jobId={logJobId} onStatusChange={s => { if (s === 'success') load(); }} />
        </div>
      )}

      <div className="table-section">
        <h2>Schedule Tracker ({rows.length} rows)</h2>
        <div className="form-row" style={{ marginBottom: '1rem' }}>
          <input
            className="search-input"
            placeholder="Search queue id, sender, recipient, subject…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Queue ID</th><th>Sender</th><th>Recipient</th><th>Subject</th>
                <th>Template</th><th>Scheduled At (JKT)</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.queue_id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.queue_id}</td>
                  <td>{r.sender_email}</td>
                  <td>{r.recipient_email}</td>
                  <td>{r.subject || <span className="text-muted">(from pool)</span>}</td>
                  <td>{r.template_key}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.scheduled_at}</td>
                  <td>
                    <span className={`status-badge row-${r.status.toLowerCase()}`}>
                      <span className="status-dot"></span>{r.status}
                    </span>
                    {r.error_code && <div className="text-muted" style={{ fontSize: '0.7rem' }}>{r.error_code}</div>}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={7} className="empty-cell">No rows match.</td></tr>}
            </tbody>
          </table>
        </div>
        {filtered.length > 300 && (
          <p className="text-muted" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
            Showing first 300 of {filtered.length} matching rows — refine the search to see more.
          </p>
        )}
      </div>
    </div>
  );
};

export default SchedulePage;
