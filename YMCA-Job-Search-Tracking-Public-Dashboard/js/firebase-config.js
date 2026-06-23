// =====================================================================
//  firebase-config.js
//  1. Create a Firebase project: https://console.firebase.google.com
//  2. Add a Web app, then paste the config object it gives you below.
//  3. Enable Authentication > Email/Password, and create a Firestore DB.
//
//  NOTE: These keys are NOT secret. A Firebase web config only *identifies*
//  your project — security comes from your Firestore rules (see
//  firestore.rules). It is safe to commit this file to a public repo.
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// 🔻 REPLACE the placeholder strings below with your own project's config 🔻
const firebaseConfig = {
  apiKey: "AIzaSyAa7u5CsqotbFBGlG4lkDM8mv-0SgPZB2k",
  authDomain: "ymca-job-search-tracker.firebaseapp.com",
  projectId: "ymca-job-search-tracker",
  storageBucket: "ymca-job-search-tracker.firebasestorage.app",
  messagingSenderId: "57571085472",
  appId: "1:57571085472:web:00be2fe74dbc9b4f7c0dc5",
  measurementId: "G-C4317S7W6G"
};

// Tells the app whether you've finished the setup above.
export const isConfigured = !firebaseConfig.apiKey.startsWith("YOUR_");

let app, auth, db;
if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
