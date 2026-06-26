"use strict";
const { normalizeScheduleTeamId } = require('./teamRosters');
const { lookupPowerRankingsCaptain } = require('./powerRankingsCaptains');
const { referenceIsoForScheduleYear } = require('./dfs');
const { SCHEDULE_CALENDAR_YEAR } = require('./sheetUrls');
const {
  predictSeasonGameWinProbs,
  roundMatchupN,
} = require('./matchupPredict');

function safeText(v){return (v||'').toString().trim();}

const REGULAR_SEASON_GAMES = 22;

function defaultScheduleReferenceIso() {
  return referenceIsoForScheduleYear(SCHEDULE_CALENDAR_YEAR);
}

function isPlayedScheduleGame(g) {
  return (
    Number.isFinite(g.awayScore) &&
    Number.isFinite(g.homeScore) &&
    g.awayScore !== g.homeScore
  );
}

/** Completed game on or before reference date (excludes pre-entered future scores). */
function isPastPlayedScheduleGame(g, referenceIso) {
  const ref = safeText(referenceIso) || defaultScheduleReferenceIso();
  if (safeText(g?.isoDate) > ref) return false;
  return isPlayedScheduleGame(g);
}

/** Unplayed row on the schedule (not past-final and not a future placeholder score). */
function isUnplayedScheduleGame(g, referenceIso) {
  if (isPastPlayedScheduleGame(g, referenceIso)) return false;
  if (isPlayedScheduleGame(g)) return false;
  return true;
}

function filterPastPlayedScheduleGames(parsedGames, referenceIso) {
  const ref = safeText(referenceIso) || defaultScheduleReferenceIso();
  return (parsedGames || []).filter((g) => isPastPlayedScheduleGame(g, ref));
}

