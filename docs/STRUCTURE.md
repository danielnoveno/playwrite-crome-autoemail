# Project Structure

Folder utama project ini sengaja dipisah antara source code, data operasional, dashboard, dan output runtime.

```text
.
├─ .agents/skills/        opencode skills untuk workflow project
├─ dashboard/frontend/    React/Vite dashboard UI
├─ data/                  CSV/XLSX input dan hasil automation
├─ desktop/               Electron desktop wrapper dan build config
├─ docs/                  Dokumentasi internal dan brief project
├─ logs/                  Log runtime job, di-ignore Git
├─ profiles/              Chrome persistent profiles, di-ignore Git
├─ screenshots/           Screenshot error automation, di-ignore Git
├─ scripts/               Script utility data dan validasi
├─ server/                Helper backend/job runner
├─ src/                   Core Playwright scheduler
├─ server.js              Express API dan static dashboard server
├─ package.json           Script root project
└─ README.md              Panduan penggunaan utama
```

## Catatan Perapihan

- Jangan pindahkan `data/`, `profiles/`, `screenshots/`, atau `logs/` tanpa mengubah environment variable terkait di `.env`.
- `dist-desktop/`, `dashboard/frontend/dist/`, `node_modules/`, `logs/`, `profiles/`, `screenshots/`, dan `data/uploads/` adalah output/cache/runtime dan sudah di-ignore Git.
- Brief awal project disimpan di `docs/project-brief.md` agar root folder tetap fokus ke file operasional.
- Skill data yang relevan: `excel-to-csv`, `validate-schedule`, `login-profile`, dan `run-schedule`.
