import React, { useEffect, useState } from 'react';
import { Mail, CheckCircle2, XCircle, FileText, Clock, Users, ArrowRight, AlertTriangle } from 'lucide-react';
import { get, Job } from '../api';

interface Stats {
  senders_total: number;
  senders_enabled: number;
  schedule_total: number;
  schedule_pending: number;
  scheduled_success: number;
  failed_total: number;
  templates_total: number;
  subjects_total: number;
  per_sender_pending: Record<string, number>;
}

const Step: React.FC<{
  num: number; done: boolean; title: string; desc: string; action?: string; page?: string;
  onClick?: () => void;
}> = ({ num, done, title, desc, action, onClick }) => (
  <div style={{
    display: 'flex', gap: '1rem', padding: '1rem 1.25rem',
    background: done ? '#f0fdf4' : '#fff',
    border: `1px solid ${done ? '#bbf7d0' : '#e5e5e5'}`,
    borderRadius: 6, marginBottom: '0.75rem',
    opacity: 1,
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: done ? '#16a34a' : '#000', color: '#fff',
      fontWeight: 700, fontSize: '0.875rem',
    }}>
      {done ? <CheckCircle2 size={18} /> : num}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem', color: done ? '#15803d' : '#000' }}>
        {title}
      </div>
      <div style={{ fontSize: '0.8rem', color: '#737373', lineHeight: 1.5 }}>{desc}</div>
    </div>
    {!done && action && onClick && (
      <button
        onClick={onClick}
        style={{
          alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.4rem 0.9rem', background: '#000', color: '#fff', border: 'none',
          borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
          whiteSpace: 'nowrap', fontFamily: 'inherit',
        }}
      >
        {action} <ArrowRight size={14} />
      </button>
    )}
  </div>
);

interface OverviewProps { onNavigate?: (page: string) => void; }

