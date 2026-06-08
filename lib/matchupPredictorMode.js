"use strict";

const { sitePath } = require("./sitePaths");
const { matchupKeyToSlug } = require("./matchupSlug");

function safeText(value) {
  return (value || "").toString().trim();
}

/** @param {string} raw */
function normalizeMatchupPredictorMode(raw) {
  return safeText(raw).toLowerCase() === "past" ? "past" : "future";
}

function matchupPredictorModeLabel(mode) {
  return normalizeMatchupPredictorMode(mode) === "past" ? "Past" : "Future";
}

function matchupPredictorBasePath(mode, basePath = "") {
  const m = normalizeMatchupPredictorMode(mode);
  return sitePath(`/matchup-predictor/${m}`, basePath);
}

function matchupPredictorViewPath(mode, view, matchup = "", basePath = "") {
  const v = safeText(view).toUpperCase();
  let path = `${matchupPredictorBasePath(mode, basePath)}/view/${encodeURIComponent(v)}`;
  const key = safeText(matchup);
  if (key) {
    path += `/matchup/${encodeURIComponent(matchupKeyToSlug(key))}`;
  }
  return path;
}

function matchupModeFromRequestPath(pathname) {
  const p = safeText(pathname);
  if (/\/matchup-predictor\/past(?:\/|$)/i.test(p)) return "past";
  return "future";
}

module.exports = {
  normalizeMatchupPredictorMode,
  matchupPredictorModeLabel,
  matchupPredictorBasePath,
  matchupPredictorViewPath,
  matchupModeFromRequestPath,
};
