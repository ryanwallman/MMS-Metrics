"use strict";
const { normalizePlayerName } = require('./dfs');
const { normalizeScheduleTeamId } = require('./teamRosters');
const { finishedScheduleGameDedupeKey } = require('./matchupPredict');

function safeText(v){return (v||'').toString().trim();}
function toNumber(v){const n=Number(v);return Number.isFinite(n)?n:0;}

const OFFENSE_RATING_WEIGHT_HISTORICAL = 0.7;
const OFFENSE_RATING_WEIGHT_2026 = 0.3;
const TEAM_OVERALL_WEIGHT_PLAYER = 0.4;
const TEAM_OVERALL_WEIGHT_RECORD = 0.45;
const TEAM_OVERALL_WEIGHT_SOS = 0.15;
const REGULAR_SEASON_GAMES = 22;
/** Weights on standardized metrics within each era composite (sum = 1). */
const OFFENSE_METRIC_WEIGHTS = Object.freeze({
  ops: 0.52,
  iso: 0.16,
  tbPerPa: 0.26,
  runProd: 0.06,
});
const OFFENSE_METRIC_KEYS = Object.keys(OFFENSE_METRIC_WEIGHTS);

function computeOffenseRateBundle(pa, ab, bb, h, tb, r, rbi) {
  const paN = toNumber(pa);
  if (paN <= 0) return null;
  const abN = toNumber(ab);
  const bbN = toNumber(bb);
  const hN = toNumber(h);
  const tbN = toNumber(tb);
  const rN = toNumber(r);
  const rbiN = toNumber(rbi);

  if (abN + bbN <= 0) return null;

  const slg = abN > 0 ? tbN / abN : 0;
  const avg = abN > 0 ? hN / abN : 0;
  const iso = slg - avg;
  /** Walk-excluded OPS: batting average + slugging only. */
  const ops = avg + slg;
  const tbPerPa = tbN / paN;
  const runProd = (rN + rbiN) / paN;

  if (![ops, iso, tbPerPa, runProd].every((x) => Number.isFinite(x))) return null;

  return { ops, iso, tbPerPa, runProd };
}

function collectLeagueOffenseBundles(careerByPlayer, hist2025ByPlayer, stats2026ByPlayer) {
  const out = [];

  for (const [, c] of careerByPlayer.entries()) {
    const pa = toNumber(c.pa);
    const b = computeOffenseRateBundle(pa, c.ab, c.bb, c.h, c.tb, c.r, c.rbi);
    if (b) out.push({ pa, bundle: b });
  }

  for (const [, h] of hist2025ByPlayer.entries()) {
    const pa = toNumber(h.pa);
    const b = computeOffenseRateBundle(pa, h.ab, h.bb, h.h, h.tb, h.r, h.rbi);
    if (b) out.push({ pa, bundle: b });
  }

  for (const [, row] of stats2026ByPlayer.entries()) {
    const pa = toNumber(row.PA);
    const b = computeOffenseRateBundle(pa, row.AB, row.BB, row.Hits, row.TB, row.Runs, row.RBI);
    if (b) out.push({ pa, bundle: b });
  }

  return out;
}

function weightedMomentsPerMetric(observations) {
  const totPa = observations.reduce((s, o) => s + o.pa, 0);
  const moments = {};
  if (totPa <= 0) {
    for (const k of OFFENSE_METRIC_KEYS) {
      moments[k] = { mu: 0, sigma: 1 };
    }
    return { moments, totPa };
  }

  for (const key of OFFENSE_METRIC_KEYS) {
    const mu =
      observations.reduce((s, o) => s + o.pa * o.bundle[key], 0) / totPa;
    const variance =
      observations.reduce((s, o) => s + o.pa * (o.bundle[key] - mu) ** 2, 0) / totPa;
    const sigma = Math.sqrt(Math.max(variance, 1e-10));
    moments[key] = { mu, sigma };
  }

  return { moments, totPa };
}

function zScoresFromBundle(bundle, moments) {
  const z = {};
  for (const key of OFFENSE_METRIC_KEYS) {
    const { mu, sigma } = moments[key];
    z[key] = (bundle[key] - mu) / sigma;
  }
  return z;
}

function compositeZFromZScores(zObj) {
  let s = 0;
  for (const key of OFFENSE_METRIC_KEYS) {
    s += OFFENSE_METRIC_WEIGHTS[key] * zObj[key];
  }
  return s;
}

/** Career PA + bundle, else 2025 PA + bundle (same precedence as before). */
function historicalPaAndBundleForPlayer(normalizedKey, careerByPlayer, hist2025ByPlayer) {
  const c = careerByPlayer.get(normalizedKey);
  if (c && toNumber(c.pa) > 0) {
    const pa = toNumber(c.pa);
    const bundle = computeOffenseRateBundle(pa, c.ab, c.bb, c.h, c.tb, c.r, c.rbi);
    if (bundle) return { pa, bundle };
  }
  const h25 = hist2025ByPlayer.get(normalizedKey);
  if (h25 && toNumber(h25.pa) > 0) {
    const pa = toNumber(h25.pa);
    const bundle = computeOffenseRateBundle(pa, h25.ab, h25.bb, h25.h, h25.tb, h25.r, h25.rbi);
    if (bundle) return { pa, bundle };
  }
  return null;
}

