import React, { useEffect, useRef, useState } from 'react';
import { LogIn, Save, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { get, put, post, Job } from '../api';
import LogViewer from '../components/LogViewer';
import HelpBox from '../components/HelpBox';

interface Sender {
  sender_email: string;
  display_name: string;
  profile_dir: string;
  enabled: string;
}

const sanitizeEmail = (email: string) =>
  email.toLowerCase().replace(/[^a-z0-9@._-]/g, '_').replace(/@/g, '_at_');

const AccountsPage: React.FC = () => {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [profilesDir, setProfilesDir] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [message, setMessage] = useState('');
  const [loginJobId, setLoginJobId] = useState<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendersRef = useRef<Sender[]>([]);

  const load = async () => {
    try {
      const [s, cfg] = await Promise.all([
        get<Sender[]>('/api/senders'),
        get<{ PROFILES_DIR: string }>('/api/config'),
      ]);
      setSenders(s);
      sendersRef.current = s;
      setProfilesDir(cfg.PROFILES_DIR);
      setDirty(false);
    } catch (e: any) { setMessage(e.message); }
  };
  useEffect(() => { load(); }, []);

  const autoProfileDir = (email: string) =>
    profilesDir ? `${profilesDir}\\${sanitizeEmail(email)}` : '';

  const doSave = async (rows: Sender[]) => {
    setSaving(true);
    setSavedOk(false);
    try {
      await put('/api/senders', { rows: rows.filter(s => s.sender_email.trim() !== '') });
      setDirty(false);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch (e: any) {
      setMessage(`Auto-save gagal: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const update = (i: number, field: keyof Sender, value: string) => {
    setSenders(prev => {
      const next = prev.map((s, idx) => {
        if (idx !== i) return s;
        const updated = { ...s, [field]: value };
        // Auto-fill profile_dir when email changes and profile_dir is blank or was auto-generated
        if (field === 'sender_email') {
          const wasAuto = !s.profile_dir || s.profile_dir === autoProfileDir(s.sender_email);
          if (wasAuto) updated.profile_dir = autoProfileDir(value);
        }
        return updated;
      });
      sendersRef.current = next;
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => doSave(sendersRef.current), 800);
      return next;
    });
    setDirty(true);
  };

  const addRow = () => {
    setSenders(prev => {
      const next = [...prev, { sender_email: '', display_name: '', profile_dir: '', enabled: 'true' }];
      sendersRef.current = next;
      return next;
    });
    setDirty(true);
  };

  const removeRow = (i: number) => {
    if (!confirm(`Remove ${senders[i].sender_email || 'this row'} from sender_accounts.csv?`)) return;
    setSenders(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      sendersRef.current = next;
      doSave(next);
      return next;
    });
  };

  const save = async () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    await doSave(sendersRef.current);
  };

  const openLogin = async (sender?: string) => {
    try {
      const job = await post<Job>('/api/jobs/login', { sender, minutes: 15 });
      setLoginJobId(job.id);
      setMessage(sender
        ? `Chrome akan terbuka untuk login: ${sender}. Login manual sampai inbox Gmail muncul, lalu tutup Chrome.`
        : 'Chrome akan terbuka untuk Login Semua akun aktif satu per satu. Ikuti akun yang tampil di Gmail, login sampai inbox muncul, lalu tutup Chrome jika proses akun itu selesai.'
      );
    } catch (e: any) { setMessage(e.message); }
  };

  return (
    <div>
      <HelpBox
        title="Cara menambah & login akun pengirim"
        defaultOpen={senders.length === 0}
        steps={[
          { title: 'Klik "Tambah Akun"', desc: 'isi alamat Gmail yang akan dipakai kirim email.' },
          { title: 'Isi Display Name', desc: 'nama yang akan muncul sebagai pengirim di Gmail (opsional).' },
          { title: 'Klik tombol "Login"', desc: 'Chrome akan terbuka di PC ini. Login Gmail seperti biasa sampai masuk Inbox, lalu tutup Chrome.' },
          { title: 'Ulangi untuk semua akun', desc: 'setiap akun Gmail butuh login sekali. Setelah itu otomatis teringat selama session Chrome aktif.' },
        ]}
        tips={[
          'Profile Directory diisi otomatis — tidak perlu diubah.',
          'Kalau akun ter-logout (muncul error LOGIN_REQUIRED saat run), klik Login lagi untuk akun tersebut.',
          'Uncheck "Active" untuk menonaktifkan akun sementara tanpa menghapusnya.',
        ]}
      />
      <div className="table-section" style={{ marginBottom: '1.5rem' }}>
        <h2>Akun Pengirim</h2>
        {profilesDir && (
          <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
            📁 Profiles tersimpan di: <code style={{ background: '#f5f5f5', padding: '2px 6px' }}>{profilesDir}</code>
          </p>
        )}
        <div className="form-row" style={{ marginBottom: '1rem' }}>
          <button className="btn btn-outline" data-tour="accounts-add" onClick={addRow}><Plus size={16} /> Tambah Akun</button>
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? <><Save size={16} /> Menyimpan…</> : savedOk ? <><CheckCircle2 size={16} /> Tersimpan</> : <><Save size={16} /> Save</>}
          </button>
          <button className="btn btn-outline" onClick={() => openLogin(undefined)}><LogIn size={16} /> Login Semua</button>
        </div>
        {message && <p className="info-text">{message}</p>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Email</th><th>Display Name</th><th>Profile Directory (auto)</th><th>Enabled</th><th></th></tr>
            </thead>
            <tbody>
              {senders.map((s, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className="cell-input"
                      data-tour="accounts-email"
                      value={s.sender_email}
                      onChange={e => update(i, 'sender_email', e.target.value)}
                      placeholder="user@gmail.com"
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      data-tour="accounts-display"
                      value={s.display_name}
                      onChange={e => update(i, 'display_name', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input mono"
                      value={s.profile_dir || autoProfileDir(s.sender_email)}
                      onChange={e => update(i, 'profile_dir', e.target.value)}
                      placeholder={autoProfileDir(s.sender_email) || 'otomatis setelah isi email'}
                      title="Diisi otomatis — ubah hanya jika perlu"
                      style={{ color: '#737373', fontSize: '0.75rem' }}
                    />
                  </td>
                  <td>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={s.enabled === 'true'}
                        onChange={e => update(i, 'enabled', e.target.checked ? 'true' : 'false')}
                      />
                      {s.enabled === 'true' ? 'Active' : 'Off'}
                    </label>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-small btn-outline"
                      data-tour="accounts-login"
                      onClick={() => openLogin(s.sender_email)}
                      disabled={!s.sender_email}
                      title="Buka Chrome untuk login Gmail"
                    >
                      <LogIn size={14} /> Login
                    </button>{' '}
                    <button className="btn btn-small btn-danger" onClick={() => removeRow(i)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {senders.length === 0 && (
                <tr><td colSpan={5} className="empty-cell">Belum ada akun. Klik "Tambah Akun" untuk mulai.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {loginJobId && (
        <div className="table-section">
          <h2>Login Output</h2>
          <LogViewer jobId={loginJobId} />
        </div>
      )}
    </div>
  );
};

export default AccountsPage;
