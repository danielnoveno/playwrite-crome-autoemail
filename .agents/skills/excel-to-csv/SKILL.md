---
name: excel-to-csv
description: Convert Excel spreadsheet schedule tracker to standard schedule tracker CSV format.
version: 1.0.0
tags: [excel, csv, conversion]
---

# Excel to CSV Skill

Use this skill when you need to convert a scheduling spreadsheet (Excel format) into the CSV format required by the automation runner.

## When to Use
- When a new batch of email outreach schedule is prepared in Excel (`data/schedule_tracker.xlsx`) and needs to be processed.
- When updating or recreating the main queue list (`data/schedule_tracker.csv`).

## Instructions
1. Default conversion (uses default values: gap 7 mins, start JKT time 21:00):
   ```powershell
   npm run convert
   ```
2. Custom conversion with parameters:
   ```powershell
   node scripts/excelToScheduleCsv.js --input=data/schedule_tracker.xlsx --output=data/schedule_tracker.csv --start-date=2026-06-16 --start-time=21:00 --gap-minutes=7
   ```
3. Options supported:
   - `--input`: Path to the input Excel spreadsheet (default: `data/schedule_tracker.xlsx`).
   - `--output`: Path to the output CSV file (default: `data/schedule_tracker.csv`).
   - `--start-date`: The date when scheduling should start (format: `YYYY-MM-DD`).
   - `--start-time`: The daily start time for emails (default: `21:00`).
   - `--gap-minutes`: The minimum gap in minutes between consecutive emails per sender (default: `7`).
