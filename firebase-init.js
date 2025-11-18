// accounting/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  initializeFirestore,
  memoryLocalCache,
  setLogLevel
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

// 🔧 Enable Firestore debug logging (optional – can remove for production)
//setLogLevel("debug");

// ✅ Firebase Configuration for Accounting App
const firebaseConfig = {
  apiKey: "AIzaSyBaMBZpawyx2uUc-0_ImZtG7Ast8t2PjvM",
  authDomain: "oquway-c1160.firebaseapp.com",
  projectId: "oquway-c1160",
  storageBucket: "oquway-c1160.appspot.com",
  messagingSenderId: "54166550685",
  appId: "1:54166550685:web:8cd6c5e8a77b8a5558fc74",
  measurementId: "G-GKX81PPMKD"
};

// 🚀 Initialize Firebase
const app = initializeApp(firebaseConfig);

// 💾 Initialize Firestore (with memory cache)
const db = initializeFirestore(app, { localCache: memoryLocalCache() });

// 🔐 Initialize Auth and Storage
const auth = getAuth(app);
const storage = getStorage(app);

// ✅ Export everything you’ll use across the Accounting module
export { app, auth, db, storage };

// 🧠 Optional Debug Helper (remove in production)
export async function dumpAuthClaims(tag = "Auth") {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.warn(`[${tag}] No current user`);
      return;
    }
    const token = await user.getIdTokenResult(true);
  } catch (err) {
    console.error(`[${tag}] Failed to load claims:`, err);
  }
}
