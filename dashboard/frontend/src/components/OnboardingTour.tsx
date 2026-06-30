import React, { useEffect, useState } from 'react';

interface Props {
  onClose: () => void;
  onNavigate: (page: string) => void;
}

const STEPS = [
  {
    title: 'Quest 1: Buka Akun Gmail',
    body: 'Klik menu Akun Gmail di sidebar. Di sini user menambahkan akun pengirim dan login manual ke Gmail.',
    target: 'nav-accounts',
    page: 'accounts',
  },
  {
    title: 'Quest 2: Tambah Akun',
    body: 'Klik tombol Tambah Akun. Setelah baris muncul, isi email pengirim lalu klik Login di baris akun tersebut.',
    target: 'accounts-add',
    page: 'accounts',
  },
  {
    title: 'Quest 3: Buka Isi Email',
    body: 'Klik menu Isi Email. Fresh install selalu kosong, jadi template dan subject wajib dibuat dulu.',
    target: 'nav-templates',
    page: 'templates',
  },
  {
    title: 'Quest 4: Tambah Template',
    body: 'Klik Tambah Template, lalu isi body email. Simpan setelah template selesai dibuat.',
    target: 'templates-add',
    page: 'templates',
  },
  {
    title: 'Quest 5: Buka Jadwal Email',
    body: 'Klik menu Jadwal Email. Di sini user membuat daftar email yang akan dijadwalkan.',
    target: 'nav-schedule',
    page: 'schedule',
  },
  {
    title: 'Quest 6: Tambah Jadwal',
    body: 'Klik Tambah Email Satuan untuk mencoba satu jadwal, atau gunakan Download Template Excel untuk batch besar.',
    target: 'schedule-add',
    page: 'schedule',
  },
  {
    title: 'Quest 7: Buka Jalankan',
    body: 'Klik menu Jalankan. Semua proses run dimulai dari halaman ini.',
    target: 'nav-run',
    page: 'run',
  },
  {
    title: 'Quest 8: Cek Data',
    body: 'Klik Cek Data dulu. Ini preview aman, tidak membuka browser dan tidak menjadwalkan email.',
    target: 'run-check',
    page: 'run',
  },
  {
    title: 'Quest 9: Buka Hasil',
    body: 'Klik menu Hasil untuk melihat email yang berhasil dijadwalkan atau gagal setelah automation berjalan.',
    target: 'nav-results',
    page: 'results',
  },
];

const OnboardingTour: React.FC<Props> = ({ onClose, onNavigate }) => {
  const [index, setIndex] = useState(() => {
    const saved = parseInt(localStorage.getItem('onboardingStep') || '0', 10);
    return Number.isFinite(saved) && saved >= 0 && saved < STEPS.length ? saved : 0;
  });
  const safeIndex = Number.isFinite(index) && index >= 0 && index < STEPS.length ? index : 0;
  const step = STEPS[safeIndex];
  const isLast = safeIndex === STEPS.length - 1;
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const selector = `[data-tour="${step.target}"]`;

  const updatePanelPosition = () => {
    const target = document.querySelector(selector) as HTMLElement | null;
    if (!target) {
      setPanelStyle({});
      return;
    }

    const rect = target.getBoundingClientRect();
    const width = Math.min(420, window.innerWidth - 32);
    const gap = 16;
    const preferRight = rect.right + gap + width <= window.innerWidth;
    const left = preferRight
      ? rect.right + gap
      : Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
    const top = Math.max(16, Math.min(rect.bottom + gap, window.innerHeight - 260));

    setPanelStyle({ left, top, width, right: 'auto', bottom: 'auto' });
  };

  const focusTarget = () => {
    const target = document.querySelector(selector) as HTMLElement | null;
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.setTimeout(updatePanelPosition, 250);
  };

  useEffect(() => {
    const target = document.querySelector(selector);
    target?.classList.add('tour-target');
    window.setTimeout(updatePanelPosition, 80);

    const onClick = (event: MouseEvent) => {
      const clickedTarget = (event.target as HTMLElement | null)?.closest(selector);
      if (!clickedTarget) return;
      window.setTimeout(() => {
        if (isLast) finish();
        else goToStep(safeIndex + 1);
      }, 150);
    };

    const onMove = () => updatePanelPosition();
    document.addEventListener('click', onClick, true);
    window.addEventListener('resize', onMove);
    document.querySelector('.main-scroll')?.addEventListener('scroll', onMove);
    return () => {
      target?.classList.remove('tour-target');
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('resize', onMove);
      document.querySelector('.main-scroll')?.removeEventListener('scroll', onMove);
    };
  }, [safeIndex, step.target, isLast]);

  const finish = () => {
    localStorage.setItem('onboardingDone', 'true');
    localStorage.removeItem('onboardingStep');
    onClose();
  };

  const goToStep = (nextIndex: number) => {
    setIndex(nextIndex);
    localStorage.setItem('onboardingStep', String(nextIndex));
    onNavigate(STEPS[nextIndex].page);
  };

  const hideForNow = () => {
    localStorage.setItem('onboardingStep', String(safeIndex));
    onClose();
  };

  const showTargetPage = () => {
    onNavigate(step.page);
    window.setTimeout(() => {
      const target = document.querySelector(selector);
      target?.classList.add('tour-target');
      focusTarget();
    }, 100);
  };

  return (
    <aside className="tour-panel" style={panelStyle} aria-labelledby="tour-title">
      <div className="tour-kicker">Panduan Pemula</div>
      <h2 id="tour-title">{step.title}</h2>
      <p>{step.body}</p>
      <div className="tour-waiting">Klik area yang disorot untuk menyelesaikan quest ini.</div>

      <div className="tour-progress">
        {STEPS.map((_, i) => (
          <button
            key={i}
            className={i === safeIndex ? 'active' : ''}
            aria-label={`Langkah ${i + 1}`}
            onClick={() => goToStep(i)}
          />
        ))}
      </div>

      <div className="tour-actions">
        <button className="btn btn-outline" onClick={showTargetPage}>Tunjukkan</button>
        <button className="btn btn-outline" disabled={safeIndex === 0} onClick={() => goToStep(safeIndex - 1)}>
          Kembali
        </button>
      </div>

      <button className="tour-close" onClick={hideForNow}>Sembunyikan dulu</button>
    </aside>
  );
};

export default OnboardingTour;
