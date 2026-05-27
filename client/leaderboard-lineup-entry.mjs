/**
 * Browser: load a saved lineup for leaderboard detail view (GitHub Pages).
 */
import { configureCareerCsvForBrowser } from "../lib/sheetUrls.js";
import { getCachedDfsLeaderboardScoringContext } from "../lib/dfsLeaderboardScoringContext.js";
import {
  buildLineupDetailView,
  normalizeLineupRecord,
} from "../lib/dfsLeaderboard.js";
import { referenceIsoForScheduleYear } from "../lib/dfs.js";
import { SCHEDULE_CALENDAR_YEAR } from "../lib/sheetUrls.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const careerCsvUrl =
  (typeof window !== "undefined" && window.__MMS_CAREER_CSV_URL__) ||
  "/data/csv/career.csv";
configureCareerCsvForBrowser(careerCsvUrl);

function lineupFromClientDoc(snap) {
  if (!snap.exists()) return null;
  return normalizeLineupRecord(snap.data(), snap.id);
}

export async function loadLineupDetail(db, week, userId) {
  const slate = String(week || "")
    .trim()
    .toUpperCase();
  const uid = String(userId || "").trim();
  if (!slate || !uid) {
    return { error: "Missing week or player id." };
  }

  const { schedulePayload, scoringDeps } = await getCachedDfsLeaderboardScoringContext();
  const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
  const snap = await getDoc(doc(db, "lineups", `${slate}_${uid}`));
  const lineup = lineupFromClientDoc(snap);

  return buildLineupDetailView(
    lineup,
    slate,
    scoringDeps,
    schedulePayload,
    refIso,
    Date.now()
  );
}

if (typeof window !== "undefined") {
  window.MmsLeaderboardLineup = { loadLineupDetail };
}
