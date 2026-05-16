/**
 * DFS Firebase: Google sign-in + Firestore lineups (week W# and Wednesday D########).
 * Loaded as type="module" on /dfs when firebaseClientConfig is present.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const config = window.__FIREBASE_CONFIG__;
if (!config?.projectId) {
  console.warn("DFS Firebase: missing config");
} else {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();

  let currentUser = null;
  let authReady = false;
  const authListeners = [];

  // Stay signed in across page visits (League Leaders → DFS → back, etc.)
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error("Firebase persistence:", err);
  });

  function isCloudSlateId(slateId) {
    const s = slateId || "";
    return /^W\d+$/i.test(s) || /^D\d{8}$/i.test(s);
  }

  function lineupDocId(slateId, uid) {
    return `${slateId.toUpperCase()}_${uid}`;
  }

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    authReady = true;
    authListeners.forEach((fn) => {
      try {
        fn(user);
      } catch (e) {
        console.error(e);
      }
    });
  });

  window.DfsFirebase = {
    isReady() {
      return !!currentUser;
    },
    getUser() {
      return currentUser;
    },
    onAuthChange(fn) {
      authListeners.push(fn);
      if (authReady) fn(currentUser);
    },
    isAuthReady() {
      return authReady;
    },
    async signInWithGoogle() {
      await signInWithPopup(auth, provider);
    },
    async signOut() {
      await signOut(auth);
    },
    async loadLineup(slateId) {
      if (!currentUser || !isWeekSlate(slateId)) return null;
      const ref = doc(db, "lineups", lineupDocId(slateId, currentUser.uid));
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data();
      return Array.isArray(data.playerNorms) ? data.playerNorms : null;
    },
    async saveLineup(slateId, playerNorms, salaryUsed) {
      if (!currentUser || !isCloudSlateId(slateId)) return;
      const slate = slateId.toUpperCase();
      const ref = doc(db, "lineups", lineupDocId(slate, currentUser.uid));
      await setDoc(ref, {
        slateId: slate,
        userId: currentUser.uid,
        displayName:
          currentUser.displayName || currentUser.email || "Player",
        playerNorms: [...playerNorms],
        salaryUsed: Number(salaryUsed) || 0,
        updatedAt: serverTimestamp(),
      });
      try {
        await setDoc(
          doc(db, "users", currentUser.uid),
          {
            displayName:
              currentUser.displayName || currentUser.email || "Player",
            email: currentUser.email || "",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (profileErr) {
        console.warn("User profile save skipped:", profileErr);
      }
    },
  };

  window.dispatchEvent(new Event("dfs-firebase-ready"));
}
