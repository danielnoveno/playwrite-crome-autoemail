Kamu adalah senior full-stack automation engineer. Tugasmu adalah mengimplementasikan project Node.js + Playwright untuk membuat sistem Gmail native Schedule Send melalui browser automation, bukan Gmail API, bukan Draft, dan bukan langsung Sent.

Konteks project:
Saya sedang membangun sistem otomatisasi Gmail outreach berbasis schedule tracker. Sebelumnya saya memakai n8n local CSV, tetapi sekarang targetnya email benar-benar masuk ke folder Gmail → Scheduled secara native. Saya sudah paham bahwa Gmail API/n8n tidak punya endpoint resmi untuk native Schedule Send, jadi solusi wajib menggunakan browser automation/RPA seperti Playwright yang membuka Gmail UI dan menekan tombol Schedule send seperti manusia.

Project path Windows:
D:\gmail-scheduler

Target utama:

1. Sistem membaca data dari CSV/Excel schedule tracker.
2. Sistem memakai 7 akun Gmail/sender:

   * [founders@contactsgetredditor.com](mailto:founders@contactsgetredditor.com)
   * [redditor@replygetredditor.com](mailto:redditor@replygetredditor.com)
   * [founders@replygetredditor.com](mailto:founders@replygetredditor.com)
   * [redditor@commentgetredditor.com](mailto:redditor@commentgetredditor.com)
   * [founders@commentgetredditor.com](mailto:founders@commentgetredditor.com)
   * [getredditorali@gmail.com](mailto:getredditorali@gmail.com)
   * [aligetredditor@gmail.com](mailto:aligetredditor@gmail.com)
3. Email tujuan diambil dari kolom To Email atau recipient_email.
4. Subject diambil dari kolom Subject. Jika kosong, subject harus di-rotate dari subject_pool.csv.
5. Body email diambil dari templates.csv berdasarkan kolom Template/template_key, misalnya T1, T2, T3, dst.
6. Jadwal mengikuti tracker Excel/CSV, tetapi jam mulai wajib 21:00 JKT.
7. Minimal jeda antar email dari akun yang sama adalah 7 menit.
8. Target jadwal mingguan:

   * Tuesday: 105 total = 15 per inbox
   * Wednesday: 126 total = 18 per inbox
   * Thursday: 140 total = 20 per inbox
   * Friday: 140 total = 20 per inbox
   * Sunday: 139 total = 19–20 per inbox
     Total sekitar 650 email/week untuk 7 inbox.
9. Sistem wajib membuat email masuk ke Gmail → Scheduled secara native.
10. Tahap awal wajib dibuat mode testing dulu: 1 email per akun atau 1–3 email total.
11. Sistem harus mencegah duplicate schedule berdasarkan queue_id.
12. Sistem harus menulis hasil sukses ke scheduled_results.csv dan error ke failed_results.csv.
13. Jangan membuat solusi yang hanya Draft atau langsung Sent.

Arsitektur yang harus dibuat:

* Gunakan Node.js.
* Gunakan Playwright.
* Gunakan persistent Chrome profile per akun Gmail agar login session tersimpan dan password tidak disimpan di script.
* Satu sender_email harus punya satu profile_dir.
* Automation membuka Gmail UI, klik Compose, isi To, Subject, Body, klik panah/More send options sebelah Send, pilih Schedule send, pilih tanggal dan jam custom sesuai scheduled_at, lalu memastikan email masuk Scheduled.
* Jika login expired atau Gmail meminta verifikasi keamanan, script harus berhenti untuk akun tersebut, log error LOGIN_REQUIRED atau SECURITY_CHECK_REQUIRED, dan lanjut ke akun lain.
* Jangan menjalankan profile sender yang sama secara paralel.

