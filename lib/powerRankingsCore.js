"use strict";
const { normalizeScheduleTeamId } = require('./teamRosters');
const { lookupPowerRankingsCaptain } = require('./powerRankingsCaptains');
const {
  predictSeasonGameWinProbs,
  roundMatchupN,
} = require('./matchupPredict');

function safeText(v){return (v||'').toString().trim();}

const REGULAR_SEASON_GAMES = 22;


function isPlayedScheduleGame(g) {
  return (
    Number.isFinite(g.awayScore) &&
    Number.isFinite(g.homeScore) &&
    g.awayScore !== g.homeScore
  );
}

function buildRemainingScheduleGames(parsedGames) {
  const seen = new Set();
  const remaining = [];
  for (const g of parsedGames) {
    if (isPlayedScheduleGame(g)) continue;
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

function projectSeasonStandings(teams, standingsMap, teamProfiles, leagueNorms, runBase, parsedGames) {
  const remaining = buildRemainingScheduleGames(parsedGames);
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

    const { away: pAway, home: pHome } = predictSeasonGameWinProbs(
      awayProfile,
      homeProfile,
      leagueNorms,
      runBase
    );

    const awayRow = rowsById.get(g.awayId);
    const homeRow = rowsById.get(g.homeId);
    if (awayRow) {
      awayRow.expFutureWins += pAway;
      awayRow.expFutureLosses += pHome;
      awayRow.scheduledRemaining += 1;
    }
    if (homeRow) {
      homeRow.expFutureWins += pHome;
      homeRow.expFutureLosses += pAway;
      homeRow.scheduledRemaining += 1;
    }
    remainingGamesSimulated += 1;
  }

  const rows = [];
  for (const row of rowsById.values()) {
    const projWins = row.currentWins + row.expFutureWins;
    const projLosses = row.currentLosses + row.expFutureLosses;
    const projGames = projWins + projLosses;
    const roundedWins = Math.round(projWins);
    const roundedLosses = Math.round(projLosses);
    const expRestWins = roundedWins - row.currentWins;
    const expRestLosses = roundedLosses - row.currentLosses;
    rows.push({
      ...row,
      projectedWins: roundMatchupN(projWins, 1),
      projectedLosses: roundMatchupN(projLosses, 1),
      projectedRecord: `${roundedWins}-${roundedLosses}`,
      projectedWinPct:
        projGames > 0 ? roundMatchupN((projWins / projGames) * 100, 1) : null,
      expRestRecord: `${expRestWins}-${expRestLosses}`,
      gamesToReachSeason: Math.max(0, REGULAR_SEASON_GAMES - row.gamesPlayed),
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
};
