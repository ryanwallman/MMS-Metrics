/**
 * GitHub Pages: live matchup dropdown, season record, and MG roster refresh.
 * Loaded on every static matchup predictor page (including week index views).
 */
import { configureCareerCsvForBrowser } from "../lib/sheetUrls.js";

configureCareerCsvForBrowser();
import "./matchup-live.mjs";
