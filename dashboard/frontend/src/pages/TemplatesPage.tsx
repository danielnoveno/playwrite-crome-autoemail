import React, { useEffect, useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { get, put } from '../api';

interface Template { template_key: string; body: string; }
interface Subject { subject_id: string; subject: string; }

const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const [t, s] = await Promise.all([get<Template[]>('/api/templates'), get<Subject[]>('/api/subjects')]);
      setTemplates(t);
      setSubjects(s);
    } catch (e: any) { setMessage(e.message); }
  };
  useEffect(() => { load(); }, []);

  const saveTemplates = async () => {
    try {
      await put('/api/templates', { rows: templates.filter(t => t.template_key.trim()) });
      setMessage('templates.csv saved.');
    } catch (e: any) { setMessage(`Save failed: ${e.message}`); }
  };

  const saveSubjects = async () => {
    try {
      await put('/api/subjects', { rows: subjects.filter(s => s.subject_id.trim()) });
      setMessage('subject_pool.csv saved.');
    } catch (e: any) { setMessage(`Save failed: ${e.message}`); }
  };

  return (
    <div>
      {message && <p className="info-text" style={{ marginBottom: '1rem' }}>{message}</p>}

      <div className="table-section" style={{ marginBottom: '1.5rem' }}>
        <h2>Email Templates (templates.csv)</h2>
        <div className="form-row" style={{ marginBottom: '1rem' }}>
          <button className="btn btn-outline" onClick={() => setTemplates(p => [...p, { template_key: `T${p.length + 1}`, body: '' }])}>
            <Plus size={16} /> Add Template
          </button>
          <button className="btn" onClick={saveTemplates}><Save size={16} /> Save Templates</button>
        </div>
        {templates.map((t, i) => (
          <div className="template-card" key={i}>
            <div className="form-row">
              <label className="field" style={{ maxWidth: 160 }}>
                <span>Key</span>
                <input value={t.template_key} onChange={e => setTemplates(p => p.map((x, idx) => idx === i ? { ...x, template_key: e.target.value } : x))} />
              </label>
              <button className="btn btn-small btn-danger" style={{ alignSelf: 'flex-end' }}
                onClick={() => confirm(`Delete template ${t.template_key}?`) && setTemplates(p => p.filter((_, idx) => idx !== i))}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
            <textarea
              rows={6}
              value={t.body}
              onChange={e => setTemplates(p => p.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x))}
              placeholder="Email body…"
            />
          </div>
        ))}
        {templates.length === 0 && <p className="empty-cell">No templates.</p>}
      </div>

      <div className="table-section">
        <h2>Subject Pool (subject_pool.csv)</h2>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
          Used in rotation when a tracker row has an empty subject.
        </p>
        <div className="form-row" style={{ marginBottom: '1rem' }}>
          <button className="btn btn-outline" onClick={() => setSubjects(p => [...p, { subject_id: `S${p.length + 1}`, subject: '' }])}>
            <Plus size={16} /> Add Subject
          </button>
          <button className="btn" onClick={saveSubjects}><Save size={16} /> Save Subjects</button>
        </div>
        <table>
          <thead><tr><th style={{ width: 120 }}>ID</th><th>Subject</th><th style={{ width: 60 }}></th></tr></thead>
          <tbody>
            {subjects.map((s, i) => (
              <tr key={i}>
                <td><input className="cell-input" value={s.subject_id} onChange={e => setSubjects(p => p.map((x, idx) => idx === i ? { ...x, subject_id: e.target.value } : x))} /></td>
                <td><input className="cell-input" value={s.subject} onChange={e => setSubjects(p => p.map((x, idx) => idx === i ? { ...x, subject: e.target.value } : x))} /></td>
                <td><button className="btn btn-small btn-danger" onClick={() => setSubjects(p => p.filter((_, idx) => idx !== i))}><Trash2 size={14} /></button></td>
              </tr>
            ))}
            {subjects.length === 0 && <tr><td colSpan={3} className="empty-cell">No subjects.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TemplatesPage;
