const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

let firestore = null;

function loadServiceAccount() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    try {
      return JSON.parse(inline);
    } catch {
      return null;
    }
  }

  const credPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.join(__dirname, "..", "firebase", "service-account.json");

  if (!fs.existsSync(credPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(credPath, "utf8"));
  } catch {
    return null;
  }
}

function getAdminFirestore() {
  if (firestore) return firestore;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccount = loadServiceAccount();
  if (!projectId || !serviceAccount) return null;

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  }

  firestore = admin.firestore();
  return firestore;
}

function isFirebaseAdminConfigured() {
  return !!(process.env.FIREBASE_PROJECT_ID && loadServiceAccount());
}

module.exports = { getAdminFirestore, isFirebaseAdminConfigured };
