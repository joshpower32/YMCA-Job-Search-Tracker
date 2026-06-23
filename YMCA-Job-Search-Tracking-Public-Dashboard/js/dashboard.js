// =====================================================================
//  dashboard.js — a single dashboard: view, add, edit, delete entries
// =====================================================================
import { db } from "./firebase-config.js";
import {
  doc, getDoc, onSnapshot, collection, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, increment,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { initAuthUI, onAuth, getState, showToast, ensureConfigured } from "./auth.js";

const FIELDS = ["date","jobTitle","company","contactName","telephone","fax","email","source","followUpDate","feedback"];

const params = new URLSearchParams(location.search);
const dashId = params.get("id");

let dashboard = null;
let entries = [];
let auth = { user: null, isAdmin: false };
let editId = null;

const titleEl = document.getElementById("dashTitle");
const ownerEl = document.getElementById("dashOwner");
const tbody = document.getElementById("ledgerBody");
const ledgerWrap = document.getElementById("ledgerWrap");
const emptyState = document.getElementById("ledgerEmpty");
const addSection = document.getElementById("addSection");
const actionsHead = document.getElementById("actionsHead");

initAuthUI();

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmtDate(str) {
  if (!str) return "—";
  const d = new Date(str + "T00:00:00");
  if (isNaN(d)) return esc(str);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ---------- guard ----------
if (!dashId) {
  document.getElementById("dashMain").innerHTML =
    `<div class="state"><h3>No dashboard selected</h3>
     <p>Head back and pick a dashboard to open.</p>
     <a class="btn btn-primary" href="index.html">Back to all dashboards</a></div>`;
} else if (!ensureConfigured()) {
  document.getElementById("dashMain").innerHTML =
    `<div class="state"><h3>Almost there</h3>
     <p>Add your Firebase config in <code>js/firebase-config.js</code>, then refresh.</p></div>`;
} else {
  loadDashboard();
}

function loadDashboard() {
  // Live dashboard meta (so renames show up immediately)
  onSnapshot(doc(db, "dashboards", dashId), (snap) => {
    if (!snap.exists()) {
      document.getElementById("dashMain").innerHTML =
        `<div class="state"><h3>Dashboard not found</h3>
         <p>It may have been deleted.</p>
         <a class="btn btn-primary" href="index.html">Back to all dashboards</a></div>`;
      return;
    }
    dashboard = { id: snap.id, ...snap.data() };
    titleEl.textContent = dashboard.title;
    document.title = `${dashboard.title} — Job Search Tracker`;
    ownerEl.innerHTML = `Owned by <strong>${esc(dashboard.ownerEmail || "unknown")}</strong>`;
    applyPermissions();
  });

  // Live entries — order by application date (always present) so a freshly
  // added row doesn't briefly jump position while its server timestamp resolves.
  const q = query(collection(db, "dashboards", dashId, "entries"), orderBy("date", "desc"));
  onSnapshot(q, (snap) => {
    entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderEntries();
  }, (err) => {
    console.error(err);
    showToast("Couldn't load applications.", true);
  });
}

onAuth((user, isAdmin) => {
  auth = { user, isAdmin };
  applyPermissions();
  renderEntries();
});

function canManage() {
  return !!(dashboard && auth.user &&
    (dashboard.ownerUid === auth.user.uid || auth.isAdmin));
}

function applyPermissions() {
  const allowed = canManage();
  if (addSection) addSection.style.display = allowed ? "block" : "none";
  if (actionsHead) actionsHead.style.display = allowed ? "table-cell" : "none";
}

// ---------- render entries ----------
function followupChip(entry) {
  if (!entry.followUpDate) return "";
  const today = new Date(); today.setHours(0,0,0,0);
  const fu = new Date(entry.followUpDate + "T00:00:00");
  if (isNaN(fu)) return "";
  const diffDays = Math.round((fu - today) / 86400000);
  const hasFeedback = entry.feedback && entry.feedback.trim();
  if (hasFeedback) return `<span class="followup-chip ok">Followed up</span>`;
  if (diffDays < 0) return `<span class="followup-chip over">Overdue</span>`;
  if (diffDays <= 3) return `<span class="followup-chip due">Due soon</span>`;
  return "";
}

function contactCell(e) {
  const lines = [];
  if (e.contactName) lines.push(`<span class="contact-line"><b>${esc(e.contactName)}</b></span>`);
  if (e.telephone) lines.push(`<span class="contact-line">☎ ${esc(e.telephone)}</span>`);
  if (e.fax) lines.push(`<span class="contact-line">⎙ ${esc(e.fax)}</span>`);
  if (e.email) lines.push(`<span class="contact-line">✉ ${esc(e.email)}</span>`);
  return lines.length ? lines.join("") : `<span class="muted">—</span>`;
}

function renderEntries() {
  if (!tbody) return;
  const allowed = canManage();

  if (!entries.length) {
    ledgerWrap.style.display = "none";
    emptyState.style.display = "block";
    emptyState.innerHTML = allowed
      ? `<h3>No applications logged yet</h3><p>Add your first one using the form above.</p>`
      : `<h3>Nothing here yet</h3><p>The owner hasn't logged any applications on this dashboard.</p>`;
    return;
  }
  ledgerWrap.style.display = "block";
  emptyState.style.display = "none";

  tbody.innerHTML = entries.map((e) => `
    <tr>
      <td data-label="Date">${fmtDate(e.date)}</td>
      <td data-label="Job title"><strong>${esc(e.jobTitle || "—")}</strong></td>
      <td data-label="Company">${esc(e.company || "—")}</td>
      <td data-label="Contact">${contactCell(e)}</td>
      <td data-label="Source">${e.source ? `<span class="src-tag">${esc(e.source)}</span>` : `<span class="muted">—</span>`}</td>
      <td data-label="Follow-up">${fmtDate(e.followUpDate)}${followupChip(e) ? `<br>${followupChip(e)}` : ""}</td>
      <td data-label="Feedback">${e.feedback ? esc(e.feedback) : `<span class="muted">—</span>`}</td>
      ${allowed ? `<td data-label="Actions" class="col-actions">
        <button class="btn btn-quiet btn-sm" data-edit="${e.id}">Edit</button>
        <button class="btn btn-quiet btn-sm" data-del="${e.id}">Delete</button>
      </td>` : ""}
    </tr>`).join("");

  tbody.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => openEdit(b.dataset.edit)));
  tbody.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => deleteEntry(b.dataset.del)));
}

