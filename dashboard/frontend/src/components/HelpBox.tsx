import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Step {
  title: string;
  desc: string;
}

interface Props {
  title?: string;
  steps?: Step[];
  tips?: string[];
  defaultOpen?: boolean;
}

const HelpBox: React.FC<Props> = ({ title = 'Panduan', steps, tips, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: '1.5rem', border: '1px solid #e0f2fe', borderRadius: 6, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1rem', background: '#f0f9ff', border: 'none',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <HelpCircle size={16} color="#0284c7" />
        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0284c7', flex: 1 }}>{title}</span>
        {open ? <ChevronUp size={16} color="#0284c7" /> : <ChevronDown size={16} color="#0284c7" />}
      </button>
      {open && (
        <div style={{ padding: '1rem', background: '#fff', fontSize: '0.875rem', lineHeight: 1.7 }}>
          {steps && (
            <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
              {steps.map((s, i) => (
                <li key={i} style={{ marginBottom: '0.5rem' }}>
                  <strong>{s.title}</strong>
                  {s.desc && <span style={{ color: '#525252' }}> — {s.desc}</span>}
                </li>
              ))}
            </ol>
          )}
          {tips && (
            <ul style={{ paddingLeft: '1.25rem', margin: steps ? '0.75rem 0 0' : 0, color: '#525252' }}>
              {tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default HelpBox;
