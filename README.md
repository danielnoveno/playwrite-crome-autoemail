# Gmail Native Scheduler

Sistem otomatisasi Gmail outreach berbasis Playwright untuk membuat email masuk ke folder **Scheduled** secara native.

## Fitur
- Native Schedule Send (bukan Draft, bukan langsung Sent).
- Mendukung 7 akun pengirim dengan persistent Chrome profiles.
- Membaca data dari CSV/Excel.
- Distribusi jadwal otomatis (Tuesday-Sunday).
- Minimal jeda 7 menit antar email per akun.
- Mode testing, dry-run, dan limitasi batch.

## Persiapan
1. Pastikan sudah menginstal [Node.js](https://nodejs.org/).
2. Masuk ke direktori project:
   ```powershell
   cd "D:\Playwrite+Chrome"
   ```
3. Instal dependensi:
   ```powershell
   npm install
   npx playwright install chromium
   ```

## Langkah Penggunaan

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

## Troubleshooting
- **LOGIN_REQUIRED**: Session expired, silakan jalankan `npm run login`.
- **SECURITY_CHECK_REQUIRED**: Gmail meminta verifikasi HP/Email, selesaikan secara manual melalui `npm run login`.
- **Selector Not Found**: Gmail mungkin mengubah UI-nya. Periksa `src/gmailUi.js` untuk menyesuaikan selector.
- **Limit 100 Active**: Gmail membatasi maksimal 100 email aktif di folder Scheduled per akun.

## Catatan Risiko
- Gmail tetap memiliki sending limit harian.
- Jangan menjalankan profile yang sama secara paralel.
- Pastikan zona waktu sistem adalah WIB/JKT agar `scheduled_at` akurat.