function bundle2026FromRow(row2026) {
  const pa = toNumber(row2026.PA);
  if (pa <= 0) return null;
  return computeOffenseRateBundle(pa, row2026.AB, row2026.BB, row2026.Hits, row2026.TB, row2026.Runs, row2026.RBI);
}

function neutralCompositeZ() {
  return 0;
}

/** Rating blend when both career and 2026 exist; else the single available composite. */
function blendedOffenseRating(composite26, compositeHist, has26, hasHist, blendWeights) {
  const wHist = blendWeights?.historical ?? OFFENSE_RATING_WEIGHT_HISTORICAL;
  const w26 = blendWeights?.y2026 ?? OFFENSE_RATING_WEIGHT_2026;
  if (has26 && hasHist) {
    return wHist * compositeHist + w26 * composite26;
  }
  if (has26) return composite26;
  if (hasHist) return compositeHist;
  return neutralCompositeZ();
}

const DFS_SALARY_RATING_BLEND = Object.freeze({
  historical: OFFENSE_RATING_WEIGHT_HISTORICAL,
  y2026: OFFENSE_RATING_WEIGHT_2026,
});

function buildOffensivePlayerRows(
  teams,
  careerByPlayer,
  hist2025ByPlayer,
  stats2026ByPlayer,
  moments,
  blendWeights
) {
  const rows = [];

  for (const team of teams) {
    for (const playerName of team.players) {
      const norm = normalizePlayerName(playerName);
      const row2026 = stats2026ByPlayer.get(norm);
      const pa26 = row2026 ? toNumber(row2026.PA) : 0;

      const raw26 = row2026 && pa26 > 0 ? bundle2026FromRow(row2026) : null;
      const z26 = raw26 ? zScoresFromBundle(raw26, moments) : null;
      const composite26 = z26 ? compositeZFromZScores(z26) : neutralCompositeZ();
      const has26 = z26 != null;

      const histSample = historicalPaAndBundleForPlayer(norm, careerByPlayer, hist2025ByPlayer);
      const rawHist = histSample?.bundle ?? null;
      const zHist = rawHist ? zScoresFromBundle(rawHist, moments) : null;
      const compositeHist = zHist ? compositeZFromZScores(zHist) : null;
      const hasHist = zHist != null;

      const ratingRaw = blendedOffenseRating(
        composite26,
        compositeHist ?? 0,
        has26,
        hasHist,
        blendWeights
      );
      const ratingRounded = Number.isFinite(ratingRaw) ? Math.round(ratingRaw * 100) / 100 : 0;

      const opsDisplay26 =
        raw26 && Number.isFinite(raw26.ops) ? Math.round(raw26.ops * 1000) / 1000 : null;

      rows.push({
        playerName,
        norm,
        teamId: team.teamId,
        teamName: team.teamName,
        pa2026: pa26,
        composite2026: Number.isFinite(composite26) ? Math.round(composite26 * 1000) / 1000 : 0,
        compositeHist:
          compositeHist != null && Number.isFinite(compositeHist)
            ? Math.round(compositeHist * 1000) / 1000
            : null,
        ops2026Adj: opsDisplay26,
        tbPerPa2026:
          raw26 && Number.isFinite(raw26.tbPerPa) ? Math.round(raw26.tbPerPa * 1000) / 1000 : null,
        rating: ratingRounded,
      });
    }
  }

  rows.sort((a, b) => b.rating - a.rating);
  rows.forEach((r, i) => {
    r.leagueRank = i + 1;
  });
  return rows;
}

function buildTeamStandingsFromScheduleGames(parsedGames, teams) {
  const rec = new Map();
  for (const t of teams) {
    const id = normalizeScheduleTeamId(t.teamId);
    rec.set(id, { wins: 0, losses: 0, opponentIdsPerGame: [] });
  }

  const seen = new Set();
  for (const g of parsedGames) {
    const awayId = normalizeScheduleTeamId(g.awayId);
    const homeId = normalizeScheduleTeamId(g.homeId);
    if (!rec.has(awayId) || !rec.has(homeId)) continue;
    if (!Number.isFinite(g.awayScore) || !Number.isFinite(g.homeScore)) continue;
    if (g.awayScore === g.homeScore) continue;

    const dedupeKey = finishedScheduleGameDedupeKey(g);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    if (g.awayScore > g.homeScore) {
      rec.get(awayId).wins += 1;
      rec.get(homeId).losses += 1;
    } else {
      rec.get(homeId).wins += 1;
      rec.get(awayId).losses += 1;
    }
    rec.get(awayId).opponentIdsPerGame.push(homeId);
    rec.get(homeId).opponentIdsPerGame.push(awayId);
  }

  const standings = new Map();
  for (const [id, r] of rec.entries()) {
    const gamesPlayed = r.wins + r.losses;
    const winPct = gamesPlayed > 0 ? r.wins / gamesPlayed : null;
    standings.set(id, {
      wins: r.wins,
      losses: r.losses,
      gamesPlayed,
      winPct,
      sosOppWinPct: null,
    });
  }

  for (const [id, r] of rec.entries()) {
    let sosSum = 0;
    let sosN = 0;
    for (const oppId of r.opponentIdsPerGame) {
      const opp = standings.get(oppId);
      if (!opp || opp.gamesPlayed <= 0) continue;
      sosSum += opp.winPct;
      sosN += 1;
    }
    const row = standings.get(id);
    if (row) row.sosOppWinPct = sosN > 0 ? sosSum / sosN : null;
  }

  return standings;
}

