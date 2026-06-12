import React, { useEffect, useState } from 'react';
import { Mail, CalendarClock, CheckCircle2, XCircle, FileText, Clock } from 'lucide-react';
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

const Overview: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [s, j] = await Promise.all([get<Stats>('/api/stats'), get<Job[]>('/api/jobs')]);
      setStats(s);
      setJobs(j.slice(0, 5));
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (error) {
    return (
      <div className="empty-state">
        <p><strong>Cannot reach the API server.</strong></p>
        <p className="text-muted">{error}</p>
        <p className="text-muted">Check the Settings page (API URL + token) and make sure the worker PC is running <code>npm run server</code>.</p>
      </div>
    );
  }
  if (!stats) return <div className="empty-state">Loading…</div>;

  const cards = [
    { title: 'Sender Accounts', value: `${stats.senders_enabled}/${stats.senders_total}`, sub: 'enabled', icon: <Mail size={20} /> },
    { title: 'Pending Emails', value: stats.schedule_pending, sub: `of ${stats.schedule_total} in tracker`, icon: <Clock size={20} /> },
    { title: 'Scheduled (Native)', value: stats.scheduled_success, sub: 'in Gmail Scheduled', icon: <CheckCircle2 size={20} /> },
    { title: 'Failed', value: stats.failed_total, sub: 'need attention', icon: <XCircle size={20} /> },
    { title: 'Templates', value: stats.templates_total, sub: `${stats.subjects_total} subjects in pool`, icon: <FileText size={20} /> },
  ];

  return (
    <div>
      <div className="stats-grid">
        {cards.map(c => (
          <div className="stat-card" key={c.title}>
            <div className="stat-header">
              <span className="stat-title">{c.title}</span>
              {c.icon}
            </div>
            <div className="stat-value">{c.value}</div>
            <div className="text-muted" style={{ fontSize: '0.8rem' }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="table-section">
          <h2>Pending per Sender</h2>
          <table>
            <thead><tr><th>Sender</th><th style={{ textAlign: 'right' }}>Pending</th></tr></thead>
            <tbody>
              {Object.entries(stats.per_sender_pending).map(([sender, count]) => (
                <tr key={sender}>
                  <td>{sender}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{count}</td>
                </tr>
              ))}
              {Object.keys(stats.per_sender_pending).length === 0 && (
                <tr><td colSpan={2} className="empty-cell">Nothing pending.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-section">
          <h2>Recent Jobs</h2>
          <table>
            <thead><tr><th>Job</th><th>Status</th><th>Started</th></tr></thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id}>
                  <td>{j.label}</td>
                  <td><span className={`status-badge job-${j.status}`}><span className="status-dot"></span>{j.status}</span></td>
                  <td className="text-muted">{new Date(j.startedAt).toLocaleString()}</td>
                </tr>
              ))}
              {jobs.length === 0 && <tr><td colSpan={3} className="empty-cell">No jobs run yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Overview;