Buat struktur folder berikut:
D:\gmail-scheduler
├─ data
│  ├─ schedule_tracker.csv
│  ├─ templates.csv
│  ├─ subject_pool.csv
│  ├─ sender_accounts.csv
│  ├─ scheduled_results.csv
│  └─ failed_results.csv
├─ profiles
├─ screenshots
├─ logs
├─ scripts
│  ├─ excelToScheduleCsv.js
│  └─ validateSchedule.js
├─ src
│  ├─ config.js
│  ├─ csv.js
│  ├─ date.js
│  ├─ dataLoader.js
│  ├─ gmailUi.js
│  ├─ loginProfiles.js
│  └─ scheduleNative.js
├─ package.json
├─ .env.example
└─ README.md

Format CSV yang harus didukung:

1. data/sender_accounts.csv
   Kolom:
   sender_email,display_name,profile_dir,enabled

Isi default:
[founders@contactsgetredditor.com](mailto:founders@contactsgetredditor.com),GetRedditor Founders,D:/gmail-scheduler/profiles/founders_contactsgetredditor,true
[redditor@replygetredditor.com](mailto:redditor@replygetredditor.com),GetRedditor Redditor,D:/gmail-scheduler/profiles/redditor_replygetredditor,true
[founders@replygetredditor.com](mailto:founders@replygetredditor.com),GetRedditor Founders,D:/gmail-scheduler/profiles/founders_replygetredditor,true
[redditor@commentgetredditor.com](mailto:redditor@commentgetredditor.com),GetRedditor Redditor,D:/gmail-scheduler/profiles/redditor_commentgetredditor,true
[founders@commentgetredditor.com](mailto:founders@commentgetredditor.com),GetRedditor Founders,D:/gmail-scheduler/profiles/founders_commentgetredditor,true
[getredditorali@gmail.com](mailto:getredditorali@gmail.com),GetRedditor Ali,D:/gmail-scheduler/profiles/getredditorali,true
[aligetredditor@gmail.com](mailto:aligetredditor@gmail.com),Ali GetRedditor,D:/gmail-scheduler/profiles/aligetredditor,true

2. data/schedule_tracker.csv
   Kolom:
   queue_id,sender_email,recipient_email,subject,template_key,scheduled_at,category,company_name,website,day_name,per_sender_sequence,notes

Catatan:

* queue_id wajib unik.
* recipient_email wajib ada.
* sender_email wajib cocok dengan sender_accounts.csv.
* scheduled_at format YYYY-MM-DD HH:mm dan dianggap timezone JKT.
* template_key wajib cocok dengan templates.csv.
* subject boleh kosong; jika kosong ambil dari subject_pool.csv secara rotate.

3. data/templates.csv
   Kolom:
   template_key,body

Contoh:
T1,"hello- thinking of doing reddit commenting?

it will show up on llms.

i do provide 100 comments + 4 posts/mo on reddit.

been doing this for b2b/b2c saas/retail.

should i send you case studies?"

4. data/subject_pool.csv
   Kolom:
   subject_id,subject

Contoh:
S1,quick question
S2,reddit comments?
S3,case studies?

5. data/scheduled_results.csv
   Kolom:
   queue_id,sender_email,recipient_email,subject,scheduled_at,status,scheduled_native_at,created_at,notes

6. data/failed_results.csv
   Kolom:
   queue_id,sender_email,recipient_email,subject,scheduled_at,error_code,error_message,failed_at,screenshot_path

Implementasikan script utama:

1. src/loginProfiles.js
   Tujuan:

* Membuka Chrome persistent profile untuk tiap sender.
* Membuka https://mail.google.com.
* Memberi waktu login manual.
* Bisa dijalankan untuk semua akun atau satu akun dengan argumen --sender.
* Contoh command:
  node src/loginProfiles.js
  node src/loginProfiles.js --sender=[founders@contactsgetredditor.com](mailto:founders@contactsgetredditor.com) --minutes=20

2. src/scheduleNative.js
   Tujuan:

