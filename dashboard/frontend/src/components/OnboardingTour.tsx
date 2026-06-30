import React, { useState } from 'react';

interface Props {
  onClose: () => void;
  onNavigate: (page: string) => void;
}

const STEPS = [
  {
    title: 'Selamat datang',
    body: 'Aplikasi ini menjadwalkan email ke folder Scheduled Gmail. Mulai dari kiri ke kanan: akun, isi email, jadwal, lalu jalankan.',
    page: 'overview',
  },
  {
    title: '1. Login Akun Gmail',
    body: 'Buka Akun Gmail, tambah email pengirim, lalu klik Login. Chrome akan terbuka di laptop ini untuk login manual.',
    page: 'accounts',
  },
  {
    title: '2. Siapkan Isi Email',
    body: 'Buka Isi Email. Tambahkan minimal 1 template dan beberapa subject. Fresh install selalu kosong, jadi isi dulu sebelum upload jadwal.',
    page: 'templates',
  },
  {
    title: '3. Buat Jadwal Email',
    body: 'Buka Jadwal Email. Kamu bisa tambah email satuan atau download template Excel, isi penerima, lalu upload kembali.',
    page: 'schedule',
  },
  {
    title: '4. Jalankan Dengan Aman',
    body: 'Buka Jalankan. Urutan aman: Cek Data, Test 3 Email, lalu Jalankan semua pending kalau test berhasil.',
    page: 'run',
  },
  {
    title: '5. Cek Hasil',
    body: 'Buka Hasil untuk melihat email yang berhasil dijadwalkan atau gagal. Jika gagal, baca instruksi error lalu retry setelah diperbaiki.',
    page: 'results',
  },
];

const OnboardingTour: React.FC<Props> = ({ onClose, onNavigate }) => {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const finish = () => {
    localStorage.setItem('onboardingDone', 'true');
    onClose();
  };

  const goToStep = (nextIndex: number) => {
    setIndex(nextIndex);
    onNavigate(STEPS[nextIndex].page);
  };

  return (
    <div className="tour-backdrop">
      <div className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <div className="tour-kicker">Panduan Pemula</div>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.body}</p>

        <div className="tour-progress">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={i === index ? 'active' : ''}
              aria-label={`Langkah ${i + 1}`}
              onClick={() => goToStep(i)}
            />
          ))}
        </div>

        <div className="tour-actions">
          <button className="btn btn-outline" onClick={finish}>Lewati</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-outline" disabled={index === 0} onClick={() => goToStep(index - 1)}>
            Kembali
          </button>
          {isLast ? (
            <button className="btn" onClick={finish}>Mulai Pakai</button>
          ) : (
            <button className="btn" onClick={() => goToStep(index + 1)}>Lanjut</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