const Overview: React.FC<OverviewProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [s, j] = await Promise.all([get<Stats>('/api/stats'), get<Job[]>('/api/jobs')]);
      setStats(s); setJobs(j.slice(0, 5)); setError('');
    } catch (e: any) { setError(e.message); }
  };

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  if (error) return (
    <div className="empty-state">
      <p><strong>Tidak bisa terhubung ke server.</strong></p>
      <p className="text-muted">{error}</p>
    </div>
  );
  if (!stats) return <div className="empty-state">Memuat…</div>;

  const step1Done = stats.senders_enabled > 0;
  const step2Done = stats.schedule_total > 0;
  const step3Done = step1Done && step2Done;
  const step4Done = stats.scheduled_success > 0;
  const allSetup = step1Done && step2Done;
  const pct = stats.schedule_total > 0 ? Math.round((stats.scheduled_success / stats.schedule_total) * 100) : 0;

  return (
    <div>
      {/* ── Setup Guide ── */}
      {!allSetup && (
        <div className="table-section" style={{ marginBottom: '1.5rem', borderColor: '#0284c7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.5rem' }}>👋</span>
            <div>
              <h2 style={{ margin: 0 }}>Selamat Datang di Gmail Scheduler!</h2>
              <p style={{ margin: 0, color: '#737373', fontSize: '0.875rem' }}>
                Ikuti 4 langkah berikut untuk memulai mengirim email otomatis.
              </p>
            </div>
          </div>

          <Step num={1} done={step1Done}
            title="Tambah Akun Pengirim Gmail"
            desc="Masuk ke menu Accounts → klik Tambah Akun → isi alamat Gmail yang akan dipakai kirim email → klik Login dan login manual di Chrome yang terbuka."
            action="Ke Accounts" onClick={() => onNavigate?.('accounts')}
          />
          <Step num={2} done={step2Done}
            title="Upload Jadwal Email"
            desc="Masuk ke menu Schedule → klik Upload Excel/CSV → pilih file jadwal kamu. Pastikan kolom recipient_email, sender_email, template_key, dan scheduled_at sudah terisi."
            action="Ke Schedule" onClick={() => onNavigate?.('schedule')}
          />
          <Step num={3} done={step3Done}
            title="Test Dulu Sebelum Full Run"
            desc='Masuk ke menu Run Automation → klik "Test Real (3 emails)" untuk coba 3 email pertama. Cek di Gmail apakah email masuk folder "Scheduled".'
            action="Ke Run" onClick={() => onNavigate?.('run')}
          />
          <Step num={4} done={step4Done}
            title="Jalankan Semua"
            desc='Kalau test berhasil, klik tombol "Lanjut / Resume" untuk proses semua email yang pending. Bisa ditinggal — automasi jalan sendiri.'
            action="Ke Run" onClick={() => onNavigate?.('run')}
          />
        </div>
      )}

      {/* ── Stats cards ── */}
      {allSetup && (
        <>
          {/* Progress */}
          <div className="table-section" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ margin: 0 }}>Progress Pengiriman</h2>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#16a34a' }}>{pct}%</span>
            </div>
            <div style={{ height: 10, background: '#f5f5f5', borderRadius: 5, overflow: 'hidden', marginBottom: '1rem' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#16a34a', transition: 'width 0.5s' }} />
            </div>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} color="#16a34a" />
                <span style={{ fontWeight: 600 }}>{stats.scheduled_success}</span>
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>terjadwal</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} color="#737373" />
                <span style={{ fontWeight: 600 }}>{stats.schedule_pending}</span>
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>pending</span>
              </div>
              {stats.failed_total > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={16} color="#dc2626" />
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>{stats.failed_total}</span>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>gagal</span>
                </div>
              )}
              <span className="text-muted" style={{ fontSize: '0.8rem', marginLeft: 'auto' }}>
                Total: {stats.schedule_total} email
              </span>
            </div>

            {stats.schedule_pending > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.875rem' }}>
                  <strong>{stats.schedule_pending} email</strong> masih pending — siap dilanjut.
                </span>
                <button
                  onClick={() => onNavigate?.('run')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit' }}
                >
                  Run Sekarang <ArrowRight size={14} />
                </button>
              </div>
            )}

            {stats.failed_total > 0 && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.875rem', color: '#dc2626' }}>
                  <strong>{stats.failed_total} email gagal</strong> — cek detail di menu Results.
                </span>
                <button
                  onClick={() => onNavigate?.('results')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'inherit' }}
                >
                  Lihat Error <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="stats-grid">
            {[
              { title: 'Akun Aktif', value: `${stats.senders_enabled}/${stats.senders_total}`, sub: 'sender aktif', icon: <Users size={20} /> },
              { title: 'Terjadwal', value: stats.scheduled_success, sub: 'masuk Gmail Scheduled', icon: <CheckCircle2 size={20} /> },
              { title: 'Gagal', value: stats.failed_total, sub: stats.failed_total > 0 ? 'perlu dicek' : 'semua lancar', icon: <XCircle size={20} /> },
              { title: 'Template', value: stats.templates_total, sub: `${stats.subjects_total} subject tersedia`, icon: <FileText size={20} /> },
            ].map(c => (
              <div className="stat-card" key={c.title}>
                <div className="stat-header"><span className="stat-title">{c.title}</span>{c.icon}</div>
                <div className="stat-value">{c.value}</div>
                <div className="text-muted" style={{ fontSize: '0.8rem' }}>{c.sub}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="two-col">
        {/* Pending per sender */}
        <div className="table-section">
          <h2>Pending per Akun</h2>
          <table>
            <thead><tr><th>Akun Pengirim</th><th style={{ textAlign: 'right' }}>Pending</th></tr></thead>
            <tbody>
              {Object.entries(stats.per_sender_pending).map(([s, n]) => (
                <tr key={s}><td>{s}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{n}</td></tr>
              ))}
              {Object.keys(stats.per_sender_pending).length === 0 && (
                <tr><td colSpan={2} className="empty-cell">
                  {stats.scheduled_success > 0 ? '🎉 Semua sudah terjadwal!' : 'Belum ada data pending.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Recent jobs */}
        <div className="table-section">
          <h2>Job Terakhir</h2>
          <table>
            <thead><tr><th>Job</th><th>Status</th><th>Waktu</th></tr></thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id}>
                  <td>{j.label}</td>
                  <td><span className={`status-badge job-${j.status}`}><span className="status-dot"></span>{j.status}</span></td>
                  <td className="text-muted" style={{ fontSize: '0.8rem' }}>{new Date(j.startedAt).toLocaleString()}</td>
                </tr>
              ))}
              {jobs.length === 0 && <tr><td colSpan={3} className="empty-cell">Belum ada job dijalankan.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Overview;