* Membaca sender_accounts.csv, schedule_tracker.csv, templates.csv, subject_pool.csv, scheduled_results.csv.
* Skip queue_id yang sudah ada di scheduled_results.csv.
* Bisa dry-run.
* Bisa limit total: --limit=3.
* Bisa limit per sender: --limit-per-sender=1.
* Bisa force: --force untuk mengabaikan duplicate check.
* Untuk setiap row:

  * Buka Chrome persistent profile sesuai sender.
  * Buka Gmail.
  * Cek apakah login valid.
  * Compose email.
  * Isi To.
  * Isi Subject.
  * Isi Body dari template.
  * Klik dropdown/More send options di sebelah tombol Send.
  * Pilih Schedule send.
  * Pilih custom date/time.
  * Isi scheduled_at sesuai row.
  * Klik Schedule send.
  * Verifikasi email muncul di folder Scheduled, minimal dengan membuka label Scheduled dan mencari subject/recipient.
  * Tulis ke scheduled_results.csv jika sukses.
  * Tulis ke failed_results.csv jika gagal.
  * Ambil screenshot jika gagal.

3. src/gmailUi.js
   Buat fungsi granular:

* openGmail(page)
* ensureLoggedIn(page)
* clickCompose(page)
* fillRecipient(page, email)
* fillSubject(page, subject)
* fillBody(page, body)
* openScheduleSend(page)
* setScheduleDateTime(page, scheduledAt)
* confirmSchedule(page)
* verifyScheduled(page, subject, recipient)
* takeFailureScreenshot(page, queueId)

Selector harus dibuat robust:

* Gunakan getByRole jika memungkinkan.
* Gunakan locator berbasis aria-label/text untuk Compose, To, Subject, Message Body, Schedule send.
* Tambahkan fallback locator jika selector utama gagal.
* Tambahkan timeout yang wajar.
* Tambahkan retry kecil untuk element Gmail yang lambat.
* Jangan terlalu agresif klik Send biasa.

4. src/csv.js
   Buat helper:

* readCsv(filePath)
* writeCsv(filePath, rows, headers)
* appendCsv(filePath, row, headers)
* ensureCsvFile(filePath, headers)

5. src/dataLoader.js
   Buat helper:

* loadSenders()
* loadTemplates()
* loadSubjects()
* loadScheduleRows()
* loadAlreadyScheduledQueueIds()
* resolveSubject(row, subjectPool)
* resolveBody(row, templates)
* validateRow(row)

6. src/date.js
   Buat helper:

* parseJktDateTime(value)
* formatForGmailCustomDate(value)
* formatForGmailCustomTime(value)
* assertMinimumGapPerSender(rows, 7)
* sortRowsByScheduledAt(rows)

7. scripts/excelToScheduleCsv.js
   Tujuan:

* Membaca Excel schedule tracker.
* Menghasilkan data/schedule_tracker.csv.
* Default start time 21:00 JKT.
* Default minimal gap 7 menit per sender.
* Distribusi mingguan:
  Tuesday 15 per inbox,
  Wednesday 18 per inbox,
  Thursday 20 per inbox,
  Friday 20 per inbox,
  Sunday 19–20 per inbox.
* Harus bisa membaca kolom fleksibel:
  To Email, recipient_email, Email, email
  Subject, subject
  Template, template_key
  Category, category
  Company, company_name
  Website, website
* Jika input tidak punya sender_email, assign round-robin ke 7 sender.
* Generate queue_id otomatis dengan format Q-YYYYMMDD-000001.
* Contoh command:
  node scripts/excelToScheduleCsv.js --input=data/schedule_tracker.xlsx --output=data/schedule_tracker.csv --start-date=2026-06-16 --start-time=21:00 --gap-minutes=7

8. scripts/validateSchedule.js
   Tujuan:

* Validasi schedule_tracker.csv.
* Cek queue_id duplicate.
* Cek recipient_email valid.
* Cek sender_email valid.
* Cek template_key valid.
* Cek scheduled_at valid.
* Cek minimal gap 7 menit per sender.
* Cek per hari/per sender count.
* Tampilkan summary di terminal.