function zScoresFromStandingsMetric(standingsMap, pickValue) {
  const z = new Map();
  const samples = [];
  for (const [id, row] of standingsMap.entries()) {
    const v = pickValue(row);
    if (v != null && Number.isFinite(v)) samples.push({ id, v });
  }
  for (const id of standingsMap.keys()) z.set(id, 0);
  if (!samples.length) return z;

  const mu = samples.reduce((s, x) => s + x.v, 0) / samples.length;
  const variance =
    samples.reduce((s, x) => s + (x.v - mu) ** 2, 0) / samples.length;
  const sigma = Math.sqrt(Math.max(variance, 1e-10));
  for (const { id, v } of samples) z.set(id, (v - mu) / sigma);
  return z;
}

function buildTeamOffenseSections(teamsInOrder, rankedRows, standingsMap) {
  const byTeam = new Map();
  for (const t of teamsInOrder) {
    byTeam.set(t.teamId, {
      teamId: t.teamId,
      teamName: t.teamName,
      jerseyColor: t.jerseyColor,
      numberColor: t.numberColor,
      players: [],
    });
  }
  for (const r of rankedRows) {
    const b = byTeam.get(r.teamId);
    if (b) b.players.push(r);
  }

  const recordZ = standingsMap
    ? zScoresFromStandingsMetric(standingsMap, (s) => s.winPct)
    : new Map();
  const sosZ = standingsMap
    ? zScoresFromStandingsMetric(standingsMap, (s) => s.sosOppWinPct)
    : new Map();

  const sections = teamsInOrder
    .map((t) => {
      const b = byTeam.get(t.teamId);
      if (!b) return null;
      b.players.sort((a, c) => c.rating - a.rating);
      const paSum = b.players.reduce((s, p) => s + p.pa2026, 0);
      let teamPlayerRating = 0;
      if (paSum > 0) {
        teamPlayerRating = b.players.reduce((s, p) => s + p.rating * p.pa2026, 0) / paSum;
      } else if (b.players.length) {
        teamPlayerRating = b.players.reduce((s, p) => s + p.rating, 0) / b.players.length;
      }
      teamPlayerRating = Number.isFinite(teamPlayerRating)
        ? Math.round(teamPlayerRating * 100) / 100
        : 0;

      const sid = normalizeScheduleTeamId(t.teamId);
      const st = standingsMap?.get(sid) || {
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
        winPct: null,
        sosOppWinPct: null,
      };

      const rz = recordZ.get(sid) ?? 0;
      const sz = sosZ.get(sid) ?? 0;
      let teamOffenseRating = teamPlayerRating;
      if (st.gamesPlayed > 0 && standingsMap) {
        teamOffenseRating =
          TEAM_OVERALL_WEIGHT_PLAYER * teamPlayerRating +
          TEAM_OVERALL_WEIGHT_RECORD * rz +
          TEAM_OVERALL_WEIGHT_SOS * sz;
      }
      teamOffenseRating = Number.isFinite(teamOffenseRating)
        ? Math.round(teamOffenseRating * 100) / 100
        : 0;

      return {
        ...b,
        teamPlayerRating,
        teamOffenseRating,
        teamWins: st.wins,
        teamLosses: st.losses,
        teamWinPct: st.winPct,
        teamSosOppWinPct: st.sosOppWinPct,
        teamRecordZ: st.gamesPlayed > 0 ? Math.round(rz * 1000) / 1000 : null,
        teamSosZ: st.sosOppWinPct != null ? Math.round(sz * 1000) / 1000 : null,
      };
    })
    .filter(Boolean);

  sections.sort((a, b) => {
    const d = b.teamOffenseRating - a.teamOffenseRating;
    if (d !== 0) return d;
    return (a.teamId || 0) - (b.teamId || 0);
  });

  return sections;
}

module.exports={
  OFFENSE_RATING_WEIGHT_HISTORICAL,
  OFFENSE_RATING_WEIGHT_2026,
  DFS_SALARY_RATING_BLEND,
  TEAM_OVERALL_WEIGHT_PLAYER,
  TEAM_OVERALL_WEIGHT_RECORD,
  TEAM_OVERALL_WEIGHT_SOS,
  collectLeagueOffenseBundles,
  weightedMomentsPerMetric,
  buildOffensivePlayerRows,
  buildTeamStandingsFromScheduleGames,
  buildTeamOffenseSections,
};
