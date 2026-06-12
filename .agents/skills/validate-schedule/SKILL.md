---
name: validate-schedule
description: Validate the schedule tracker CSV file for potential errors, missing fields, duplicates, or safety gaps.
version: 1.0.0
tags: [validation, csv, schedule, quality]
---

# Validate Schedule Skill

Use this skill when you want to validate the `data/schedule_tracker.csv` file before executing the automation, to make sure everything meets rules and constraints.

## When to Use
- Immediately after running `npm run convert` or updating `data/schedule_tracker.csv`.
- Before starting a batch execution of the scheduler to ensure there are no issues that could stop or crash the process.

## Instructions
1. Run the validation checks:
   ```powershell
   npm run validate
   ```
2. The script checks:
   - Duplicate `queue_id` entries.
   - Validity of recipient emails (`recipient_email` must contain `@`).
   - Validity of sender emails (must exist in `sender_accounts.csv`).
   - Validity of template keys (must exist in `templates.csv`).
   - Validity of schedule timestamp formats (`scheduled_at` must match `YYYY-MM-DD HH:mm`).
   - Safety gaps (at least 7 minutes interval between emails assigned to the same sender).
   - Weekly and daily counts per sender to check volume distribution.
