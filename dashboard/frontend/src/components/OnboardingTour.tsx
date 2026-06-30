import React, { useEffect, useState } from 'react';

interface Props {
  onClose: () => void;
  onNavigate: (page: string) => void;
}

type Trigger = 'click' | 'input' | 'change';

interface Step {
  title: string;
  body: string;
  target: string;
  page: string;
  trigger: Trigger;
}

const STEPS: Step[] = [
  { title: 'Quest 1: Buka Akun Gmail', body: 'Klik menu Akun Gmail di sidebar. Di sini user menambahkan akun pengirim dan login manual ke Gmail.', target: 'nav-accounts', page: 'accounts', trigger: 'click' },
  { title: 'Quest 2: Tambah Akun', body: 'Klik tombol Tambah Akun sampai muncul baris akun baru.', target: 'accounts-add', page: 'accounts', trigger: 'click' },
  { title: 'Quest 3: Isi Email Pengirim', body: 'Isi alamat Gmail yang akan dipakai sebagai pengirim, contoh nama@gmail.com.', target: 'accounts-email', page: 'accounts', trigger: 'input' },
  { title: 'Quest 4: Isi Display Name', body: 'Isi nama pengirim yang akan tampil di Gmail. Bisa nama brand atau nama personal.', target: 'accounts-display', page: 'accounts', trigger: 'input' },
  { title: 'Quest 5: Login Akun Ini', body: 'Klik Login di baris akun. Chrome yang terbuka adalah untuk email pada baris itu.', target: 'accounts-login', page: 'accounts', trigger: 'click' },
  { title: 'Quest 6: Buka Isi Email', body: 'Klik menu Isi Email. Fresh install selalu kosong, jadi template dan subject wajib dibuat dulu.', target: 'nav-templates', page: 'templates', trigger: 'click' },
  { title: 'Quest 7: Tambah Template', body: 'Klik Tambah Template sampai kartu template baru muncul.', target: 'templates-add', page: 'templates', trigger: 'click' },
  { title: 'Quest 8: Isi Kode Template', body: 'Pastikan kode template terisi, misalnya T1. Kode ini nanti dipilih di jadwal email.', target: 'templates-key', page: 'templates', trigger: 'input' },
  { title: 'Quest 9: Isi Body Email', body: 'Tulis isi email yang akan dimasukkan ke Gmail. Minimal isi beberapa kalimat dulu untuk contoh.', target: 'templates-body', page: 'templates', trigger: 'input' },
  { title: 'Quest 10: Simpan Template', body: 'Klik Simpan Template supaya isi email tersimpan ke CSV lokal.', target: 'templates-save', page: 'templates', trigger: 'click' },
  { title: 'Quest 11: Tambah Subject', body: 'Klik Tambah Subject untuk membuat subject cadangan. Subject ini dipakai kalau jadwal tidak punya subject khusus.', target: 'subjects-add', page: 'templates', trigger: 'click' },
  { title: 'Quest 12: Isi Subject', body: 'Isi subject email, contoh: quick question. Buat beberapa variasi nanti kalau butuh rotasi.', target: 'subjects-input', page: 'templates', trigger: 'input' },
  { title: 'Quest 13: Simpan Subject', body: 'Klik Simpan Subject supaya subject pool tersimpan.', target: 'subjects-save', page: 'templates', trigger: 'click' },
  { title: 'Quest 14: Buka Jadwal Email', body: 'Klik menu Jadwal Email. Di sini user membuat daftar email yang akan dijadwalkan.', target: 'nav-schedule', page: 'schedule', trigger: 'click' },
  { title: 'Quest 15: Download Template Excel', body: 'Klik Download Template Excel. File ini sudah berisi sheet Setup, Jadwal, dan Panduan.', target: 'schedule-download-template', page: 'schedule', trigger: 'click' },
  { title: 'Quest 16: Upload Excel', body: 'Setelah file Excel diisi, klik Upload Excel / CSV lalu pilih file tersebut.', target: 'schedule-upload', page: 'schedule', trigger: 'click' },
  { title: 'Quest 17: Convert Jadi Jadwal', body: 'Klik Convert & Generate Jadwal untuk mengubah Excel menjadi schedule_tracker.csv.', target: 'schedule-convert', page: 'schedule', trigger: 'click' },
  { title: 'Quest 18: Cek Jadwal', body: 'Klik Validate untuk cek jadwal sebelum dijalankan.', target: 'schedule-validate', page: 'schedule', trigger: 'click' },
  { title: 'Quest 19: Buka Jalankan', body: 'Klik menu Jalankan. Semua proses automation dimulai dari sini.', target: 'nav-run', page: 'run', trigger: 'click' },
  { title: 'Quest 20: Cek Data', body: 'Klik Cek Data dulu. Ini preview aman, tidak membuka browser dan tidak menjadwalkan email.', target: 'run-check', page: 'run', trigger: 'click' },
  { title: 'Quest 21: Test 3 Email', body: 'Setelah data aman, klik Test 3 Email untuk mencoba real scheduling kecil sebelum full run.', target: 'run-test', page: 'run', trigger: 'click' },
  { title: 'Quest 22: Buka Hasil', body: 'Klik menu Hasil untuk melihat email berhasil dan gagal. Kalau gagal, baca instruksi error lalu retry.', target: 'nav-results', page: 'results', trigger: 'click' },
];

