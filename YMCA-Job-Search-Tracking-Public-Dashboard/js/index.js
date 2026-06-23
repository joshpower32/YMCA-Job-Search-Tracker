// =====================================================================
//  index.js — browse all dashboards, create / rename / delete your own
// =====================================================================
import { db } from "./firebase-config.js";
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, updateDoc, deleteDoc, serverTimestamp, getDocs, writeBatch,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { initAuthUI, onAuth, getState, showToast, ensureConfigured } from "./auth.js";

let dashboards = [];
let auth = { user: null, isAdmin: false };
let renameTargetId = null;

const grid = document.getElementById("dashGrid");
const countTag = document.getElementById("dashCount");
const createWrap = document.getElementById("createWrap");
const createForm = document.getElementById("createForm");
const titleInput = document.getElementById("newTitle");
const signedOutNote = document.getElementById("createSignedOutNote");

initAuthUI();

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(ts) {
  if (!ts || !ts.toDate) return "just now";
  return ts.toDate().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ---------- live data ----------
if (ensureConfigured()) {
  const q = query(collection(db, "dashboards"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    dashboards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  }, (err) => {
    console.error(err);
    grid.innerHTML = `<div class="state"><h3>Couldn't load dashboards</h3>
      <p>Check your Firestore rules are published and the database exists.</p></div>`;
  });
} else {
  grid.innerHTML = `<div class="state"><h3>Almost there</h3>
    <p>Add your Firebase config in <code>js/firebase-config.js</code>, then refresh.</p></div>`;
}

onAuth((user, isAdmin) => {
  auth = { user, isAdmin };
  if (createWrap) {
    createWrap.style.display = user ? "block" : "none";
    if (signedOutNote) signedOutNote.style.display = user ? "none" : "block";
  }
  render();
});

// ---------- render ----------
function render() {
  if (!grid) return;
  countTag.textContent = dashboards.length
    ? `${dashboards.length} dashboard${dashboards.length === 1 ? "" : "s"}`
    : "";

  if (!dashboards.length) {
    grid.innerHTML = `<div class="state"><h3>No dashboards yet</h3>
      <p>${auth.user ? "Create the first one to start tracking applications."
        : "Sign in to create the first one."}</p></div>`;
    return;
  }

  grid.innerHTML = dashboards.map((d) => {
    const mine = auth.user && d.ownerUid === auth.user.uid;
    const canManage = mine || auth.isAdmin;
    const count = d.entryCount || 0;
    return `
    <article class="dash-card">
      <div class="dash-card-top">
        <h3>${esc(d.title)}</h3>
        ${mine ? `<span class="mine-tag">Yours</span>` : ""}
      </div>
      <div class="owner-row">
        <span>by ${esc(d.ownerEmail || "unknown")}</span>
      </div>
      <div class="dash-card-meta">
        <span><b>${count}</b> application${count === 1 ? "" : "s"}</span>
        <span>created ${fmtDate(d.createdAt)}</span>
      </div>
      <div class="dash-card-actions">
        <a class="btn btn-primary btn-sm" href="dashboard.html?id=${encodeURIComponent(d.id)}">Open</a>
        ${canManage ? `
          <button class="btn btn-ghost btn-sm" data-rename="${d.id}" data-title="${esc(d.title)}">Rename</button>
          <button class="btn btn-danger btn-sm" data-delete="${d.id}" data-title="${esc(d.title)}">Delete</button>
        ` : ""}
      </div>
    </article>`;
  }).join("");

  grid.querySelectorAll("[data-rename]").forEach((b) =>
    b.addEventListener("click", () => openRename(b.dataset.rename, b.dataset.title)));
  grid.querySelectorAll("[data-delete]").forEach((b) =>
    b.addEventListener("click", () => removeDashboard(b.dataset.delete, b.dataset.title)));
}

// ---------- create ----------
if (createForm) {
  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return showToast("Give your dashboard a title.", true);
    const { user } = getState();
    if (!user) return showToast("Sign in first.", true);
    const btn = createForm.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const ref = await addDoc(collection(db, "dashboards"), {
        title,
        ownerUid: user.uid,
        ownerEmail: user.email,
        entryCount: 0,
        createdAt: serverTimestamp(),
      });
      titleInput.value = "";
      showToast("Dashboard created.");
      window.location.href = `dashboard.html?id=${encodeURIComponent(ref.id)}`;
    } catch (err) {
      console.error(err);
      showToast("Couldn't create dashboard.", true);
    } finally {
      btn.disabled = false;
    }
  });
}

// ---------- rename (modal) ----------
const renameModal = document.getElementById("renameModal");
const renameInput = document.getElementById("renameInput");

function openRename(id, title) {
  renameTargetId = id;
  renameInput.value = title;
  renameModal.classList.add("show");
  renameInput.focus();
  renameInput.select();
}
function closeRename() {
  renameModal.classList.remove("show");
  renameTargetId = null;
}
document.getElementById("renameSave")?.addEventListener("click", async () => {
  const title = renameInput.value.trim();
  if (!title) return showToast("Title can't be empty.", true);
  try {
    await updateDoc(doc(db, "dashboards", renameTargetId), { title });
    showToast("Renamed.");
    closeRename();
  } catch (err) {
    console.error(err);
    showToast("Couldn't rename. Are you the owner?", true);
  }
});
document.getElementById("renameCancel")?.addEventListener("click", closeRename);
document.getElementById("renameClose")?.addEventListener("click", closeRename);
renameModal?.addEventListener("click", (e) => { if (e.target === renameModal) closeRename(); });
renameInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("renameSave").click(); });

// ---------- delete (cascade entries, then dashboard) ----------
async function removeDashboard(id, title) {
  if (!confirm(`Delete "${title}" and all its applications? This can't be undone.`)) return;
  try {
    const entriesSnap = await getDocs(collection(db, "dashboards", id, "entries"));
    // Batch deletes in chunks of 450 (Firestore limit is 500 ops/batch).
    let batch = writeBatch(db), ops = 0;
    for (const e of entriesSnap.docs) {
      batch.delete(e.ref);
      if (++ops >= 450) { await batch.commit(); batch = writeBatch(db); ops = 0; }
    }
    if (ops > 0) await batch.commit();
    await deleteDoc(doc(db, "dashboards", id));
    showToast("Dashboard deleted.");
  } catch (err) {
    console.error(err);
    showToast("Couldn't delete. Are you the owner?", true);
  }
}
