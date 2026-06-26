"use strict";

const { normalizePlayerName } = require("./dfs");
const { normalizeScheduleTeamId } = require("./teamRosters");
const { isPlayedScheduleGame } = require("./powerRankingsCore");
const { isRegularSeasonScheduleGame } = require("./regularSeasonSchedule");
const { heatMapBackground } = require("./powerRankingsCore");
const {
  buildTeamStandingsFromScheduleGames,
  buildTeamOffenseSections,
} = require("./offenseRankingsPage");

function safeText(v) {
  return (v || "").toString().trim();
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const STAT_CATEGORIES = Object.freeze([
  { key: "avg", label: "AVG", format: (v) => v.toFixed(3) },
  { key: "slg", label: "SLG", format: (v) => v.toFixed(3) },
  { key: "obp", label: "OBP", format: (v) => v.toFixed(3) },
  { key: "hr", label: "HR", format: (v) => String(Math.round(v)) },
  { key: "ops", label: "OPS", format: (v) => v.toFixed(3) },
]);

function scheduleIsosForOptions(schedulePayload) {
  const parsed = schedulePayload?.parsedGames || [];
  const seen = new Set();
  const isos = [];
  for (const g of parsed) {
    const iso = safeText(g.isoDate);
    if (!iso || seen.has(iso)) continue;
    const wd = new Date(`${iso}T12:00:00`).getDay();
    if (wd !== 0 && wd !== 3) continue;
    seen.add(iso);
    isos.push(iso);
  }
  isos.sort((a, b) => a.localeCompare(b));
  return isos;
}

function buildWeeklyPowerHistory(schedulePayload, teams, leagueRows) {
  const options = schedulePayload?.scheduleOptions || [];
  const isos = scheduleIsosForOptions(schedulePayload);
  const parsedGames = schedulePayload?.parsedGames || [];
  const frames = [];

  for (let i = 0; i < options.length; i += 1) {
    const cutoffIso = isos[i];
    if (!cutoffIso) continue;

    const playedGames = parsedGames.filter(
      (g) =>
        isRegularSeasonScheduleGame(g) &&
        isPlayedScheduleGame(g) &&
        safeText(g.isoDate) <= cutoffIso
    );
    const standings = buildTeamStandingsFromScheduleGames(playedGames, teams);
    const sections = buildTeamOffenseSections(teams, leagueRows, standings);

    frames.push({
      key: options[i].value,
      label: options[i].label,
      cutoffIso,
      gamesPlayed: playedGames.length,
      rankings: sections.map((t, idx) => ({
        rank: idx + 1,
        teamId: t.teamId,
        teamName: t.teamName,
        powerRating: t.teamOffenseRating,
        color: safeText(t.jerseyColor) || "#64748b",
      })),
    });
  }

  return frames;
}

function buildTeamBattingProfiles(teams, stats2026ByPlayer) {
  const profiles = [];

  for (const team of teams) {
    let ab = 0;
    let bb = 0;
    let hits = 0;
    let tb = 0;
    let hr = 0;

    for (const name of team.players || []) {
      const row = stats2026ByPlayer.get(normalizePlayerName(name));
      if (!row) continue;
      ab += toNumber(row.AB);
      bb += toNumber(row.BB);
      hits += toNumber(row.Hits);
      tb += toNumber(row.TB);
      hr += toNumber(row.HR);
    }

    const avg = ab > 0 ? hits / ab : 0;
    const slg = ab > 0 ? tb / ab : 0;
    const obp = ab + bb > 0 ? (hits + bb) / (ab + bb) : 0;
    const ops = obp + slg;

    profiles.push({
      teamId: normalizeScheduleTeamId(team.teamId),
      teamName: team.teamName,
      color: safeText(team.jerseyColor) || "#64748b",
      avg,
      slg,
      obp,
      hr,
      ops,
    });
  }

  return profiles;
}

function statMinMax(profiles, key) {
  const vals = profiles.map((p) => p[key]).filter((v) => Number.isFinite(v));
  if (!vals.length) return { min: 0, max: 1 };
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

function normalizeStat(value, min, max) {
  if (!Number.isFinite(value)) return 0;
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

function enrichTeamStatProfiles(profiles) {
  const bounds = {};
  for (const { key } of STAT_CATEGORIES) {
    bounds[key] = statMinMax(profiles, key);
  }

  return profiles.map((p) => {
    const normalized = {};
    const heatStyle = {};
    for (const { key } of STAT_CATEGORIES) {
      const { min, max } = bounds[key];
      normalized[key] = normalizeStat(p[key], min, max);
      heatStyle[key] = heatMapBackground(p[key], min, max, false);
    }
    return { ...p, normalized, heatStyle };
  });
}

function buildPowerTrendSeries(weeklyHistory, teams) {
  const teamMeta = new Map(
    teams.map((t) => [
      normalizeScheduleTeamId(t.teamId),
      { teamName: t.teamName, color: safeText(t.jerseyColor) || "#64748b" },
    ])
  );

  const labels = weeklyHistory.map((f) => ({ key: f.key, label: f.label }));
  const byTeam = new Map();

  for (const frame of weeklyHistory) {
    for (const row of frame.rankings) {
      const sid = normalizeScheduleTeamId(row.teamId);
      if (!byTeam.has(sid)) {
        const meta = teamMeta.get(sid) || { teamName: row.teamName, color: row.color };
        byTeam.set(sid, {
          teamId: sid,
          teamName: meta.teamName,
          color: meta.color || row.color,
          points: [],
        });
      }
      byTeam.get(sid).points.push({
        key: frame.key,
        label: frame.label,
        powerRating: row.powerRating,
        rank: row.rank,
      });
    }
  }

  return { labels, teams: Array.from(byTeam.values()) };
}

function buildPowerRankingsVizData(schedulePayload, teams, leagueRows, stats2026ByPlayer) {
  const weeklyHistory = buildWeeklyPowerHistory(schedulePayload, teams, leagueRows);
  const teamStatProfiles = enrichTeamStatProfiles(
    buildTeamBattingProfiles(teams, stats2026ByPlayer)
  );
  const powerTrends = buildPowerTrendSeries(weeklyHistory, teams);

  return {
    statCategories: STAT_CATEGORIES.map(({ key, label, format }) => ({ key, label, format })),
    weeklyHistory,
    teamStatProfiles,
    powerTrends,
  };
}

module.exports = {
  STAT_CATEGORIES,
  buildPowerRankingsVizData,
  buildWeeklyPowerHistory,
  buildTeamBattingProfiles,
};
