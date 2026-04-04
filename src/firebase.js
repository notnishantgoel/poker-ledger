import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  onDisconnect,
  remove,
  runTransaction,
} from "firebase/database";

// ── Firebase Configuration ──
// Replace with your own Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyDLLGe-oKCclXfLfS2tWp0DrXgcgFQCB0s",
  authDomain: "poker-ledger-92286.firebaseapp.com",
  databaseURL: "https://poker-ledger-92286-default-rtdb.firebaseio.com",
  projectId: "poker-ledger-92286",
  storageBucket: "poker-ledger-92286.firebasestorage.app",
  messagingSenderId: "35959467824",
  appId: "1:35959467824:web:0719cd1d240d26e867e2f5",
};

let app, db;
let isInitialized = false;

try {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  isInitialized = !firebaseConfig.apiKey.includes("DummyKey");
} catch (e) {
  console.warn("Firebase init failed:", e.message);
}

// ── Session ID Generator ──
function generateSessionId() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let id = "";
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ── Create a new session ──
export async function createSession(gameState, hostName) {
  if (!isInitialized) throw new Error("Firebase not configured");
  const sessionId = generateSessionId();
  const sessionRef = ref(db, `sessions/${sessionId}`);
  
  // Check for collision (unlikely with 6 chars but be safe)
  const snapshot = await get(sessionRef);
  if (snapshot.exists()) return createSession(gameState, hostName); // retry
  
  await set(sessionRef, {
    host: hostName || "Host",
    createdAt: Date.now(),
    game: gameState,
    viewerCount: 1,
  });
  
  return sessionId;
}

// ── Join an existing session ──
export async function joinSession(sessionId) {
  if (!isInitialized) throw new Error("Firebase not configured");
  const sessionRef = ref(db, `sessions/${sessionId}`);
  const snapshot = await get(sessionRef);
  
  if (!snapshot.exists()) return null;
  
  // Increment viewer count
  const vcRef = ref(db, `sessions/${sessionId}/viewerCount`);
  await runTransaction(vcRef, (current) => (current || 0) + 1);
  
  return snapshot.val();
}

// ── Update game state ──
export async function updateSessionGame(sessionId, gameState) {
  if (!isInitialized || !sessionId) return;
  const gameRef = ref(db, `sessions/${sessionId}/game`);
  await set(gameRef, gameState);
}

// ── Listen for real-time changes ──
export function listenToSession(sessionId, callback) {
  if (!isInitialized || !sessionId) return () => {};
  const sessionRef = ref(db, `sessions/${sessionId}`);
  const unsubscribe = onValue(sessionRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    } else {
      callback(null); // session was deleted
    }
  });
  return unsubscribe;
}

// ── Track viewer presence ──
export function trackPresence(sessionId) {
  if (!isInitialized || !sessionId) return () => {};
  const vcRef = ref(db, `sessions/${sessionId}/viewerCount`);
  
  // On disconnect, decrement viewer count
  const disconnectRef = onDisconnect(vcRef);
  runTransaction(vcRef, (current) => (current || 0) + 1);
  disconnectRef.set(null); // We'll handle this differently
  
  return () => {
    runTransaction(vcRef, (current) => Math.max(0, (current || 1) - 1));
  };
}

// ── Delete a session ──
export async function deleteSession(sessionId) {
  if (!isInitialized || !sessionId) return;
  const sessionRef = ref(db, `sessions/${sessionId}`);
  await remove(sessionRef);
}

// ── Check if Firebase is ready ──
export function isFirebaseReady() {
  return isInitialized;
}

// ── Get the shareable URL for a session ──
export function getSessionUrl(sessionId) {
  const base = window.location.origin + window.location.pathname;
  return `${base}#/session/${sessionId}`;
}

// ── Parse session ID from URL hash ──
export function getSessionIdFromUrl() {
  const hash = window.location.hash;
  const match = hash.match(/^#\/session\/([a-z0-9]+)$/);
  return match ? match[1] : null;
}
