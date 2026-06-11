import React, { useEffect, useState } from 'react';

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
      <div className="sidebar">
        <h2 style={{ marginBottom: '2rem', color: '#2563eb' }}>Gmail Scheduler</h2>
        <nav>
          <div style={{ padding: '0.75rem 0', fontWeight: '500', cursor: 'pointer' }}>Dashboard</div>
          <div style={{ padding: '0.75rem 0', color: '#64748b', cursor: 'pointer' }}>Accounts</div>
          <div style={{ padding: '0.75rem 0', color: '#64748b', cursor: 'pointer' }}>Templates</div>
          <div style={{ padding: '0.75rem 0', color: '#64748b', cursor: 'pointer' }}>Logs</div>
        </nav>
      </div>

      <div className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <h1>Dashboard Overview</h1>
          <button className="btn btn-primary" onClick={runSchedule} disabled={loading}>
            {loading ? 'Running...' : 'Run Automation'}
          </button>
        </header>

        <div className="stats-grid">
          <div className="card">
            <h3 style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Accounts</h3>
            <p style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>{stats.total_senders}</p>
          </div>
          <div className="card">
            <h3 style={{ color: '#64748b', fontSize: '0.875rem' }}>Active Schedules</h3>
            <p style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>{stats.total_schedules}</p>
          </div>
          <div className="card">
            <h3 style={{ color: '#64748b', fontSize: '0.875rem' }}>Templates</h3>
            <p style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>{stats.total_templates}</p>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Sender Accounts</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '1rem' }}>Email</th>
                <th style={{ padding: '1rem' }}>Profile</th>
                <th style={{ padding: '1rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {senders.map((sender: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '1rem' }}>{sender.email}</td>
                  <td style={{ padding: '1rem' }}>{sender.profile_dir}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`status-badge ${sender.enabled === 'true' ? 'status-active' : 'status-inactive'}`}>
                      {sender.enabled === 'true' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default App;
