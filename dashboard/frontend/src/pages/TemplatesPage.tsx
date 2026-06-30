import React, { useEffect, useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { get, put } from '../api';
import HelpBox from '../components/HelpBox';

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
      <HelpBox
        title="Panduan isi email untuk pemula"
        defaultOpen={templates.length === 0}
        steps={[
          { title: 'Template Isi Email', desc: 'isi body email yang akan dimasukkan ke Gmail. Minimal harus ada 1 template.' },
          { title: 'Key Template', desc: 'kode seperti T1, T2, T3. Jadwal email akan memilih template berdasarkan kode ini.' },
          { title: 'Kumpulan Subject', desc: 'dipakai otomatis kalau kolom subject di jadwal dikosongkan.' },
        ]}
        tips={[
          'Klik Save setelah mengubah template atau subject.',
          'Jangan hapus template yang masih dipakai di jadwal email.',
        ]}
      />
      {message && <p className="info-text" style={{ marginBottom: '1rem' }}>{message}</p>}

      <div className="table-section" style={{ marginBottom: '1.5rem' }}>
        <h2>Template Isi Email</h2>
        <div className="form-row" style={{ marginBottom: '1rem' }}>
          <button className="btn btn-outline" data-tour="templates-add" onClick={() => setTemplates(p => [...p, { template_key: `T${p.length + 1}`, body: '' }])}>
            <Plus size={16} /> Tambah Template
          </button>
          <button className="btn" onClick={saveTemplates}><Save size={16} /> Simpan Template</button>
        </div>
        {templates.map((t, i) => (
          <div className="template-card" key={i}>
            <div className="form-row">
              <label className="field" style={{ maxWidth: 160 }}>
                <span>Kode Template</span>
                <input value={t.template_key} onChange={e => setTemplates(p => p.map((x, idx) => idx === i ? { ...x, template_key: e.target.value } : x))} />
              </label>
              <button className="btn btn-small btn-danger" style={{ alignSelf: 'flex-end' }}
                onClick={() => confirm(`Delete template ${t.template_key}?`) && setTemplates(p => p.filter((_, idx) => idx !== i))}>
                <Trash2 size={14} /> Hapus
              </button>
            </div>
            <textarea
              rows={6}
              value={t.body}
              onChange={e => setTemplates(p => p.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x))}
              placeholder="Isi email..."
            />
          </div>
        ))}
        {templates.length === 0 && <p className="empty-cell">Belum ada template.</p>}
      </div>

      <div className="table-section">
        <h2>Kumpulan Subject</h2>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
          Dipakai bergantian ketika jadwal email tidak punya subject khusus.
        </p>
        <div className="form-row" style={{ marginBottom: '1rem' }}>
          <button className="btn btn-outline" onClick={() => setSubjects(p => [...p, { subject_id: `S${p.length + 1}`, subject: '' }])}>
            <Plus size={16} /> Tambah Subject
          </button>
          <button className="btn" onClick={saveSubjects}><Save size={16} /> Simpan Subject</button>
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
            {subjects.length === 0 && <tr><td colSpan={3} className="empty-cell">Belum ada subject.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TemplatesPage;
