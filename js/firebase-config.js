// firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyAa7u5CsqotbFBGlG4lkDM8mv-0SgPZB2k",
  authDomain: "ymca-job-search-tracker.firebaseapp.com",
  projectId: "ymca-job-search-tracker",
  storageBucket: "ymca-job-search-tracker.firebasestorage.app",
  messagingSenderId: "57571085472",
  appId: "1:57571085472:web:00be2fe74dbc9b4f7c0dc5",
  measurementId: "G-C4317S7W6G"
};

const isConfigured = !firebaseConfig.apiKey.startsWith("YOUR_");

let app, auth, db;
if (isConfigured) {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js");
  const { getAuth } = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js");
  const { getFirestore } = await import("https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js");
  
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db, isConfigured };