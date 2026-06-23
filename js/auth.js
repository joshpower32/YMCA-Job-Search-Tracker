// =====================================================================
//  auth.js — shared auth logic + header controls (used on both pages)
// =====================================================================
import { auth, db, isConfigured } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

let currentUser = null;
let currentIsAdmin = false;
let resolved = false;
const subscribers = [];
const adminCache = new Map();

export function getState() {
  return { user: currentUser, isAdmin: currentIsAdmin };
}

// Register a callback. Fires immediately if auth state is already known,
// and again on every future change. Signature: cb(user, isAdmin).
export function onAuth(cb) {
  subscribers.push(cb);
  if (resolved) cb(currentUser, currentIsAdmin);
}

function notify() {
  subscribers.forEach((cb) => cb(currentUser, currentIsAdmin));
}

async function checkAdmin(uid) {
  if (!uid) return false;
  if (adminCache.has(uid)) return adminCache.get(uid);
  try {
    const snap = await getDoc(doc(db, "admins", uid));
    const result = snap.exists();
    adminCache.set(uid, result);
    return result;
  } catch (err) {
    console.warn("Admin check failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------------
//  Toast helper (shared)
// ---------------------------------------------------------------------
export function showToast(message, isError = false) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = message;
  t.className = "toast show" + (isError ? " err" : "");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = "toast" + (isError ? " err" : ""); }, 3200);
}

// ---------------------------------------------------------------------
//  Friendly auth error messages
// ---------------------------------------------------------------------
function friendlyError(code) {
  const map = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/missing-password": "Enter a password.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/email-already-in-use": "An account already exists for that email. Try signing in.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "No account found for that email.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------------
//  Config guard — shows a banner if firebase-config.js isn't filled in
// ---------------------------------------------------------------------
export function ensureConfigured() {
  if (isConfigured) return true;
  const warn = document.getElementById("configWarn");
  if (warn) warn.classList.add("show");
  return false;
}

// ---------------------------------------------------------------------
//  Wire up the header auth controls (call once per page)
// ---------------------------------------------------------------------
export function initAuthUI() {
  const signedOut = document.getElementById("authSignedOut");
  const signInBtn = document.getElementById("authSignInBtn");
  const userBox = document.getElementById("authUser");
  const emailLabel = document.getElementById("authEmail");
  const adminBadge = document.getElementById("authAdminBadge");
  const signOutBtn = document.getElementById("authSignOutBtn");
  const popover = document.getElementById("authPopover");
  const emailInput = document.getElementById("authEmailInput");
  const passInput = document.getElementById("authPassInput");
  const errorBox = document.getElementById("authError");
  const doSignIn = document.getElementById("authDoSignIn");
  const doSignUp = document.getElementById("authDoSignUp");

  if (!ensureConfigured()) {
    // Keep the "Sign in" button visible but inert until configured.
    if (signInBtn) signInBtn.addEventListener("click", () =>
      showToast("Add your Firebase config in js/firebase-config.js first.", true));
    return;
  }

  const togglePopover = (show) => {
    if (!popover) return;
    popover.classList.toggle("show", show);
    if (show && emailInput) emailInput.focus();
    if (errorBox) errorBox.classList.remove("show");
  };

  if (signInBtn) signInBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePopover(!popover.classList.contains("show"));
  });

  // Close popover on outside click / Escape
  document.addEventListener("click", (e) => {
    if (popover && popover.classList.contains("show") &&
        !popover.contains(e.target) && e.target !== signInBtn) {
      togglePopover(false);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") togglePopover(false);
  });

  const showError = (msg) => {
    if (!errorBox) return;
    errorBox.textContent = msg;
    errorBox.classList.add("show");
  };

  const handle = async (fn) => {
    const email = emailInput.value.trim();
    const pass = passInput.value;
    if (!email) return showError("Enter your email.");
    if (!pass) return showError("Enter a password.");
    doSignIn.disabled = doSignUp.disabled = true;
    try {
      await fn(auth, email, pass);
      togglePopover(false);
      passInput.value = "";
    } catch (err) {
      showError(friendlyError(err.code));
    } finally {
      doSignIn.disabled = doSignUp.disabled = false;
    }
  };

  if (doSignIn) doSignIn.addEventListener("click", () => handle(signInWithEmailAndPassword));
  if (doSignUp) doSignUp.addEventListener("click", () => handle(createUserWithEmailAndPassword));
  if (passInput) passInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handle(signInWithEmailAndPassword);
  });
  if (signOutBtn) signOutBtn.addEventListener("click", () => signOut(auth));

  // React to auth state
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    currentIsAdmin = user ? await checkAdmin(user.uid) : false;
    resolved = true;

    if (user) {
      if (signedOut) signedOut.style.display = "none";
      if (userBox) userBox.classList.add("show");
      if (emailLabel) emailLabel.textContent = user.email || "Signed in";
      if (adminBadge) adminBadge.style.display = currentIsAdmin ? "inline-block" : "none";
    } else {
      if (signedOut) signedOut.style.display = "flex";
      if (userBox) userBox.classList.remove("show");
    }
    notify();
  });
}
