import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Play,
  CalendarClock,
  ListChecks,
  Settings,
  Inbox,
} from 'lucide-react';
import Overview from './pages/Overview';
import RunPage from './pages/RunPage';
import SchedulePage from './pages/SchedulePage';
import AccountsPage from './pages/AccountsPage';
import TemplatesPage from './pages/TemplatesPage';
import ResultsPage from './pages/ResultsPage';
import SettingsPage from './pages/SettingsPage';

type PageKey = 'overview' | 'run' | 'schedule' | 'accounts' | 'templates' | 'results' | 'settings';

const NAV: { key: PageKey; label: string; icon: React.ReactNode; title: string }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} />, title: 'Dashboard Overview' },
  { key: 'run', label: 'Run Automation', icon: <Play size={18} />, title: 'Run Automation' },
  { key: 'schedule', label: 'Schedule', icon: <CalendarClock size={18} />, title: 'Schedule Tracker' },
  { key: 'accounts', label: 'Accounts', icon: <Users size={18} />, title: 'Sender Accounts' },
  { key: 'templates', label: 'Templates', icon: <FileText size={18} />, title: 'Templates & Subjects' },
  { key: 'results', label: 'Results', icon: <ListChecks size={18} />, title: 'Results' },
];

const App: React.FC = () => {
  const [page, setPage] = useState<PageKey>('overview');
  const current = NAV.find(n => n.key === page);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand">
          <Inbox size={24} strokeWidth={2.5} />
          <span>Gmail Scheduler</span>
        </div>
        <nav>
          {NAV.map(item => (
            <div
              key={item.key}
              className={`nav-item ${page === item.key ? 'active' : ''}`}
              onClick={() => setPage(item.key)}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
          <div style={{ marginTop: 'auto' }}>
            <div
              className={`nav-item ${page === 'settings' ? 'active' : ''}`}
              onClick={() => setPage('settings')}
            >
              <Settings size={18} />
              <span>Settings</span>
            </div>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="header">
          <h1>{current?.title || 'Settings'}</h1>
        </header>

        {page === 'overview' && <Overview />}
        {page === 'run' && <RunPage />}
        {page === 'schedule' && <SchedulePage />}
        {page === 'accounts' && <AccountsPage />}
        {page === 'templates' && <TemplatesPage />}
        {page === 'results' && <ResultsPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
};

export default App;
