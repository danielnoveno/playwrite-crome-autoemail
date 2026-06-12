import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Activity, 
  Play, 
  Mail, 
  CalendarClock, 
  Settings,
  Inbox
} from 'lucide-react';

const App = () => {
  const [stats, setStats] = useState({ total_senders: 0, total_schedules: 0, total_templates: 0 });
  const [senders, setSenders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchSenders();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchSenders = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/senders');
      const data = await res.json();
      setSenders(data);
    } catch (err) {
      console.error('Error fetching senders:', err);
    }
  };

  const runSchedule = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/run-schedule', { method: 'POST' });
      const data = await res.json();
      alert(data.message || 'Success');
    } catch (err) {
      alert('Error running schedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <Inbox size={24} strokeWidth={2.5} />
          <span>AutoMail</span>
        </div>
        <nav>
          <div className="nav-item active">
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </div>
          <div className="nav-item">
            <Users size={18} />
            <span>Accounts</span>
          </div>
          <div className="nav-item">
            <FileText size={18} />
            <span>Templates</span>
          </div>
          <div className="nav-item">
            <Activity size={18} />
            <span>Activity Logs</span>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <div className="nav-item">
              <Settings size={18} />
              <span>Settings</span>
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="header">
          <h1>Dashboard Overview</h1>
          <button className="btn" onClick={runSchedule} disabled={loading}>
            <Play size={16} fill={loading ? "none" : "currentColor"} />
            {loading ? 'RUNNING...' : 'RUN AUTOMATION'}
          </button>
        </header>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Total Accounts</span>
              <Mail size={20} className="text-muted" />
            </div>
            <div className="stat-value">{stats.total_senders}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Active Schedules</span>
              <CalendarClock size={20} className="text-muted" />
            </div>
            <div className="stat-value">{stats.total_schedules}</div>
          </div>
          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-title">Templates</span>
              <FileText size={20} className="text-muted" />
            </div>
            <div className="stat-value">{stats.total_templates}</div>
          </div>
        </div>

        {/* Data Table */}
        <div className="table-section">
          <h2>Sender Accounts</h2>
          <table>
            <thead>
              <tr>
                <th>Email Address</th>
                <th>Profile Directory</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {senders.map((sender: any, i: number) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{sender.email}</td>
                  <td className="text-muted">{sender.profile_dir}</td>
                  <td>
                    <span className={`status-badge ${sender.enabled === 'true' ? 'status-active' : 'status-inactive'}`}>
                      <span className="status-dot"></span>
                      {sender.enabled === 'true' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {senders.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '3rem 0', color: '#a3a3a3' }}>
                    No sender accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default App;
