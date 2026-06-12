import React, { useEffect, useRef, useState } from 'react';
import { Upload, CheckCheck, RefreshCw, Plus, Trash2, Save } from 'lucide-react';
import { api, get, post, put, Job } from '../api';
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

interface Sender { sender_email: string; enabled: string; }
interface Template { template_key: string; }

// "2026-06-13 21:00" <-> datetime-local "2026-06-13T21:00"
const toLocal = (v: string) => (v || '').replace(' ', 'T');
const fromLocal = (v: string) => (v || '').replace('T', ' ');

const SchedulePage: React.FC = () => {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [logJobId, setLogJobId] = useState<string | null>(null);
  const [uploadedXlsx, setUploadedXlsx] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('21:00');
  const [gapMinutes, setGapMinutes] = useState('7');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Add Email form
  const [showAdd, setShowAdd] = useState(false);
  const [newSender, setNewSender] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newTemplate, setNewTemplate] = useState('');
  const [newWhen, setNewWhen] = useState('');

  const enabledSenders = senders.filter(s => s.enabled === 'true');

  const load = async () => {
    try {
      const [r, s, t] = await Promise.all([
        get<ScheduleRow[]>('/api/schedule'),
        get<Sender[]>('/api/senders'),
        get<Template[]>('/api/templates'),
      ]);
      setRows(r);
      setSenders(s);
      setTemplates(t);
      setDirty(false);
    } catch (e: any) { setMessage(e.message); }
  };
  useEffect(() => { load(); }, []);

  const addEmail = async () => {
    setMessage('');
    try {
      await post('/api/schedule/rows', {
        sender_email: newSender,
        recipient_email: newRecipient.trim(),
        subject: newSubject.trim(),
        template_key: newTemplate,
        scheduled_at: fromLocal(newWhen),
      });
      setNewRecipient(''); setNewSubject(''); setNewWhen('');
      setMessage('Email berhasil ditambahkan ke jadwal.');
      load();
    } catch (e: any) { setMessage(`Gagal menambah: ${e.message}`); }
  };

  const updateRow = (queueId: string, field: string, value: string) => {
    setRows(prev => prev.map(r => r.queue_id === queueId ? { ...r, [field]: value } : r));
    setDirty(true);
  };

  const deleteRow = (queueId: string) => {
    if (!confirm(`Hapus ${queueId} dari jadwal?`)) return;
    setRows(prev => prev.filter(r => r.queue_id !== queueId));
    setDirty(true);
  };

  const saveAll = async () => {
    try {
      // strip UI-only fields before writing back to CSV
      const clean = rows.map(({ status, error_code, ...rest }) => rest);
      await put('/api/schedule', { rows: clean });
      setMessage('Perubahan tersimpan (backup otomatis dibuat).');
      load();
    } catch (e: any) { setMessage(`Gagal menyimpan: ${e.message}`); }
  };

  const onUpload = async (file: File) => {
    setMessage('');
    const fd = new FormData();
    fd.append('file', file);
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    if (isCsv) {
      if (!confirm('CSV ini akan MENGGANTI seluruh jadwal (backup otomatis dibuat). Lanjut?')) return;
      fd.append('target', 'schedule');
    }
    try {
      const res = await api('/api/upload', { method: 'POST', body: fd });
      if (isCsv) {
        setMessage('Jadwal diganti. Klik Validate untuk memeriksa.');
        load();
      } else {
        setUploadedXlsx(res.path);
        setMessage('Excel ter-upload. Atur tanggal mulai lalu klik Convert.');
      }
    } catch (e: any) {
      setMessage(`Upload gagal: ${e.message}`);
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
        <h2>Tambah / Import Email</h2>
        <div className="form-row">
          <button className="btn" onClick={() => setShowAdd(v => !v)}>
            <Plus size={16} /> Tambah Email Satuan
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
          <button className="btn btn-outline" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Upload Excel / CSV
          </button>
          <button className="btn btn-outline" onClick={runValidate}>
            <CheckCheck size={16} /> Validate
          </button>
          <button className="btn btn-outline" onClick={load}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {showAdd && (
          <div className="convert-box">
            <div className="form-row">
              <label className="field"><span>Pengirim</span>
                <select value={newSender} onChange={e => setNewSender(e.target.value)}>
                  <option value="">— pilih akun —</option>
                  {enabledSenders.map(s => <option key={s.sender_email} value={s.sender_email}>{s.sender_email}</option>)}
                </select>
              </label>
              <label className="field"><span>Email Tujuan</span>
                <input placeholder="tujuan@email.com" value={newRecipient} onChange={e => setNewRecipient(e.target.value)} />
              </label>
              <label className="field"><span>Subject (kosongkan = pakai pool)</span>
                <input placeholder="opsional" value={newSubject} onChange={e => setNewSubject(e.target.value)} />
              </label>
              <label className="field"><span>Template</span>
                <select value={newTemplate} onChange={e => setNewTemplate(e.target.value)}>
                  <option value="">— pilih template —</option>
                  {templates.map(t => <option key={t.template_key} value={t.template_key}>{t.template_key}</option>)}
                </select>
              </label>
              <label className="field"><span>Jadwal Kirim (WIB)</span>
                <input type="datetime-local" value={newWhen} onChange={e => setNewWhen(e.target.value)} />
              </label>
              <button
                className="btn"
                style={{ alignSelf: 'flex-end' }}
                disabled={!newSender || !newRecipient || !newTemplate || !newWhen}
                onClick={addEmail}
              >
                Tambahkan
              </button>
            </div>
          </div>
        )}

        {uploadedXlsx && (
          <div className="convert-box">
            <div className="form-row">
              <label className="field"><span>Tanggal mulai</span>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </label>
              <label className="field"><span>Jam mulai (WIB)</span>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </label>
              <label className="field"><span>Jeda menit per pengirim</span>
                <input type="number" min="1" value={gapMinutes} onChange={e => setGapMinutes(e.target.value)} />
              </label>
              <button className="btn" style={{ alignSelf: 'flex-end' }} onClick={runConvert}>Convert</button>
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
        <div className="form-row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Daftar Jadwal ({rows.length})</h2>
          <button className="btn" onClick={saveAll} disabled={!dirty}>
            <Save size={16} /> Simpan Perubahan
          </button>
        </div>
        <div className="form-row" style={{ marginBottom: '1rem' }}>
          <input
            className="search-input"
            placeholder="Cari queue id, pengirim, tujuan, subject…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">Semua status</option>
            <option value="PENDING">Pending</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Queue ID</th><th>Pengirim</th><th>Tujuan</th><th>Subject</th>
                <th>Template</th><th>Jadwal (WIB)</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const editable = r.status === 'PENDING';
                return (
                  <tr key={r.queue_id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.queue_id}</td>
                    <td>
                      {editable ? (
                        <select className="cell-input" value={r.sender_email}
                          onChange={e => updateRow(r.queue_id, 'sender_email', e.target.value)}>
                          {!enabledSenders.find(s => s.sender_email === r.sender_email) && (
                            <option value={r.sender_email}>{r.sender_email} (tidak aktif!)</option>
                          )}
                          {enabledSenders.map(s => <option key={s.sender_email} value={s.sender_email}>{s.sender_email}</option>)}
                        </select>
                      ) : r.sender_email}
                    </td>
                    <td>
                      {editable ? (
                        <input className="cell-input" value={r.recipient_email}
                          onChange={e => updateRow(r.queue_id, 'recipient_email', e.target.value)} />
                      ) : r.recipient_email}
                    </td>
                    <td>
                      {editable ? (
                        <input className="cell-input" placeholder="(dari pool)" value={r.subject}
                          onChange={e => updateRow(r.queue_id, 'subject', e.target.value)} />
                      ) : (r.subject || <span className="text-muted">(dari pool)</span>)}
                    </td>
                    <td>
                      {editable ? (
                        <select className="cell-input" value={r.template_key}
                          onChange={e => updateRow(r.queue_id, 'template_key', e.target.value)}>
                          {!templates.find(t => t.template_key === r.template_key) && (
                            <option value={r.template_key}>{r.template_key} (?)</option>
                          )}
                          {templates.map(t => <option key={t.template_key} value={t.template_key}>{t.template_key}</option>)}
                        </select>
                      ) : r.template_key}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {editable ? (
                        <input className="cell-input" type="datetime-local" value={toLocal(r.scheduled_at)}
                          onChange={e => updateRow(r.queue_id, 'scheduled_at', fromLocal(e.target.value))} />
                      ) : r.scheduled_at}
                    </td>
                    <td>
                      <span className={`status-badge row-${r.status.toLowerCase()}`}>
                        <span className="status-dot"></span>{r.status}
                      </span>
                      {r.error_code && <div className="text-muted" style={{ fontSize: '0.7rem' }}>{r.error_code}</div>}
                    </td>
                    <td>
                      <button className="btn btn-small btn-danger" onClick={() => deleteRow(r.queue_id)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={8} className="empty-cell">Belum ada jadwal.</td></tr>}
            </tbody>
          </table>
        </div>
        {filtered.length > 300 && (
          <p className="text-muted" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
            Menampilkan 300 dari {filtered.length} baris — gunakan pencarian untuk mempersempit.
          </p>
        )}
      </div>
    </div>
  );
};

export default SchedulePage;
