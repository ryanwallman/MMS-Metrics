/**
 * Browser bundle entry: score DFS leaderboard lineups using runtime sheet CSVs.
 */
import { configureCareerCsvForBrowser } from "../lib/sheetUrls.js";
import { buildWeeklyLeaderboardResponse } from "../lib/dfsLeaderboardResponse.js";
import { loadWeeklySchedule } from "../lib/dfsLeaderboardScoringContext.js";
import {
  referenceIsoForScheduleYear,
  resolveActiveDfsSlateToken,
  resolveMostRecentlyLockedSlateToken,
  listLeaderboardSlateOptions,
  defaultLeaderboardWeek,
} from "../lib/dfs.js";
import { invalidateSourceCsvCache, SCHEDULE_CALENDAR_YEAR, SOURCE_KEYS } from "../lib/sheetUrls.js";

let lastWeekOptionsSig = null;

function sitePath(path) {
  const base =
    typeof window !== "undefined" && window.__SITE_BASE_PATH__ != null
      ? String(window.__SITE_BASE_PATH__ || "")
      : "";
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function formatWeekOptionLabel(opt) {
  return opt.isPast ? opt.label : `${opt.label} (upcoming)`;
}

const careerCsvUrl =
  (typeof window !== "undefined" && window.__MMS_CAREER_CSV_URL__) ||
  "/data/csv/career.csv";
configureCareerCsvForBrowser(careerCsvUrl);

export async function scoreWeeklyLeaderboard(selectedWeek, lineups) {
  return buildWeeklyLeaderboardResponse(selectedWeek, lineups);
}

export async function fetchLiveLeaderboardWeekOptions(opts = {}) {
  if (opts.refreshSchedule) {
    await invalidateSourceCsvCache(SOURCE_KEYS.schedule);
  }
  const payload = await loadWeeklySchedule();
  const refIso = referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
  const nowMs = Date.now();
  const weekOptions = listLeaderboardSlateOptions(payload, refIso, nowMs);
  return {
    weekOptions,
    defaultWeek: defaultLeaderboardWeek(weekOptions, payload, refIso, nowMs),
    activeSlateToken: resolveActiveDfsSlateToken(payload, refIso, nowMs),
    defaultLockedSlateToken: resolveMostRecentlyLockedSlateToken(payload, refIso, nowMs),
  };
}

/** @deprecated use fetchLiveLeaderboardWeekOptions */
export async function fetchLiveSlateDefaults() {
  const live = await fetchLiveLeaderboardWeekOptions();
  return {
    activeSlateToken: live.activeSlateToken,
    defaultLockedSlateToken: live.defaultLockedSlateToken,
  };
}

export async function refreshLeaderboardWeekSelect() {
  const select = document.getElementById("week");
  if (!select) return false;

  const { weekOptions } = await fetchLiveLeaderboardWeekOptions({ refreshSchedule: true });
  const sig = weekOptions.map((o) => `${o.value}:${o.isPast ? 1 : 0}`).join("|");
  if (sig === lastWeekOptionsSig) return false;
  lastWeekOptionsSig = sig;

  const current = String(select.value || "").trim().toUpperCase();
  select.innerHTML = "";
  for (const opt of weekOptions) {
    const el = document.createElement("option");
    el.value = opt.value;
    el.dataset.href = sitePath(`/dfs/leaderboard/week/${encodeURIComponent(opt.value)}`);
    el.textContent = formatWeekOptionLabel(opt);
    if (opt.value.toUpperCase() === current) el.selected = true;
    select.appendChild(el);
  }

  const active = weekOptions.find((o) => o.value.toUpperCase() === current);
  if (active?.isPast) {
    const statusEl = document.getElementById("weeklySlateStatus");
    if (statusEl) statusEl.hidden = true;
    if (window.__LEADERBOARD_PAGE__?.slate) {
      window.__LEADERBOARD_PAGE__.slate.isPast = true;
      window.__LEADERBOARD_PAGE__.slate.canEdit = false;
      window.__LEADERBOARD_PAGE__.slate.isLocked = true;
      window.__LEADERBOARD_PAGE__.slateLocked = true;
    }
  }

  return true;
}

if (typeof window !== "undefined") {
  window.MmsLeaderboardScoring = {
    scoreWeeklyLeaderboard,
    fetchLiveSlateDefaults,
    fetchLiveLeaderboardWeekOptions,
    refreshLeaderboardWeekSelect,
  };
}