// ---------- form helpers ----------
function readForm(form) {
  const data = {};
  FIELDS.forEach((f) => {
    const el = form.querySelector(`[name="${f}"]`);
    data[f] = el ? el.value.trim() : "";
  });
  return data;
}
function writeForm(form, data) {
  FIELDS.forEach((f) => {
    const el = form.querySelector(`[name="${f}"]`);
    if (el) el.value = data[f] || "";
  });
}
function validate(data) {
  if (!data.date) return "Add the application date.";
  if (!data.jobTitle) return "Add the job title.";
  if (!data.company) return "Add the company name.";
  return null;
}
// Auto-suggest a follow-up date 2 weeks after the application date.
function wireFollowupAuto(form) {
  const dateEl = form.querySelector('[name="date"]');
  const fuEl = form.querySelector('[name="followUpDate"]');
  if (!dateEl || !fuEl) return;
  dateEl.addEventListener("change", () => {
    if (dateEl.value && !fuEl.value) {
      const d = new Date(dateEl.value + "T00:00:00");
      d.setDate(d.getDate() + 14);
      fuEl.value = d.toISOString().slice(0, 10);
    }
  });
}

// ---------- add ----------
const addForm = document.getElementById("addForm");
if (addForm) {
  wireFollowupAuto(addForm);
  // default the date field to today
  const todayStr = new Date().toISOString().slice(0, 10);
  const dateEl = addForm.querySelector('[name="date"]');
  if (dateEl && !dateEl.value) dateEl.value = todayStr;

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!canManage()) return showToast("Only the owner can add applications here.", true);
    const data = readForm(addForm);
    const err = validate(data);
    if (err) return showToast(err, true);
    const btn = addForm.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await addDoc(collection(db, "dashboards", dashId, "entries"), {
        ...data, createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "dashboards", dashId), { entryCount: increment(1) });
      addForm.reset();
      addForm.querySelector('[name="date"]').value = todayStr;
      showToast("Application added.");
    } catch (err2) {
      console.error(err2);
      showToast("Couldn't add application.", true);
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------- edit (modal) ----------
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
if (editForm) wireFollowupAuto(editForm);

function openEdit(id) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  editId = id;
  writeForm(editForm, entry);
  editModal.classList.add("show");
}
function closeEdit() { editModal.classList.remove("show"); editId = null; }

document.getElementById("editSave")?.addEventListener("click", async () => {
  if (!editId) return;
  const data = readForm(editForm);
  const err = validate(data);
  if (err) return showToast(err, true);
  try {
    await updateDoc(doc(db, "dashboards", dashId, "entries", editId), data);
    showToast("Application updated.");
    closeEdit();
  } catch (err2) {
    console.error(err2);
    showToast("Couldn't save changes.", true);
  }
});
document.getElementById("editCancel")?.addEventListener("click", closeEdit);
document.getElementById("editClose")?.addEventListener("click", closeEdit);
editModal?.addEventListener("click", (e) => { if (e.target === editModal) closeEdit(); });

// ---------- delete ----------
async function deleteEntry(id) {
  const entry = entries.find((e) => e.id === id);
  const label = entry ? `${entry.jobTitle || "this application"} at ${entry.company || ""}`.trim() : "this application";
  if (!confirm(`Delete ${label}?`)) return;
  try {
    await deleteDoc(doc(db, "dashboards", dashId, "entries", id));
    await updateDoc(doc(db, "dashboards", dashId), { entryCount: increment(-1) });
    showToast("Application deleted.");
  } catch (err) {
    console.error(err);
    showToast("Couldn't delete.", true);
  }
}

// ---------- collapsible add panel ----------
const collapsible = document.getElementById("addCollapsible");
document.getElementById("addToggle")?.addEventListener("click", () => {
  collapsible.classList.toggle("open");
});
