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
import OnboardingTour from './components/OnboardingTour';

type PageKey = 'overview' | 'run' | 'schedule' | 'accounts' | 'templates' | 'results' | 'settings';

const NAV: { key: PageKey; label: string; icon: React.ReactNode; title: string }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} />, title: 'Dashboard Overview' },
  { key: 'run', label: 'Jalankan', icon: <Play size={18} />, title: 'Jalankan Automation' },
  { key: 'schedule', label: 'Jadwal Email', icon: <CalendarClock size={18} />, title: 'Jadwal Email' },
  { key: 'accounts', label: 'Akun Gmail', icon: <Users size={18} />, title: 'Akun Pengirim Gmail' },
  { key: 'templates', label: 'Isi Email', icon: <FileText size={18} />, title: 'Template Isi Email & Subject' },
  { key: 'results', label: 'Hasil', icon: <ListChecks size={18} />, title: 'Hasil Penjadwalan' },
];

const App: React.FC = () => {
  const [page, setPage] = useState<PageKey>('overview');
  const [showTour, setShowTour] = useState(() => localStorage.getItem('onboardingDone') !== 'true');
  const current = NAV.find(n => n.key === page);
  const navigate = (nextPage: string) => setPage(nextPage as PageKey);

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
              data-tour={`nav-${item.key}`}
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
        <div className="main-scroll">
          <header className="header">
            <h1>{current?.title || 'Settings'}</h1>
            <button className="btn btn-small btn-outline" onClick={() => setShowTour(true)}>
              Panduan Pemula
            </button>
          </header>

          {page === 'overview' && <Overview onNavigate={navigate} />}
          {page === 'run' && <RunPage />}
          {page === 'schedule' && <SchedulePage />}
          {page === 'accounts' && <AccountsPage />}
          {page === 'templates' && <TemplatesPage />}
          {page === 'results' && <ResultsPage />}
          {page === 'settings' && <SettingsPage />}
        </div>
        <footer className="main-footer">by peng</footer>
      </main>
      {showTour && <OnboardingTour onClose={() => setShowTour(false)} onNavigate={navigate} />}
    </div>
  );
};

export default App;
