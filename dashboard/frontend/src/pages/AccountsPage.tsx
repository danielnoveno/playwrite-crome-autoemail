import React, { useEffect, useState } from 'react';
import { LogIn, Save, Plus, Trash2 } from 'lucide-react';
import { get, put, post, Job } from '../api';
import LogViewer from '../components/LogViewer';

interface Sender {
  sender_email: string;
  display_name: string;
  profile_dir: string;
  enabled: string;
}

const AccountsPage: React.FC = () => {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [loginJobId, setLoginJobId] = useState<string | null>(null);

  const load = async () => {
    try { setSenders(await get<Sender[]>('/api/senders')); setDirty(false); }
    catch (e: any) { setMessage(e.message); }
  };
  useEffect(() => { load(); }, []);

  const update = (i: number, field: keyof Sender, value: string) => {
    setSenders(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
    setDirty(true);
  };

  const addRow = () => {
    setSenders(prev => [...prev, { sender_email: '', display_name: '', profile_dir: '', enabled: 'true' }]);
    setDirty(true);
  };

  const removeRow = (i: number) => {
    if (!confirm(`Remove ${senders[i].sender_email || 'this row'} from sender_accounts.csv?`)) return;
    setSenders(prev => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const save = async () => {
    try {
      await put('/api/senders', { rows: senders.filter(s => s.sender_email.trim() !== '') });
      setMessage('Saved sender_accounts.csv (backup kept in data/backups).');
      load();
    } catch (e: any) { setMessage(`Save failed: ${e.message}`); }
  };

  const openLogin = async (sender?: string) => {
    try {
      const job = await post<Job>('/api/jobs/login', { sender, minutes: 15 });
      setLoginJobId(job.id);
      setMessage('Chrome will open ON THE WORKER PC. Someone must log in manually there within 15 minutes.');
    } catch (e: any) { setMessage(e.message); }
  };

  return (
    <div>
      <div className="table-section" style={{ marginBottom: '1.5rem' }}>
        <h2>Sender Accounts</h2>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
          One Gmail account = one persistent Chrome profile. The <em>Open Login</em> button opens a real Chrome window
          on the worker PC for manual login — it cannot appear in this browser tab.
        </p>
        <div className="form-row" style={{ marginBottom: '1rem' }}>
          <button className="btn btn-outline" onClick={addRow}><Plus size={16} /> Add Account</button>
          <button className="btn" onClick={save} disabled={!dirty}><Save size={16} /> Save Changes</button>
          <button className="btn btn-outline" onClick={() => openLogin(undefined)}><LogIn size={16} /> Open Login (all)</button>
        </div>
        {message && <p className="info-text">{message}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Email</th><th>Display Name</th><th>Profile Directory</th><th>Enabled</th><th></th></tr>
            </thead>
            <tbody>
              {senders.map((s, i) => (
                <tr key={i}>
                  <td><input className="cell-input" value={s.sender_email} onChange={e => update(i, 'sender_email', e.target.value)} placeholder="user@domain.com" /></td>
                  <td><input className="cell-input" value={s.display_name} onChange={e => update(i, 'display_name', e.target.value)} /></td>
                  <td><input className="cell-input mono" value={s.profile_dir} onChange={e => update(i, 'profile_dir', e.target.value)} placeholder="D:/gmail-scheduler/profiles/…" /></td>
                  <td>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={s.enabled === 'true'} onChange={e => update(i, 'enabled', e.target.checked ? 'true' : 'false')} />
                      {s.enabled === 'true' ? 'Active' : 'Off'}
                    </label>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-small btn-outline" onClick={() => openLogin(s.sender_email)} title="Open Chrome login window on worker PC">
                      <LogIn size={14} /> Login
                    </button>{' '}
                    <button className="btn btn-small btn-danger" onClick={() => removeRow(i)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {senders.length === 0 && <tr><td colSpan={5} className="empty-cell">No sender accounts.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {loginJobId && (
        <div className="table-section">
          <h2>Login Job Output</h2>
          <LogViewer jobId={loginJobId} />
        </div>
      )}
    </div>
  );
};

export default AccountsPage;
