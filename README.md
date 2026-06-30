# Gmail Native Scheduler

Sistem otomatisasi Gmail outreach berbasis Playwright untuk membuat email masuk ke folder **Scheduled** secara native.

## Fitur
- Native Schedule Send (bukan Draft, bukan langsung Sent).
- Mendukung 7 akun pengirim dengan persistent Chrome profiles.
- Membaca data dari CSV/Excel.
- Distribusi jadwal otomatis (Tuesday-Sunday).
- Minimal jeda 7 menit antar email per akun.
- Mode testing, dry-run, dan limitasi batch.

## Cara Paling Mudah Untuk Pemula

1. Pastikan sudah menginstal [Node.js](https://nodejs.org/).
2. Klik dua kali `MULAI.bat` untuk menjalankan dashboard web lokal.
3. Atau klik dua kali `MULAI-DESKTOP.bat` untuk menjalankan aplikasi desktop.
4. Buka `http://localhost:5000` jika memakai dashboard web.
5. Ikuti panduan di halaman **Overview**: Accounts → Templates → Schedule → Run Automation.

> Untuk pemula, gunakan dashboard/desktop dulu. Command terminal di bawah ini hanya untuk mode advanced/debug.

## Langkah Penggunaan Advanced via Terminal

### 1. Login Manual (Wajib Sekali)
Gunakan perintah ini untuk login ke setiap akun Gmail agar session tersimpan di profile.
```powershell
npm run login
```
Atau login untuk akun tertentu:
```powershell
node src/loginProfiles.js --sender=getredditorali@gmail.com
```

### 2. Konversi Excel ke CSV
Jika Anda memiliki file Excel `data/schedule_tracker.xlsx`, konversikan ke format CSV yang didukung:
```powershell
npm run convert
```

### 3. Validasi Jadwal
Pastikan tidak ada duplicate `queue_id` atau jeda yang terlalu sempit:
```powershell
npm run validate
```

### 4. Menjalankan Penjadwalan (Automation)

**Dry-Run (Simulasi tanpa membuka browser):**
```powershell
npm run test:dry
```

**Testing Kecil (1-3 email):**
```powershell
npm run test:small
```

**Menjalankan Batch Penuh:**
```powershell
npm run schedule
```

**Menjalankan dengan limit per sender:**
```powershell
node src/scheduleNative.js --limit-per-sender=1
```

## Struktur Project

Lihat `docs/STRUCTURE.md` untuk peta folder lengkap. Ringkasnya:
- `src/`: core scheduler Playwright.
- `scripts/`: konversi dan validasi data.
- `server.js` + `server/`: API dashboard dan job runner.
- `dashboard/frontend/`: UI dashboard.
- `desktop/`: wrapper Electron.
- `data/`: CSV/XLSX operasional.
- `profiles/`, `screenshots/`, `logs/`: runtime output, tidak masuk Git.

## Struktur Data

### `data/sender_accounts.csv`
Daftar akun pengirim dan lokasi profil Chrome-nya.
- `sender_email`: Email Gmail.
- `profile_dir`: Folder untuk menyimpan session (relatif atau absolut).
- `enabled`: `true` atau `false`.

### `data/schedule_tracker.csv`
Daftar antrean email yang akan dijadwalkan.
- `scheduled_at`: Format `YYYY-MM-DD HH:mm`.

### `data/templates.csv`
Body email berdasarkan `template_key`.

### `data/subject_pool.csv`
Kumpulan subject yang akan di-rotate jika kolom subject di tracker kosong.

## Web Dashboard (untuk Tim)

Dashboard berbasis web agar tim bisa mengoperasikan sistem tanpa terminal: upload Excel/CSV, validasi, menjalankan dry-run/test/batch, melihat live log, mengelola akun/template, dan melihat hasil (sukses/gagal + screenshot).

### Menjalankan di PC worker (PC yang ada Chrome profile-nya)
```powershell
# build UI + jalankan server (UI + API jadi satu di port 5000)
npm run dashboard
```
Lalu buka `http://localhost:5000`. Tim di jaringan yang sama bisa buka `http://<IP-PC-worker>:5000`.

Untuk development UI: `npm run server` (terminal 1) + `npm run dashboard:dev` (terminal 2, port 3000, auto-proxy ke API).

### Keamanan (WAJIB sebelum diakses tim)
Set token di `.env` pada PC worker:
```
DASHBOARD_TOKEN=token-rahasia-anda
```
Semua request API harus membawa token ini. Tim cukup memasukkannya sekali di halaman **Settings** dashboard.

### Deploy ke Vercel (gratis)
**Penting:** Vercel hanya bisa meng-host **UI dashboard**. Automation Playwright TIDAK BISA jalan di Vercel karena butuh Chrome persistent profile, window browser asli, dan file CSV lokal. Jadi arsitekturnya:

```
Tim (browser) → Dashboard UI di Vercel → API server di PC worker (via tunnel) → Playwright + Gmail
```

1. **Expose PC worker** dengan tunnel gratis, contoh Cloudflare Tunnel:
   ```powershell
   winget install Cloudflare.cloudflared
   cloudflared tunnel --url http://localhost:5000
   ```
   Catat URL yang diberikan (mis. `https://xxx.trycloudflare.com`). (Alternatif: ngrok.)
2. **Deploy frontend ke Vercel**: import repo di vercel.com, set **Root Directory** = `dashboard/frontend` (framework Vite terdeteksi otomatis, output `dist`).
3. Buka URL Vercel → halaman **Settings** → isi **API Base URL** (URL tunnel) dan **Dashboard Token** → Test Connection.

PC worker harus tetap menyala saat tim memakai dashboard dan saat proses scheduling berjalan.

### Catatan operasional dashboard
- Tombol **Login** di halaman Accounts membuka jendela Chrome **di PC worker** — login manual tetap harus dilakukan di PC worker, bukan di browser tim.
- Job browser (schedule/login) otomatis dibatasi **satu per satu** — profile yang sama tidak akan pernah jalan paralel.
- Semua perubahan file CSV dari dashboard dibackup otomatis ke `data/backups/`.

## Troubleshooting
- **LOGIN_REQUIRED**: Session expired, silakan jalankan `npm run login`.
- **SECURITY_CHECK_REQUIRED**: Gmail meminta verifikasi HP/Email, selesaikan secara manual melalui `npm run login`.
- **Selector Not Found**: Gmail mungkin mengubah UI-nya. Periksa `src/gmailUi.js` untuk menyesuaikan selector.
- **Limit 100 Active**: Gmail membatasi maksimal 100 email aktif di folder Scheduled per akun.

## Catatan Risiko
- Gmail tetap memiliki sending limit harian.
- Jangan menjalankan profile yang sama secara paralel.
- Pastikan zona waktu sistem adalah WIB/JKT agar `scheduled_at` akurat.
