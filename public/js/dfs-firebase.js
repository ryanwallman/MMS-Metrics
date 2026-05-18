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
      if (!currentUser || !isCloudSlateId(slateId)) return null;
      const ref = doc(db, "lineups", lineupDocId(slateId, currentUser.uid));
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      const data = snap.data();
      const playerNorms = Array.isArray(data.playerNorms) ? data.playerNorms : [];
      if (!playerNorms.length) return null;
      const playerSalaries = Array.isArray(data.playerSalaries)
        ? data.playerSalaries.map((n) => Number(n) || 0)
        : null;
      return {
        playerNorms,
        playerSalaries,
        salaryUsed: Number(data.salaryUsed) || 0,
      };
    },
    async saveLineup(slateId, playerNorms, salaryUsed, playerSalaries) {
      if (!currentUser || !isCloudSlateId(slateId)) return;
      const norms = [...playerNorms];
      const salaries = playerSalaries.map((n) => Math.round(Number(n) || 0));
      if (norms.length !== 8 || salaries.length !== 8) {
        throw new Error("Lineup must include exactly 8 players with locked salaries.");
      }
      for (let i = 0; i < salaries.length; i += 1) {
        const sal = salaries[i];
        if (sal < 5000 || sal > 12000) {
          throw new Error(
            "Each player needs a locked salary between $5,000 and $12,000. Remove and re-add any player showing an invalid price, then save again."
          );
        }
      }
      const sum = salaries.reduce((s, n) => s + n, 0);
      const used = Math.round(Number(salaryUsed) || 0);
      if (Math.abs(sum - used) > 1) {
        throw new Error("Salary total does not match locked player prices.");
      }
      const slate = slateId.toUpperCase();
      const ref = doc(db, "lineups", lineupDocId(slate, currentUser.uid));
      try {
        await setDoc(ref, {
          slateId: slate,
          userId: currentUser.uid,
          displayName:
            currentUser.displayName || currentUser.email || "Player",
          playerNorms: norms,
          playerSalaries: salaries,
          salaryUsed: used,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        const code = err?.code || "";
        if (code === "permission-denied") {
          throw new Error(
            "Firestore blocked this save (missing or insufficient permissions). Republish firebase/firestore.rules from this repo, or ask an admin to remove any stray slateLocks documents in the Firebase console."
          );
        }
        throw err;
      }
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
