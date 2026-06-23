YMCA Job Search Tracker — Public Dashboards (Unofficial) (https://joshpower32.github.io/YMCA-Job-Search-Tracker/index.html#dashboards) 
A small web app for tracking job applications. Each user can create their own public dashboard with a custom title; anyone can browse every dashboard, but only the creator (or an admin) can add, edit, or delete entries on it.

Disclaimer: This is an independent personal project built for practice and personal job-search use. It is not affiliated with, endorsed by, sponsored by, or connected to YMCA or any of its member associations. All YMCA names and marks belong to their respective owners.

What it does:
Create a dashboard with a custom title (signed-in users).
Log applications with: Date, Job title, Company, Contact person (telephone / fax / email), Source (Newspaper, Internet, Job Bank, BetterJobs, Other), Follow-up date (auto-set to +2 weeks), and Feedback.
Browse everyone's dashboards (public read, no sign-in required to view).
Owner-only editing, with an admin/owner role that can manage any dashboard.
Auto follow-up reminders: rows show Due soon / Overdue / Followed up chips.

Tech:
Plain HTML + CSS + ES-module JavaScript, no build step. Backend is Firebase (Firestore + Email/Password Auth). Deploys to GitHub Pages as-is.

index.html         Browse + create dashboards
dashboard.html     A single dashboard (the application ledger)
css/styles.css     All styling
js/firebase-config.js   ← paste your Firebase keys here
js/auth.js         Sign in/up/out + the Admin role check
js/index.js        Dashboard list / create / rename / delete
js/dashboard.js    Entry add / edit / delete
firestore.rules    Security rules — the REAL authorization boundary
