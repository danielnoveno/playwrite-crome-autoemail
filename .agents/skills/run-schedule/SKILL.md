---
name: run-schedule
description: Execute the main Gmail Schedule Send automation using Playwright.
version: 1.0.0
tags: [scheduler, automation, playwright, email]
---

# Run Schedule Skill

Use this skill when you want to execute the browser automation to schedule emails in Gmail.

## When to Use
- When you want to run dry-runs (tests without actual browser execution).
- When you want to execute small test batches (1-3 emails).
- When you want to run the full scheduler batch.

## Instructions
1. **Dry-run simulation** (skips actual browser execution, only reads schedule and resolves templates/subjects):
   ```powershell
   npm run test:dry
   ```
2. **Small test batch** (schedules up to 3 emails total, opens browser context):
   ```powershell
   npm run test:small
   ```
3. **Run a full batch** (processes all pending emails in the schedule):
   ```powershell
   npm run schedule
   ```
4. **Execute with a limit per sender** (e.g., limit each sender account to maximum 1 email in this run):
   ```powershell
   node src/scheduleNative.js --limit-per-sender=1
   ```
5. **Force execution** (bypasses the duplicate checks on already scheduled queue IDs):
   ```powershell
   node src/scheduleNative.js --force
   ```