function buildRemainingScheduleGames(parsedGames, referenceIso) {
  const ref = safeText(referenceIso) || defaultScheduleReferenceIso();
  const seen = new Set();
  const remaining = [];
  for (const g of parsedGames) {
    if (!isUnplayedScheduleGame(g, ref)) continue;
    const awayId = normalizeScheduleTeamId(g.awayId);
    const homeId = normalizeScheduleTeamId(g.homeId);
    const gid = safeText(g.gameId);
    const key = gid ? `gid|${gid}` : `u|${g.isoDate || ""}|${[awayId, homeId].sort().join("|")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    remaining.push({ ...g, awayId, homeId });
  }
  remaining.sort((a, b) => {
    const d = (a.isoDate || "").localeCompare(b.isoDate || "");
    if (d !== 0) return d;
    return (a.rowIndex || 0) - (b.rowIndex || 0);
  });
  return remaining;
}

function heatMapRgb(t) {
  const clamped = Math.max(0, Math.min(1, t));
  const red = { r: 248, g: 113, b: 113 };
  const mid = { r: 254, g: 243, b: 199 };
  const green = { r: 74, g: 222, b: 128 };
  let r;
  let g;
  let b;
  if (clamped < 0.5) {
    const u = clamped / 0.5;
    r = red.r + (mid.r - red.r) * u;
    g = red.g + (mid.g - red.g) * u;
    b = red.b + (mid.b - red.b) * u;
  } else {
    const u = (clamped - 0.5) / 0.5;
    r = mid.r + (green.r - mid.r) * u;
    g = mid.g + (green.g - mid.g) * u;
    b = mid.b + (green.b - mid.b) * u;
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** Green = high value; red = low. Set invert for metrics where high is bad (e.g. SOS). */
function heatMapBackground(value, min, max, invert = false) {
  if (value == null || !Number.isFinite(value) || min == null || !Number.isFinite(min) || max == null || !Number.isFinite(max)) {
    return "";
  }
  if (max === min) return "background-color: #f3f4f6";
  let t = (value - min) / (max - min);
  if (invert) t = 1 - t;
  return `background-color: ${heatMapRgb(t)}`;
}

function applyPowerRankingsHeatMaps(rows) {
  const winVals = rows.map((r) => r.winPct).filter((v) => Number.isFinite(v));
  const sosVals = rows.map((r) => r.sosOppWinPct).filter((v) => Number.isFinite(v));
  const winMin = winVals.length ? Math.min(...winVals) : 0;
  const winMax = winVals.length ? Math.max(...winVals) : 1;
  const sosMin = sosVals.length ? Math.min(...sosVals) : 0;
  const sosMax = sosVals.length ? Math.max(...sosVals) : 1;
  return rows.map((r) => ({
    ...r,
    winPctHeatStyle: heatMapBackground(r.winPct, winMin, winMax, false),
    sosHeatStyle: heatMapBackground(r.sosOppWinPct, sosMin, sosMax, true),
  }));
}

function buildPowerRankingsCurrentRows(teamSections, captainMap) {
  const rows = teamSections.map((t, i) => ({
    rank: i + 1,
    teamId: t.teamId,
    teamName: t.teamName,
    captain: lookupPowerRankingsCaptain(captainMap, t.teamId, t.teamName),
    powerRating: t.teamOffenseRating,
    rosterRating: t.teamPlayerRating,
    wins: t.teamWins,
    losses: t.teamLosses,
    gamesPlayed: t.teamWins + t.teamLosses,
    winPct: t.teamWinPct,
    sosOppWinPct: t.teamSosOppWinPct,
  }));
  return applyPowerRankingsHeatMaps(rows);
}

/**
 * Project final W-L using current record + expected wins on remaining schedule
 * (matchup predictor win % per game).
 */
function attachCaptainsToProjectionRows(rows, captainMap) {
  for (const row of rows) {
    row.captain = lookupPowerRankingsCaptain(captainMap, row.teamId, row.teamName);
  }
  return rows;
}

function projectSeasonStandings(teams, standingsMap, teamProfiles, leagueNorms, runBase, parsedGames, referenceIso) {
  const remaining = buildRemainingScheduleGames(parsedGames, referenceIso);
  const rowsById = new Map();

  for (const t of teams) {
    const sid = normalizeScheduleTeamId(t.teamId);
    const st = standingsMap.get(sid) || {
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
    };
    rowsById.set(sid, {
      teamId: sid,
      teamName: t.teamName,
      currentWins: st.wins,
      currentLosses: st.losses,
      gamesPlayed: st.gamesPlayed,
      expFutureWins: 0,
      expFutureLosses: 0,
      scheduledRemaining: 0,
    });
  }

  let remainingGamesSimulated = 0;
  for (const g of remaining) {
    const awayProfile = teamProfiles.get(g.awayId);
    const homeProfile = teamProfiles.get(g.homeId);
    if (!awayProfile || !homeProfile) continue;

    const awayRow = rowsById.get(g.awayId);
    const homeRow = rowsById.get(g.homeId);
    if (!awayRow || !homeRow) continue;

    const awaySlotsLeft = REGULAR_SEASON_GAMES - awayRow.gamesPlayed - awayRow.scheduledRemaining;
    const homeSlotsLeft = REGULAR_SEASON_GAMES - homeRow.gamesPlayed - homeRow.scheduledRemaining;
    if (awaySlotsLeft <= 0 || homeSlotsLeft <= 0) continue;

    const { away: pAway, home: pHome } = predictSeasonGameWinProbs(
      awayProfile,
      homeProfile,
      leagueNorms,
      runBase
    );

    awayRow.expFutureWins += pAway;
    awayRow.expFutureLosses += pHome;
    awayRow.scheduledRemaining += 1;
    homeRow.expFutureWins += pHome;
    homeRow.expFutureLosses += pAway;
    homeRow.scheduledRemaining += 1;
    remainingGamesSimulated += 1;
  }

  const rows = [];
  for (const row of rowsById.values()) {
    const seasonGames = Math.min(
      REGULAR_SEASON_GAMES,
      row.gamesPlayed + row.scheduledRemaining
    );
    let projWins = row.currentWins + row.expFutureWins;
    let projLosses = row.currentLosses + row.expFutureLosses;
    const projGames = projWins + projLosses;
    if (projGames > seasonGames && projGames > 0) {
      const scale = seasonGames / projGames;
      projWins *= scale;
      projLosses *= scale;
    }
    let roundedWins = Math.round(projWins);
    let roundedLosses = Math.round(projLosses);
    if (roundedWins + roundedLosses !== seasonGames && seasonGames > 0) {
      roundedWins = Math.round((projWins / (projWins + projLosses)) * seasonGames);
      roundedLosses = seasonGames - roundedWins;
    }
    const expRestWins = roundedWins - row.currentWins;
    const expRestLosses = roundedLosses - row.currentLosses;
    const finalProjGames = projWins + projLosses;
    rows.push({
      ...row,
      projectedWins: roundMatchupN(projWins, 1),
      projectedLosses: roundMatchupN(projLosses, 1),
      projectedRecord: `${roundedWins}-${roundedLosses}`,
      projectedWinPct:
        finalProjGames > 0 ? roundMatchupN((projWins / finalProjGames) * 100, 1) : null,
      expRestRecord: `${expRestWins}-${expRestLosses}`,
      gamesToReachSeason: Math.max(0, REGULAR_SEASON_GAMES - row.gamesPlayed),
      seasonGames,
    });
  }

  rows.sort((a, b) => {
    const d = b.projectedWins - a.projectedWins;
    if (d !== 0) return d;
    const wp = (b.projectedWinPct ?? 0) - (a.projectedWinPct ?? 0);
    if (wp !== 0) return wp;
    return String(a.teamId).localeCompare(String(b.teamId), undefined, { numeric: true });
  });
  rows.forEach((r, i) => {
    r.projectedRank = i + 1;
  });

  return {
    rows,
    remainingGamesSimulated,
    remainingGamesTotal: remaining.length,
  };
}

function attachPowerRatingsToProjections(projectionRows, teamSections) {
  const powerById = new Map();
  const currentRankById = new Map();
  for (const t of teamSections) {
    const sid = normalizeScheduleTeamId(t.teamId);
    powerById.set(sid, t.teamOffenseRating);
  }
  teamSections.forEach((t, i) => {
    currentRankById.set(normalizeScheduleTeamId(t.teamId), i + 1);
  });
  for (const r of projectionRows) {
    r.powerRating = powerById.get(r.teamId) ?? null;
    r.currentPowerRank = currentRankById.get(r.teamId) ?? null;
  }
  return projectionRows;
}

module.exports={
  REGULAR_SEASON_GAMES,
  buildPowerRankingsCurrentRows,
  projectSeasonStandings,
  attachPowerRatingsToProjections,
  attachCaptainsToProjectionRows,
  isPlayedScheduleGame,
  isPastPlayedScheduleGame,
  isUnplayedScheduleGame,
  filterPastPlayedScheduleGames,
  defaultScheduleReferenceIso,
  buildRemainingScheduleGames,
  heatMapBackground,
};
