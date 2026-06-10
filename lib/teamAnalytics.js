"use strict";

const { normalizeScheduleTeamId } = require("./teamRosters");

function safeText(value) {
  return (value || "").toString().trim();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function gameKey(iso, teamCode, opponentCode) {
  return `${iso}|${safeText(teamCode).toUpperCase()}|${safeText(opponentCode).toUpperCase()}`;
}

function isActiveGamelogEntry(entry) {
  return entry && !entry.missedGame;
}

/** Unique active players in a game log (MG = missed / benched). */
function lineupSizeForGame(entries) {
  const norms = new Set();
  for (const entry of entries || []) {
    if (!isActiveGamelogEntry(entry)) continue;
    const norm = safeText(entry.norm);
    if (norm) norms.add(norm);
  }
  return norms.size;
}

function sumBattingTotals(entries) {
  const totals = {
    pa: 0,
    ab: 0,
    hits: 0,
    runs: 0,
    rbi: 0,
    bb: 0,
    tb: 0,
    hr: 0,
    singles: 0,
    doubles: 0,
    triples: 0,
  };
  for (const entry of entries || []) {
    if (!isActiveGamelogEntry(entry)) continue;
    totals.pa += toNumber(entry.pa);
    totals.ab += toNumber(entry.ab);
    totals.hits += toNumber(entry.hits);
    totals.runs += toNumber(entry.runs);
    totals.rbi += toNumber(entry.rbi);
    totals.bb += toNumber(entry.bb);
    totals.tb += toNumber(entry.tb);
    totals.hr += toNumber(entry.hr);
    totals.singles += toNumber(entry.singles);
    totals.doubles += toNumber(entry.doubles);
    totals.triples += toNumber(entry.triples);
  }
  return totals;
}

function battingRatesFromTotals(totals) {
  const ab = totals.ab;
  const denomObp = ab + totals.bb;
  const avg = ab > 0 ? totals.hits / ab : null;
  const obp = denomObp > 0 ? (totals.hits + totals.bb) / denomObp : null;
  const slg = ab > 0 ? totals.tb / ab : null;
  const ops = obp != null && slg != null ? obp + slg : null;
  return { avg, obp, slg, ops };
}

function mergeTotals(a, b) {
  const out = { ...a };
  for (const key of Object.keys(b)) {
    out[key] = (out[key] || 0) + (b[key] || 0);
  }
  return out;
}

function opponentRunsForGame(gamelogs, iso, teamCode, opponentCode) {
  const oppCode = safeText(opponentCode).toUpperCase();
  const ourCode = safeText(teamCode).toUpperCase();
  const slateKey = `${iso}|${oppCode}`;
  const entries = gamelogs?.bySlateKey?.get(slateKey) || [];
  let runs = 0;
  for (const entry of entries) {
    if (safeText(entry.opponentCode).toUpperCase() !== ourCode) continue;
    if (!isActiveGamelogEntry(entry)) continue;
    runs += toNumber(entry.runs);
  }
  return runs;
}

function findScheduleResult(parsedScheduleGames, teamId, iso, opponentTeamId) {
  const tid = normalizeScheduleTeamId(teamId);
  const oid = normalizeScheduleTeamId(opponentTeamId);
  if (!tid || !oid || !iso) return null;

  const game = (parsedScheduleGames || []).find((g) => {
    if (g.isoDate !== iso) return false;
    const away = normalizeScheduleTeamId(g.awayId);
    const home = normalizeScheduleTeamId(g.homeId);
    return (
      (away === tid && home === oid) ||
      (away === oid && home === tid)
    );
  });
  if (!game) return null;
  if (!Number.isFinite(game.awayScore) || !Number.isFinite(game.homeScore)) return null;
  if (game.awayScore === game.homeScore) return { result: "T", runsFor: null, runsAgainst: null };

  const isAway = normalizeScheduleTeamId(game.awayId) === tid;
  const runsFor = isAway ? game.awayScore : game.homeScore;
  const runsAgainst = isAway ? game.homeScore : game.awayScore;
  const won = runsFor > runsAgainst;
  return { result: won ? "W" : "L", runsFor, runsAgainst };
}

/** Gamelog rows are top-to-bottom by draft round within each team game. */
function assignDraftRounds(entries) {
  (entries || []).forEach((entry, idx) => {
    entry.draftRound = idx + 1;
  });
  return entries;
}

function missingDraftRounds(entries) {
  const rounds = [];
  (entries || []).forEach((entry, idx) => {
    if (!entry?.missedGame) return;
    rounds.push(entry.draftRound != null ? entry.draftRound : idx + 1);
  });
  return rounds;
}

function averageMissingDraftRound(entries) {
  const rounds = missingDraftRounds(entries);
  if (!rounds.length) return null;
  return rounds.reduce((sum, round) => sum + round, 0) / rounds.length;
}

/** Group gamelog rows into team games keyed by date + opponent (handles doubleheaders). */
function buildTeamGamesFromGamelogs(gamelogs, teamCode) {
  const code = safeText(teamCode).toUpperCase();
  if (!code || !gamelogs?.bySlateKey) return new Map();

  const games = new Map();
  for (const [slateKey, entries] of gamelogs.bySlateKey.entries()) {
    const [iso, rowCode] = slateKey.split("|");
    if (rowCode !== code) continue;
    for (const entry of entries) {
      const opp = safeText(entry.opponentCode).toUpperCase();
      if (!opp) continue;
      const key = gameKey(iso, code, opp);
      if (!games.has(key)) {
        games.set(key, {
          iso,
          teamCode: code,
          opponentCode: opp,
          entries: [],
        });
      }
      games.get(key).entries.push(entry);
    }
  }

  for (const game of games.values()) {
    assignDraftRounds(game.entries);
  }
  return games;
}

/**
 * Aggregate team performance by active lineup size (players not marked MG).
 * Returns buckets sorted largest lineup first.
 */
function buildTeamLineupAnalytics({
  teamId,
  teamCode,
  gamelogs,
  codeToTeamId,
  parsedScheduleGames = [],
}) {
  const games = buildTeamGamesFromGamelogs(gamelogs, teamCode);
  const bucketMap = new Map();

  for (const game of games.values()) {
    const lineupSize = lineupSizeForGame(game.entries);
    if (lineupSize <= 0) continue;

    const batting = sumBattingTotals(game.entries);
    const runsFor = batting.runs;
    const runsAgainst = opponentRunsForGame(
      gamelogs,
      game.iso,
      game.teamCode,
      game.opponentCode
    );

    const opponentTeamId = codeToTeamId?.get(game.opponentCode) || null;
    const schedule = opponentTeamId
      ? findScheduleResult(parsedScheduleGames, teamId, game.iso, opponentTeamId)
      : null;

    const runsForFinal =
      schedule?.runsFor != null && Number.isFinite(schedule.runsFor)
        ? schedule.runsFor
        : runsFor;
    const runsAgainstFinal =
      schedule?.runsAgainst != null && Number.isFinite(schedule.runsAgainst)
        ? schedule.runsAgainst
        : runsAgainst;

    let wins = 0;
    let losses = 0;
    let ties = 0;
    if (schedule?.result === "W") wins = 1;
    else if (schedule?.result === "L") losses = 1;
    else if (schedule?.result === "T") ties = 1;

    if (!bucketMap.has(lineupSize)) {
      bucketMap.set(lineupSize, {
        lineupSize,
        games: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        totals: sumBattingTotals([]),
        runsFor: 0,
        runsAgainst: 0,
        missingRoundSum: 0,
        missingRoundCount: 0,
      });
    }
    const bucket = bucketMap.get(lineupSize);
    bucket.games += 1;
    bucket.wins += wins;
    bucket.losses += losses;
    bucket.ties += ties;
    bucket.totals = mergeTotals(bucket.totals, batting);
    bucket.runsFor += runsForFinal;
    bucket.runsAgainst += runsAgainstFinal;
    for (const round of missingDraftRounds(game.entries)) {
      bucket.missingRoundSum += round;
      bucket.missingRoundCount += 1;
    }
  }

  const buckets = Array.from(bucketMap.values())
    .sort((a, b) => b.lineupSize - a.lineupSize)
    .map((bucket) => {
      const g = bucket.games;
      const rates = battingRatesFromTotals(bucket.totals);
      const decided = bucket.wins + bucket.losses;
      return {
        lineupSize: bucket.lineupSize,
        games: g,
        wins: bucket.wins,
        losses: bucket.losses,
        ties: bucket.ties,
        winPct: decided > 0 ? bucket.wins / decided : null,
        record: `${bucket.wins}-${bucket.losses}${bucket.ties ? `-${bucket.ties}` : ""}`,
        runsPerGame: g > 0 ? bucket.runsFor / g : null,
        runsAllowedPerGame: g > 0 ? bucket.runsAgainst / g : null,
        runDiffPerGame: g > 0 ? (bucket.runsFor - bucket.runsAgainst) / g : null,
        paPerGame: g > 0 ? bucket.totals.pa / g : null,
        hitsPerGame: g > 0 ? bucket.totals.hits / g : null,
        hrPerGame: g > 0 ? bucket.totals.hr / g : null,
        rbiPerGame: g > 0 ? bucket.totals.rbi / g : null,
        bbPerGame: g > 0 ? bucket.totals.bb / g : null,
        avg: rates.avg,
        obp: rates.obp,
        slg: rates.slg,
        ops: rates.ops,
        avgMissingRound:
          bucket.missingRoundCount > 0 ? bucket.missingRoundSum / bucket.missingRoundCount : null,
      };
    });

  return {
    teamId: normalizeScheduleTeamId(teamId),
    teamCode: safeText(teamCode).toUpperCase(),
    totalGames: games.size,
    buckets,
  };
}

function compareLineupRankingRows(a, b) {
  const wpA = a.winPct != null ? a.winPct : -1;
  const wpB = b.winPct != null ? b.winPct : -1;
  if (wpB !== wpA) return wpB - wpA;
  if (b.games !== a.games) return b.games - a.games;
  const diffA = a.runDiffPerGame != null ? a.runDiffPerGame : -Infinity;
  const diffB = b.runDiffPerGame != null ? b.runDiffPerGame : -Infinity;
  if (diffB !== diffA) return diffB - diffA;
  return safeText(a.teamName).localeCompare(safeText(b.teamName));
}

/**
 * League-wide team records by active lineup size, ranked within each size bucket.
 */
function buildLeagueLineupRankings({
  teams,
  teamCodeById,
  codeToTeamId,
  gamelogs,
  parsedScheduleGames = [],
}) {
  const rowsBySize = new Map();

  for (const team of teams || []) {
    const teamId = normalizeScheduleTeamId(team.teamId);
    const teamCode = teamCodeById?.get(teamId);
    if (!teamCode) continue;

    const analytics = buildTeamLineupAnalytics({
      teamId,
      teamCode,
      gamelogs,
      codeToTeamId,
      parsedScheduleGames,
    });

    for (const bucket of analytics.buckets) {
      if (!rowsBySize.has(bucket.lineupSize)) rowsBySize.set(bucket.lineupSize, []);
      rowsBySize.get(bucket.lineupSize).push({
        teamId,
        teamName: team.teamName,
        captain: team.captain,
        teamCode: analytics.teamCode,
        ...bucket,
      });
    }
  }

  return Array.from(rowsBySize.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([lineupSize, rows]) => {
      const ranked = rows.sort(compareLineupRankingRows).map((row, index) => ({
        ...row,
        rank: index + 1,
      }));
      return { lineupSize, rows: ranked };
    });
}

module.exports = {
  gameKey,
  lineupSizeForGame,
  sumBattingTotals,
  battingRatesFromTotals,
  assignDraftRounds,
  missingDraftRounds,
  averageMissingDraftRound,
  buildTeamGamesFromGamelogs,
  buildTeamLineupAnalytics,
  buildLeagueLineupRankings,
  opponentRunsForGame,
};
