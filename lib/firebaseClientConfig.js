/** Public web config for Firebase client SDK (Firestore lineups + leaderboard reads). */
function envStr(name) {
  const v = process.env[name];
  if (v == null) return "";
  return String(v).trim();
}

function getFirebaseClientConfig() {
  const projectId = envStr("FIREBASE_PROJECT_ID");
  if (!projectId) return null;

  const apiKey = envStr("FIREBASE_API_KEY");
  const authDomain = envStr("FIREBASE_AUTH_DOMAIN");
  const appId = envStr("FIREBASE_APP_ID");
  if (!apiKey || !authDomain || !appId) return null;

  const config = {
    apiKey,
    authDomain,
    projectId,
    storageBucket: envStr("FIREBASE_STORAGE_BUCKET") || `${projectId}.appspot.com`,
    messagingSenderId: envStr("FIREBASE_MESSAGING_SENDER_ID") || "",
    appId,
  };
  const measurementId = envStr("FIREBASE_MEASUREMENT_ID");
  if (measurementId) config.measurementId = measurementId;
  return config;
}
module.exports = { getFirebaseClientConfig };
