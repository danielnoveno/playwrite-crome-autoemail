import React, { useState } from 'react';
import { Save, Wifi } from 'lucide-react';
import { get, getApiBase, getToken, saveSettings } from '../api';

const SettingsPage: React.FC = () => {
  const [apiBase, setApiBase] = useState(localStorage.getItem('apiBase') || '');
  const [token, setToken] = useState(getToken());
  const [result, setResult] = useState('');

  const save = () => {
    saveSettings(apiBase, token);
    setResult('Saved. All requests now use these settings.');
  };

  const test = async () => {
    saveSettings(apiBase, token);
    setResult('Testing…');
    try {
      const res = await get('/api/health');
      setResult(`✅ Connected to ${getApiBase() || 'this server'} — auth ${res.authRequired ? 'required and accepted' : 'not required'}.`);
    } catch (e: any) {
      setResult(`❌ Failed: ${e.message}`);
    }
  };

  return (
    <div className="table-section" style={{ maxWidth: 720 }}>
      <h2>Connection Settings</h2>
      <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        When this dashboard is opened from Vercel, point it at the worker PC's public URL
        (Cloudflare Tunnel / ngrok). When opened directly from the worker PC (same server), leave the URL empty.
      </p>

      <label className="field" style={{ marginBottom: '1rem' }}>
        <span>API Base URL</span>
        <input
          placeholder="e.g. https://gmail-worker.your-tunnel.com (empty = same origin)"
          value={apiBase}
          onChange={e => setApiBase(e.target.value)}
        />
      </label>

      <label className="field" style={{ marginBottom: '1.5rem' }}>
        <span>Dashboard Token (DASHBOARD_TOKEN in .env on the worker PC)</span>
        <input
          type="password"
          placeholder="secret token"
          value={token}
          onChange={e => setToken(e.target.value)}
        />
      </label>

      <div className="form-row">
        <button className="btn" onClick={save}><Save size={16} /> Save</button>
        <button className="btn btn-outline" onClick={test}><Wifi size={16} /> Test Connection</button>
      </div>
      {result && <p className="info-text" style={{ marginTop: '1rem' }}>{result}</p>}
    </div>
  );
};

export default SettingsPage;
