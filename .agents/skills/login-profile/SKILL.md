---
name: login-profile
description: Log into a Gmail persistent Chrome profile to refresh/keep login session alive for automation.
version: 1.0.0
tags: [gmail, authentication, playwright, login]
---

# Login Profile Skill

Use this skill when you need to log into one or more Gmail sender accounts to initialize or refresh the persistent Chrome login session.

## When to Use
- Before running the scheduler for the first time on a new machine.
- When the scheduling logs show `LOGIN_REQUIRED` or `SECURITY_CHECK_REQUIRED`.
- When a user wants to manually inspect or check a Gmail profile.

## Instructions
1. To run login for all enabled accounts sequentially (opens a browser window for each account for 10 minutes by default):
   ```powershell
   npm run login
   ```
2. To run login for a specific sender account (e.g., `getredditorali@gmail.com`):
   ```powershell
   node src/loginProfiles.js --sender=getredditorali@gmail.com
   ```
3. To adjust the time the browser window stays open (e.g., to 20 minutes):
   ```powershell
   node src/loginProfiles.js --sender=getredditorali@gmail.com --minutes=20
   ```
