import React, { useEffect, useRef, useState } from 'react';
import { get, post, LogLine } from '../api';

interface Props {
  jobId: string;
  onStatusChange?: (status: string) => void;
}

const LogViewer: React.FC<Props> = ({ jobId, onStatusChange }) => {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [status, setStatus] = useState<string>('running');
  const offsetRef = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLines([]);
    offsetRef.current = 0;
    setStatus('running');
    let stopped = false;

    const poll = async () => {
      try {
        const res = await get(`/api/jobs/${jobId}/logs?offset=${offsetRef.current}`);
        if (stopped) return;
        if (res.lines.length > 0) {
          setLines(prev => [...prev, ...res.lines].slice(-2000));
          offsetRef.current = res.nextOffset;
        }
        setStatus(res.status);
        onStatusChange?.(res.status);
        if (res.status === 'running' || res.status === 'stopping') {
          setTimeout(poll, 1500);
        }
      } catch {
        if (!stopped) setTimeout(poll, 3000);
      }
    };
    poll();
    return () => { stopped = true; };
  }, [jobId]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines]);

  const stopJob = async () => {
    if (!confirm('Stop this job? The Chrome window will be force-closed.')) return;
    try { await post(`/api/jobs/${jobId}/stop`); } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="log-viewer">
      <div className="log-toolbar">
        <span className={`status-badge job-${status}`}>
          <span className="status-dot"></span>{status.toUpperCase()}
        </span>
        {(status === 'running' || status === 'stopping') && (
          <button className="btn btn-small btn-danger" onClick={stopJob}>Stop Job</button>
        )}
      </div>
      <div className="log-box" ref={boxRef}>
        {lines.length === 0 && <div className="log-line log-muted">Waiting for output…</div>}
        {lines.map((l, i) => (
          <div key={i} className={`log-line ${l.s === 'err' ? 'log-err' : ''}`}>{l.m}</div>
        ))}
      </div>
    </div>
  );
};

export default LogViewer;