Buat package.json dengan script:

* npm run login
* npm run schedule
* npm run test:dry
* npm run test:small
* npm run convert
* npm run validate

Contoh:
"scripts": {
"login": "node src/loginProfiles.js",
"schedule": "node src/scheduleNative.js",
"test:dry": "node src/scheduleNative.js --limit=3 --dry-run",
"test:small": "node src/scheduleNative.js --limit=3",
"convert": "node scripts/excelToScheduleCsv.js --input=data/schedule_tracker.xlsx --output=data/schedule_tracker.csv --start-time=21:00 --gap-minutes=7",
"validate": "node scripts/validateSchedule.js"
}

Dependency yang boleh dipakai:

* playwright
* csv-parse
* csv-stringify
* xlsx
* dayjs
* dotenv
* yargs atau minimist

Buat .env.example:
HEADLESS=false
SLOW_MO_MS=150
GMAIL_URL=https://mail.google.com/mail/u/0/#inbox
DEFAULT_TIMEZONE=Asia/Jakarta
MIN_GAP_MINUTES=7
SCREENSHOT_DIR=./screenshots

README.md harus berisi:

1. Cara install Node.js.
2. Cara init/install:
   cd /d D:\gmail-scheduler
   npm install
   npx playwright install chromium
3. Cara login manual:
   npm run login
4. Cara test dry-run:
   npm run test:dry
5. Cara test 1–3 email:
   npm run test:small
6. Cara batch kecil:
   node src/scheduleNative.js --limit-per-sender=1
   node src/scheduleNative.js --limit=21
7. Cara convert Excel:
   npm run convert
   npm run validate
8. Penjelasan bahwa output harus masuk Gmail → Scheduled.
9. Troubleshooting:

   * LOGIN_REQUIRED
   * SECURITY_CHECK_REQUIRED
   * Gmail UI changed
   * Schedule send button not found
   * 100 scheduled limit reached
   * Chrome profile locked
   * Popup compose tertutup
   * Gmail language bukan English
10. Catatan risiko:

* Gmail Scheduled limit 100 active scheduled emails per akun.
* Gmail sending limit tetap berlaku ketika email terkirim.
* Login/session bisa expired.
* Gmail UI bisa berubah.
* Laptop/server harus hidup saat proses scheduling berjalan.
* Jangan paralel untuk profile yang sama.
* Mulai dari limit kecil untuk testing.

Kualitas kode:

* Kode harus modular, rapi, dan mudah diedit.
* Jangan hardcode data selain default path dan default sender sample.
* Gunakan async/await.
* Tangani error per row, jangan membuat seluruh batch berhenti hanya karena satu email gagal.
* Tambahkan log console yang jelas.
* Tambahkan screenshot untuk error.
* Jangan menyimpan password Gmail.
* Jangan memakai Gmail API untuk schedule send.
* Jangan mengirim email langsung dengan tombol Send biasa.
* Jangan membuat Draft sebagai output utama.
* Pastikan setiap file yang kamu buat lengkap dan bisa langsung dijalankan.

Prioritas implementasi:

1. Buat struktur folder dan package.json.
2. Buat CSV helper.
3. Buat data loader.
4. Buat loginProfiles.js.
5. Buat scheduleNative.js.
6. Buat gmailUi.js dengan selector Playwright robust.
7. Buat excelToScheduleCsv.js.
8. Buat validateSchedule.js.
9. Buat contoh CSV sample di folder data.
10. Buat README.md lengkap.

Setelah implementasi selesai, tampilkan:

* daftar file yang dibuat,
* command yang harus saya jalankan pertama kali,
* command untuk login manual,
* command untuk dry-run,
* command untuk test 3 email,
* dan catatan bagian mana yang mungkin perlu saya sesuaikan jika selector Gmail berubah.
