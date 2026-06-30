import React, { useEffect, useState } from 'react';
import { Play, FlaskConical, ShieldAlert, Trash2, RotateCcw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { get, post, del, Job } from '../api';
import LogViewer from '../components/LogViewer';
import HelpBox from '../components/HelpBox';

interface Stats {
  schedule_total: number;
  schedule_pending: number;
  scheduled_success: number;
  failed_total: number;
}

const RunPage: React.FC = () => {
  const [dryRun, setDryRun] = useState(true);
  const [limit, setLimit] = useState('3');
  const [limitPerSender, setLimitPerSender] = useState('');
  const [force, setForce] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const loadJobs = async () => {
    try { setJobs(await get<Job[]>('/api/jobs')); } catch { /* server offline */ }
  };

  const loadStats = async () => {
    try { setStats(await get<Stats>('/api/stats')); } catch { /* ignore */ }
  };

  useEffect(() => {
    loadJobs();
    loadStats();
    const t = setInterval(() => { loadJobs(); loadStats(); }, 5000);
    return () => clearInterval(t);
  }, []);

  const start = async (overrides: Partial<{ dryRun: boolean; limit: string; limitPerSender: string; force: boolean }> = {}) => {
    setError(''); setMsg('');
    const payload = {
      dryRun: overrides.dryRun ?? dryRun,
      limit: (overrides.limit ?? limit) ? parseInt(overrides.limit ?? limit, 10) : undefined,
      limitPerSender: (overrides.limitPerSender ?? limitPerSender) ? parseInt(overrides.limitPerSender ?? limitPerSender, 10) : undefined,
      force: overrides.force ?? force,
    };
    if (payload.force && !confirm('Force bisa membuat email duplikat di Gmail karena cek riwayat diabaikan. Lanjut hanya jika benar-benar paham risikonya.')) return;
    if (!payload.dryRun && !payload.limit && !payload.limitPerSender) {
      if (!confirm(`Jalankan SEMUA ${stats?.schedule_pending ?? ''} email pending? Chrome akan terbuka dan memproses semuanya.`)) return;
    }
    try {
      const job = await post<Job>('/api/jobs/schedule', payload);
      setActiveJobId(job.id);
      loadJobs();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const resume = async () => {
    setError(''); setMsg('');
    if (!confirm(`Lanjut dari terakhir? Sistem otomatis skip ${stats?.scheduled_success ?? 0} email yang sudah terjadwal dan proses ${stats?.schedule_pending ?? 0} sisanya.`)) return;
    try {
      const job = await post<Job>('/api/jobs/schedule', { dryRun: false });
      setActiveJobId(job.id);
      loadJobs();
    } catch (e: any) { setError(e.message); }
  };

  const resetScheduled = async () => {
    if (!confirm('RESET riwayat scheduled?\n\nIni akan menghapus catatan email yang sudah terjadwal — automasi akan menganggap semua baris PENDING lagi dan bisa menjadwalkan duplikat di Gmail.\n\nGunakan hanya jika benar-benar perlu mulai ulang dari nol.')) return;
    try {
      await del('/api/results/scheduled');
      setMsg('Riwayat scheduled direset. Backup tersimpan di data/backups/.');
      loadStats();
    } catch (e: any) { setError(e.message); }
  };

  const pct = stats && stats.schedule_total > 0
    ? Math.round((stats.scheduled_success / stats.schedule_total) * 100)
    : 0;

  return (
    <div>
      <HelpBox
        title="Cara aman menjalankan automasi pengiriman email"
        steps={[
          { title: '1. Cek Data dulu', desc: 'klik "Cek Data" untuk melihat preview tanpa membuka browser dan tanpa menjadwalkan email.' },
          { title: '2. Test 3 Email', desc: 'klik "Test 3 Email". Chrome akan terbuka dan menjadwalkan 3 email pertama. Cek folder Scheduled di Gmail.' },
          { title: '3. Jalankan Semua', desc: 'kalau test berhasil, klik "Jalankan Semua Pending" atau "Lanjut / Resume" untuk memproses sisa jadwal.' },
        ]}
        tips={[
          'Sistem otomatis mengecek jadwal sebelum run nyata. Kalau ada error, browser tidak akan dijalankan.',
          'Chrome harus terbuka di PC ini saat run — jangan tutup Chrome yang terbuka otomatis.',
          'Kalau muncul error LOGIN_REQUIRED, pergi ke Accounts dan klik Login untuk akun tersebut.',
          'Kalau muncul error Timeout, biasanya Gmail lambat — coba run lagi, biasanya berhasil di percobaan berikutnya.',
        ]}
      />
      {/* ── Progress bar ── */}
      {stats && (
        <div className="table-section" style={{ marginBottom: '1.5rem' }}>
          <h2>Status Pengiriman</h2>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} color="#16a34a" />
              <span style={{ fontWeight: 600 }}>{stats.scheduled_success}</span>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>terjadwal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} color="#737373" />
              <span style={{ fontWeight: 600 }}>{stats.schedule_pending}</span>
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>pending</span>
            </div>
            {stats.failed_total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} color="#dc2626" />
                <span style={{ fontWeight: 600, color: '#dc2626' }}>{stats.failed_total}</span>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>gagal</span>
              </div>
            )}
            <span className="text-muted" style={{ fontSize: '0.85rem', marginLeft: 'auto' }}>
              {pct}% dari {stats.schedule_total} total
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ height: 8, background: '#f5f5f5', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#16a34a', transition: 'width 0.5s' }} />
          </div>

          {/* Resume section */}
          {stats.scheduled_success > 0 && stats.schedule_pending > 0 && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4 }}>
              <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                <strong>Lanjut dari titik terakhir?</strong> {stats.scheduled_success} email sudah terjadwal akan di-skip otomatis.
                Hanya {stats.schedule_pending} yang belum akan diproses.
              </p>
              <button className="btn" onClick={resume} style={{ background: '#16a34a', borderColor: '#16a34a' }}>
                <RotateCcw size={16} /> Lanjut / Resume ({stats.schedule_pending} pending)
              </button>
            </div>
          )}

          {/* Team sync warning */}
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#fefce8', border: '1px solid #fde047', fontSize: '0.8rem' }}>
            <strong>Untuk team multi-laptop:</strong> Tiap laptop punya catatan sendiri. Kalau laptop lain sudah menjadwalkan sebagian,
            copy file <code>scheduled_results.csv</code> dari AppData laptop itu ke laptop ini sebelum run — supaya tidak duplikat.
          </div>
        </div>
      )}

      {/* ── Run options ── */}
      <div className="table-section" style={{ marginBottom: '1.5rem' }}>
        <h2>Jalankan Automation</h2>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
          Gunakan urutan aman: Cek Data → Test 3 Email → Jalankan Semua Pending.
        </p>
        <div className="form-row" style={{ marginBottom: '1rem' }}>
          <label className="checkbox-label">
            <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
            Cek data saja (tidak buka browser)
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>Total limit</span>
            <input type="number" min="0" placeholder="tanpa batas" value={limit} onChange={e => setLimit(e.target.value)} />
          </label>
          <label className="field">
            <span>Limit per sender</span>
            <input type="number" min="0" placeholder="tanpa batas" value={limitPerSender} onChange={e => setLimitPerSender(e.target.value)} />
          </label>
        </div>

        <div className="form-row" style={{ marginTop: '1rem' }}>
          <button className="btn btn-outline" data-tour="run-check" onClick={() => start({ dryRun: true, limit: '3', limitPerSender: '', force: false })}>
            <ShieldAlert size={16} /> Cek Data
          </button>
          <button className="btn btn-outline" data-tour="run-test" onClick={() => start({ dryRun: false, limit: '3', limitPerSender: '', force: false })}>
            <FlaskConical size={16} /> Test 3 Email
          </button>
          <button className="btn" onClick={() => start()}>
            <Play size={16} /> {dryRun ? 'Mulai Cek Data' : 'Jalankan'}
          </button>
        </div>
        <button
          className="btn btn-small btn-outline"
          style={{ marginTop: '1rem' }}
          onClick={() => setAdvancedOpen(v => !v)}
        >
          Opsi Advanced
        </button>
        {advancedOpen && (
          <div className="convert-box" style={{ marginTop: '1rem' }}>
            <label className="checkbox-label">
              <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
              Force: abaikan cek duplikat scheduled_results.csv
            </label>
            <p className="error-text" style={{ marginTop: '0.75rem' }}>
              Hati-hati: Force bisa membuat email yang sama dijadwalkan dua kali di Gmail. Jangan aktifkan untuk pemakaian normal.
            </p>
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
        {msg && <p className="info-text">{msg}</p>}
      </div>

      {/* ── Live output ── */}
      {activeJobId && (
        <div className="table-section" style={{ marginBottom: '1.5rem' }}>
          <h2>Live Output</h2>
          <LogViewer jobId={activeJobId} onStatusChange={() => { loadJobs(); loadStats(); }} />
        </div>
      )}

      {/* ── Job history ── */}
      <div className="table-section" style={{ marginBottom: '1.5rem' }}>
        <div className="form-row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Riwayat Job</h2>
          <button
            className="btn btn-small btn-danger"
            onClick={async () => {
              if (!confirm('Hapus semua riwayat job dan log-nya?')) return;
              try { await del('/api/jobs'); setActiveJobId(null); loadJobs(); }
              catch (e: any) { setError(e.message); }
            }}
          >
            <Trash2 size={14} /> Hapus Riwayat
          </button>
        </div>
        <table>
          <thead>
            <tr><th>Job</th><th>Status</th><th>Mulai</th><th>Selesai</th><th></th></tr>
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
                <td><button className="btn btn-small btn-outline" onClick={() => setActiveJobId(j.id)}>Logs</button></td>
              </tr>
            ))}
            {jobs.length === 0 && <tr><td colSpan={5} className="empty-cell">Belum ada job.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ── Danger zone ── */}
      <div className="table-section">
        <h2>Danger Zone</h2>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
          Reset riwayat scheduled hanya jika ingin mulai ulang dari nol. Backup otomatis dibuat sebelum dihapus.
        </p>
        <button className="btn btn-danger" onClick={resetScheduled}>
          <RotateCcw size={16} /> Reset Riwayat Scheduled (mulai dari nol)
        </button>
      </div>
    </div>
  );
};

export default RunPage;