const OnboardingTour: React.FC<Props> = ({ onClose, onNavigate }) => {
  const [index, setIndex] = useState(() => {
    const saved = parseInt(localStorage.getItem('onboardingStep') || '0', 10);
    return Number.isFinite(saved) && saved >= 0 && saved < STEPS.length ? saved : 0;
  });
  const safeIndex = Number.isFinite(index) && index >= 0 && index < STEPS.length ? index : 0;
  const step = STEPS[safeIndex];
  const isLast = safeIndex === STEPS.length - 1;
  const selector = `[data-tour="${step.target}"]`;
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

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

  const updatePanelPosition = () => {
    const target = document.querySelector(selector) as HTMLElement | null;
    if (!target) {
      setPanelStyle({});
      return;
    }

    const rect = target.getBoundingClientRect();
    const width = Math.min(420, window.innerWidth - 32);
    const height = 280;
    const gap = 16;
    const margin = 16;
    const centerY = rect.top + rect.height / 2;
    const centerX = rect.left + rect.width / 2;
    const clampLeft = (left: number) => Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    const clampTop = (top: number) => Math.max(margin, Math.min(top, window.innerHeight - height - margin));

    const candidates = [
      { left: rect.right + gap, top: clampTop(centerY - height / 2), name: 'right' },
      { left: rect.left - width - gap, top: clampTop(centerY - height / 2), name: 'left' },
      { left: clampLeft(centerX - width / 2), top: rect.bottom + gap, name: 'bottom' },
      { left: clampLeft(centerX - width / 2), top: rect.top - height - gap, name: 'top' },
    ].map(c => ({ ...c, left: clampLeft(c.left), top: clampTop(c.top) }));

    const overlapArea = (c: { left: number; top: number }) => {
      const xOverlap = Math.max(0, Math.min(c.left + width, rect.right) - Math.max(c.left, rect.left));
      const yOverlap = Math.max(0, Math.min(c.top + height, rect.bottom) - Math.max(c.top, rect.top));
      return xOverlap * yOverlap;
    };

    const fits = (c: { left: number; top: number; name: string }) => {
      if (c.name === 'right') return rect.right + gap + width <= window.innerWidth - margin;
      if (c.name === 'left') return rect.left - gap - width >= margin;
      if (c.name === 'bottom') return rect.bottom + gap + height <= window.innerHeight - margin;
      return rect.top - gap - height >= margin;
    };

    const best = [...candidates].sort((a, b) => {
      const fitDiff = Number(fits(b)) - Number(fits(a));
      if (fitDiff) return fitDiff;
      return overlapArea(a) - overlapArea(b);
    })[0];

    setPanelStyle({ left: best.left, top: best.top, width, right: 'auto', bottom: 'auto' });
  };

  const focusTarget = () => {
    const target = document.querySelector(selector) as HTMLElement | null;
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.setTimeout(updatePanelPosition, 250);
  };

  useEffect(() => {
    let target = document.querySelector(selector);
    const markTarget = () => {
      target?.classList.remove('tour-target');
      target = document.querySelector(selector);
      target?.classList.add('tour-target');
      updatePanelPosition();
    };

    window.setTimeout(markTarget, 80);

    const complete = () => {
      window.setTimeout(() => {
        if (isLast) finish();
        else goToStep(safeIndex + 1);
      }, 150);
    };

    const hasValue = (el: Element) => {
      const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      return String(input.value || '').trim().length > 0;
    };

    const onClick = (event: MouseEvent) => {
      if (step.trigger !== 'click') return;
      const clickedTarget = (event.target as HTMLElement | null)?.closest(selector);
      if (clickedTarget) complete();
    };

    const onInput = (event: Event) => {
      if (step.trigger !== 'input') return;
      const inputTarget = (event.target as HTMLElement | null)?.closest(selector);
      if (inputTarget && hasValue(inputTarget)) complete();
    };

    const onChange = (event: Event) => {
      if (step.trigger !== 'change') return;
      const changedTarget = (event.target as HTMLElement | null)?.closest(selector);
      if (changedTarget && hasValue(changedTarget)) complete();
    };

    const onMove = () => updatePanelPosition();
    document.addEventListener('click', onClick, true);
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onChange, true);
    window.addEventListener('resize', onMove);
    document.querySelector('.main-scroll')?.addEventListener('scroll', onMove);

    return () => {
      target?.classList.remove('tour-target');
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('change', onChange, true);
      window.removeEventListener('resize', onMove);
      document.querySelector('.main-scroll')?.removeEventListener('scroll', onMove);
    };
  }, [safeIndex, step.target, step.trigger, isLast]);

  const hideForNow = () => {
    localStorage.setItem('onboardingStep', String(safeIndex));
    onClose();
  };

  const showTargetPage = () => {
    onNavigate(step.page);
    window.setTimeout(() => {
      document.querySelector(selector)?.classList.add('tour-target');
      focusTarget();
    }, 100);
  };

  return (
    <aside className="tour-panel" style={panelStyle} aria-labelledby="tour-title">
      <div className="tour-kicker">Panduan Pemula</div>
      <h2 id="tour-title">{step.title}</h2>
      <p>{step.body}</p>
      <div className="tour-waiting">
        {step.trigger === 'click' ? 'Klik area yang disorot untuk menyelesaikan quest ini.' : 'Isi area yang disorot sampai tidak kosong untuk lanjut.'}
      </div>

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
