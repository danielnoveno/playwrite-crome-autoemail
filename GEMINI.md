# GEMINI.md - Workspace Agent Rules & Guidelines

Welcome to the **Gmail Native Scheduler** project! This file serves as the playbook and context configuration for any AI agents working in this workspace.

---

## Technical Stack & Architecture
- **Language**: JavaScript (Node.js)
- **UI Automation**: Playwright (using Chromium channel `chrome` for persistent user data directories)
- **Data Format**: CSV files located in `data/` (using standard `csv-parse` and `csv-stringify` with `record_delimiter: ["\r\n", "\n"]` to handle cross-platform line breaks)
- **Dashboard**: Express backend (`server.js` + `server/`) and React frontend (`dashboard/frontend/`)

---

## Coding Guidelines & Conventions

### 1. Browser Automation (Gmail UI)
- **No Gmail API**: Do not use the official Gmail API or Drafts as the primary outreach method. All scheduled emails must be placed into the native Gmail **Scheduled** folder via browser RPA.
- **Robust Selectors**:
  - Prefer robust locators such as `getByRole`, `aria-label`, or user-facing text.
  - Avoid fragile CSS classes (e.g. `.T-I-KE`) which Gmail frequently changes.
  - Use timeout, retry, and element-load assertion patterns inside `src/gmailUi.js`.
- **Headless Mode**: Configured via the `.env` file (normally `HEADLESS=false` or configured dynamically).

### 2. Constraints & Validation Rules
- **Minimum Safety Gap**: A minimum gap of **7 minutes** is required between consecutive emails sent/scheduled by the same sender account.
- **Weekly Volume Caps**: 
  - Tuesday: max 15 per inbox
  - Wednesday: max 18 per inbox
  - Thursday: max 20 per inbox
  - Friday: max 20 per inbox
  - Sunday: max 19–20 per inbox
- **Timezone**: The timezone for schedules is JKT/WIB (Asia/Jakarta), and schedule starts at 21:00.
- **Single Instance Constraint**: Do not run the same Chrome profile (sender account) in parallel.

### 3. Error Handling & Logs
- Handle errors gracefully per row. If a single row fails, log the error, take a screenshot in `screenshots/`, write to `data/failed_results.csv`, and proceed to the next row in the batch. Do not stop the entire execution.
- If a security verification is prompted or login is invalid, throw/log `LOGIN_REQUIRED` or `SECURITY_CHECK_REQUIRED`, stop scheduling for that account, and proceed with other accounts.

---

## Available Custom Skills (Commands)

You can invoke these workspace-specific commands:

1. **`login-profile`**: Log into a persistent profile to keep sessions active.
   - Example: `node src/loginProfiles.js --sender=getredditorali@gmail.com`
2. **`excel-to-csv`**: Convert Excel files to scheduling CSV queue.
   - Example: `npm run convert`
3. **`validate-schedule`**: Validate safety gaps, duplicates, templates, and emails.
   - Example: `npm run validate`
4. **`run-schedule`**: Run the Playwright automation (supports dry-run, test, and batch limits).
   - Example: `npm run test:dry` or `npm run test:small`
