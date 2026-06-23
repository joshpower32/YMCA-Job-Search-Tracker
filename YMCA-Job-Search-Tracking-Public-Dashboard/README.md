# YMCA Job Search Tracker — Public Dashboards (Unofficial)

A small web app for tracking job applications. Each user can create their own
**public dashboard** with a custom title; anyone can browse every dashboard, but
**only the creator (or an admin) can add, edit, or delete** entries on it.

> **Disclaimer:** This is an independent personal project built for practice and
> personal job-search use. It is **not** affiliated with, endorsed by, sponsored
> by, or connected to YMCA or any of its member associations. All YMCA names and
> marks belong to their respective owners.

---

## What it does

- Create a dashboard with a custom title (signed-in users).
- Log applications with: **Date, Job title, Company, Contact person
  (telephone / fax / email), Source** (Newspaper, Internet, Job Bank, BetterJobs,
  Other), **Follow-up date** (auto-set to +2 weeks), and **Feedback**.
- Browse everyone's dashboards (public read, no sign-in required to view).
- Owner-only editing, with an **admin/owner** role that can manage any dashboard.
- Auto follow-up reminders: rows show **Due soon / Overdue / Followed up** chips.

## Tech

Plain HTML + CSS + ES-module JavaScript, no build step. Backend is **Firebase**
(Firestore + Email/Password Auth). Deploys to **GitHub Pages** as-is.

```
index.html         Browse + create dashboards
dashboard.html     A single dashboard (the application ledger)
css/styles.css     All styling
js/firebase-config.js   ← paste your Firebase keys here
js/auth.js         Sign in/up/out + the Admin role check
js/index.js        Dashboard list / create / rename / delete
js/dashboard.js    Entry add / edit / delete
firestore.rules    Security rules — the REAL authorization boundary
```

---

## Setup (about 10 minutes)

### 1. Create a Firebase project
Go to <https://console.firebase.google.com> → **Add project**.

### 2. Add a Web app + copy the config
In the project, click the **`</>`** (Web) icon, register an app, and copy the
`firebaseConfig` object. Paste it into **`js/firebase-config.js`**, replacing the
`YOUR_...` placeholders.

> These keys are **not secret** — a Firebase web config only identifies your
> project. Security comes from the rules in `firestore.rules`. It's fine to
> commit `firebase-config.js` to a public repo.

### 3. Enable Email/Password auth
**Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**

### 4. Create the database
**Build → Firestore Database → Create database** (Production mode is fine).

### 5. Publish the security rules
Open the **Rules** tab, paste the entire contents of `firestore.rules`, and click
**Publish**. Without this step, writes will be denied (or wide open).

### 6. Authorize your domains
**Authentication → Settings → Authorized domains.** Add `localhost` (for local
testing) and your GitHub Pages domain, e.g. `yourname.github.io`.

### 7. Make yourself the owner/admin
1. Run the app and **create an account** (top-right → Sign in → Create account).
2. In the console: **Authentication → Users** → copy your **User UID**.
3. **Firestore Database → Start collection** → Collection ID: `admins`.
4. Add a document with **Document ID = your UID**, one field like
   `role` (string) = `owner`. Save.
5. Refresh the app — you'll see an **Admin** badge and can manage any dashboard.

---

## Running it

**Locally:** ES modules don't work over `file://`. Use VS Code's **Live Server**
extension (right-click `index.html` → *Open with Live Server*), or:

```bash
# from the project folder
python3 -m http.server 5500
# then open http://localhost:5500
```

**On GitHub Pages:**

```bash
git init
git add .
git commit -m "Initial commit: job search tracker"
git branch -M main
git remote add origin https://github.com/<you>/YMCA-Job-Search-Tracking-Public-Dashboard.git
git push -u origin main
```

Then **Settings → Pages → Build and deployment → Source: Deploy from a branch →
`main` / `root` → Save.** Wait a minute, then visit the published URL. (Don't
forget step 6 above — add that URL to Firebase Authorized domains.)

---

## How authorization works (the important part)

The UI hides Edit/Delete buttons when you're not the owner — but that's only
**cosmetic**. The real enforcement is server-side in `firestore.rules`:

- **Dashboards:** `update`/`delete` require `ownerUid == request.auth.uid` **or**
  an entry in `/admins`.
- **Entries:** writes require that you own the **parent** dashboard (checked with
  a `get()` on the dashboard doc) **or** are an admin. This stops someone from
  POSTing an entry into a dashboard that isn't theirs.

A request crafted outside the UI (curl, Burp, the Firebase SDK in a console) is
rejected by these rules, not by the JavaScript. If you change the data model,
re-test the rules accordingly.

## Notes & limits

- Deleting a dashboard cascade-deletes its entries client-side (batched). If a
  dashboard had hundreds of entries and the tab closes mid-delete, a few entry
  docs could be orphaned — re-run the delete to clean up.
- `entryCount` on each dashboard is a denormalized counter kept in sync on
  add/delete to avoid expensive count queries on the browse page.
