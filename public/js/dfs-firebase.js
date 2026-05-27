/**
 * DFS Firestore lineups: device ID + display name (no sign-in).
 * Loaded as type="module" on /dfs when firebaseClientConfig is present.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const DEVICE_KEY = "mms-dfs-device-id";
const DEVICE_COOKIE = "mms_dfs_device_id";
const USERNAME_KEY = "mms-dfs-username";
const SUBMITTED_KEY = "mms-dfs-submitted-slates";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readCookie(name) {
  const prefix = `${name}=`;
  const parts = document.cookie.split(";").map((c) => c.trim());
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return "";
}

function writeCookie(name, value) {
  const maxAge = 60 * 60 * 24 * 400;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function isValidDeviceId(id) {
  return typeof id === "string" && UUID_RE.test(id);
}

function persistDeviceId(id) {
  try {
    localStorage.setItem(DEVICE_KEY, id);
  } catch {
    /* private mode / quota */
  }
  try {
    sessionStorage.setItem(DEVICE_KEY, id);
  } catch {
    /* ignore */
  }
  try {
    writeCookie(DEVICE_COOKIE, id);
  } catch {
    /* ignore */
  }
}

function readStoredDeviceId() {
  const candidates = [
    localStorage.getItem(DEVICE_KEY),
    sessionStorage.getItem(DEVICE_KEY),
    readCookie(DEVICE_COOKIE),
  ];
  for (const raw of candidates) {
    const id = String(raw || "").trim();
    if (isValidDeviceId(id)) return id;
  }
  return "";
}

function getOrCreateDeviceId() {
  let id = readStoredDeviceId();
  if (!id) {
    id = crypto.randomUUID();
    persistDeviceId(id);
  } else {
    persistDeviceId(id);
  }
  return id;
}

function getUsername() {
  return (localStorage.getItem(USERNAME_KEY) || "").trim();
}

function setUsername(name) {
  const trimmed = validateUsername(name);
  localStorage.setItem(USERNAME_KEY, trimmed);
  return trimmed;
}

function validateUsername(name) {
  const trimmed = String(name || "")
    .trim()
    .replace(/\s+/g, " ");
  if (trimmed.length > 24) {
    throw new Error("Display name must be 24 characters or fewer.");
  }
  if (!/^[\w .'-]+$/i.test(trimmed)) {
    throw new Error("Use letters, spaces, and . ' - only (e.g. Mitch P or John Smith).");
  }
  const parts = trimmed.split(" ").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Use your first name and last initial or last name (e.g. Mitch P or John Smith).");
  }
  if (parts[0].length < 2) {
    throw new Error("First name must be at least 2 letters.");
  }
  const last = parts[parts.length - 1];
  if (last.length < 1) {
    throw new Error("Include a last initial or last name after your first name.");
  }
  return trimmed;
}

function readSubmittedSlates() {
  try {
    const slates = JSON.parse(localStorage.getItem(SUBMITTED_KEY) || "[]");
    return Array.isArray(slates) ? slates.map((s) => String(s).toUpperCase()) : [];
  } catch {
    return [];
  }
}

function markSubmitted(slateId) {
  const slate = slateId.toUpperCase();
  const slates = readSubmittedSlates();
  if (!slates.includes(slate)) {
    slates.push(slate);
    localStorage.setItem(SUBMITTED_KEY, JSON.stringify(slates));
  }
}

function hasSubmittedLocal(slateId) {
  return readSubmittedSlates().includes(String(slateId || "").toUpperCase());
}

function isCloudSlateId(slateId) {
  const s = slateId || "";
  return /^W\d+$/i.test(s) || /^D\d{8}$/i.test(s);
}

function lineupDocId(slateId, deviceId) {
  return `${slateId.toUpperCase()}_${deviceId}`;
}

const config = window.__FIREBASE_CONFIG__;
if (!config?.projectId) {
  console.warn("DFS Firestore: missing config");
} else {
  const app = initializeApp(config);
  const db = getFirestore(app);

  window.DfsLineupStore = {
    getDeviceId: getOrCreateDeviceId,
    getUsername,
    setUsername,
    validateUsername,
    hasSubmittedLocal,
    isReady() {
      return true;
    },
    async hasLineupForSlate(slateId) {
      if (!isCloudSlateId(slateId)) return false;
      if (hasSubmittedLocal(slateId)) return true;
      const ref = doc(db, "lineups", lineupDocId(slateId, getOrCreateDeviceId()));
      const snap = await getDoc(ref);
      if (snap.exists()) markSubmitted(slateId);
      return snap.exists();
    },
    async loadLineup(slateId) {
      if (!isCloudSlateId(slateId)) return null;
      const ref = doc(db, "lineups", lineupDocId(slateId, getOrCreateDeviceId()));
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
        displayName: data.displayName || "",
      };
    },
    async saveLineup(slateId, playerNorms, salaryUsed, playerSalaries, displayName) {
      if (!isCloudSlateId(slateId)) {
        throw new Error("Cloud save is only for Sunday week slates (W1, W2, …) and Wednesday slates (D + date).");
      }
      const name = validateUsername(displayName || getUsername());
      setUsername(name);
      const deviceId = getOrCreateDeviceId();
      const slate = slateId.toUpperCase();
      const ref = doc(db, "lineups", lineupDocId(slate, deviceId));

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

      const payload = {
        slateId: slate,
        userId: deviceId,
        displayName: name,
        playerNorms: norms,
        playerSalaries: salaries,
        salaryUsed: used,
        updatedAt: serverTimestamp(),
      };

      try {
        const existing = await getDoc(ref);
        if (!existing.exists()) {
          payload.createdAt = serverTimestamp();
        }
        await setDoc(ref, payload);
      } catch (err) {
        const code = err?.code || "";
        if (code === "permission-denied") {
          throw new Error(
            "Firestore blocked this save. Republish firebase/firestore.rules from this repo (device-based rules, no sign-in)."
          );
        }
        throw err;
      }
      markSubmitted(slate);
    },
  };

  window.dispatchEvent(new Event("dfs-lineup-store-ready"));
}
