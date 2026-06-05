/**
 * Update matchup prediction DOM from a client-side prediction result.
 */
(function () {
  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function favoriteSideFromPct(awayPct, homePct) {
    if (awayPct > homePct) return "away";
    if (homePct > awayPct) return "home";
    return null;
  }

  function winnerSideFromPrediction(prediction) {
    const fs = prediction.lines?.finalScore;
    if (fs?.winnerSide) return fs.winnerSide;
    const awayR = parseFloat(prediction.projectedRuns?.away);
    const homeR = parseFloat(prediction.projectedRuns?.home);
    if (!Number.isFinite(awayR) || !Number.isFinite(homeR)) return null;
    if (awayR > homeR) return "away";
    if (homeR > awayR) return "home";
    const awayPct = prediction.winPct?.away;
    const homePct = prediction.winPct?.home;
    return homePct >= awayPct ? "home" : "away";
  }

  function updatePredictionUi(prediction) {
    if (!prediction) return;
    const section = document.querySelector(".matchup-prediction");
    if (!section) return;

    const awayPct = prediction.winPct.away;
    const homePct = prediction.winPct.home;
    const modelPickSide = prediction.favoriteSide || favoriteSideFromPct(awayPct, homePct);
    const awayName = prediction.awayLabel || "Away";
    const homeName = prediction.homeLabel || "Home";

    const awayTeam = section.querySelector(".matchup-pred-away");
    const homeTeam = section.querySelector(".matchup-pred-home");
    if (awayTeam) {
      const awayNameEl = awayTeam.querySelector(".matchup-pred-team-name");
      if (awayNameEl) {
        awayNameEl.innerHTML =
          '<span class="matchup-side-tag">Away</span>' + awayName;
      }
      const pct = awayTeam.querySelector(".matchup-pred-pct");
      setText(pct, `${awayPct}%`);
      const bar = awayTeam.querySelector(".matchup-pred-bar");
      if (bar) {
        bar.style.width = `${awayPct}%`;
        bar.classList.toggle("matchup-pred-bar--leader", modelPickSide === "away");
        bar.classList.toggle("matchup-pred-bar--trailer", modelPickSide !== "away");
      }
    }
    if (homeTeam) {
      const homeNameEl = homeTeam.querySelector(".matchup-pred-team-name");
      if (homeNameEl) {
        homeNameEl.innerHTML =
          '<span class="matchup-side-tag">Home</span>' + homeName;
      }
      const pct = homeTeam.querySelector(".matchup-pred-pct");
      setText(pct, `${homePct}%`);
      const bar = homeTeam.querySelector(".matchup-pred-bar");
      if (bar) {
        bar.style.width = `${homePct}%`;
        bar.classList.toggle("matchup-pred-bar--leader", modelPickSide === "home");
        bar.classList.toggle("matchup-pred-bar--trailer", modelPickSide !== "home");
      }
    }

    const tbody = section.querySelector(".matchup-pred-lines tbody");
    if (!tbody) return;

    const winnerSide = winnerSideFromPrediction(prediction);
    const runLineSide =
      prediction.lines?.runLine?.side || winnerSide;

    const rows = tbody.querySelectorAll("tr");
    rows.forEach((row) => {
      const lineCell = row.cells[0];
      if (!lineCell) return;
      const line = lineCell.textContent.trim();

      if (line === "Predicted final score") {
        const teamCell = row.cells[1];
        const valueCell = row.cells[2];
        if (teamCell) {
          teamCell.className =
            "matchup-lines-team matchup-lines-team--" +
            winnerSide +
            " matchup-lines-team--winner";
          teamCell.innerHTML =
            '<span class="matchup-side-tag matchup-side-tag--winner">Winner</span>' +
            (winnerSide === "away" ? awayName : homeName);
        }
        if (valueCell) {
          const awayRuns = prediction.projectedRuns.away;
          const homeRuns = prediction.projectedRuns.home;
          valueCell.innerHTML =
            '<span class="matchup-score-runs ' +
            (winnerSide === "away" ? "matchup-score-runs--winner" : "matchup-score-runs--loser") +
            '">' +
            awayRuns +
            '</span><span class="matchup-score-sep">–</span><span class="matchup-score-runs ' +
            (winnerSide === "home" ? "matchup-score-runs--winner" : "matchup-score-runs--loser") +
            '">' +
            homeRuns +
            "</span>";
        }
      } else if (line.indexOf("Over / under") === 0) {
        setText(row.cells[2], "O/U " + prediction.lines.overUnder);
      } else if (line === "Run line") {
        const runLine = prediction.lines.runLine || {};
        const teamCell = row.cells[1];
        if (teamCell) {
          teamCell.className =
            "matchup-lines-team matchup-lines-team--" + runLineSide + " matchup-lines-team--favorite";
          teamCell.innerHTML =
            '<span class="matchup-side-tag">' +
            (runLineSide === "away" ? "Away" : "Home") +
            "</span>" +
            (runLineSide === "away" ? awayName : homeName);
        }
        const val = runLine.value || "—";
        const strong = row.cells[2]?.querySelector("strong");
        if (strong) strong.textContent = val;
      } else if (line === "Moneyline") {
        const teamCell = row.cells[1];
        const isAway = teamCell && teamCell.classList.contains("matchup-lines-team--away");
        const isHome = teamCell && teamCell.classList.contains("matchup-lines-team--home");
        if (isAway) {
          const strong = row.cells[2]?.querySelector("strong");
          if (strong) strong.textContent = prediction.lines.moneylineAway || "—";
          if (teamCell) {
            const pick = teamCell.querySelector(".matchup-bet-model-pick");
            if (modelPickSide === "away") {
              if (!pick) {
                teamCell.insertAdjacentHTML(
                  "beforeend",
                  ' <span class="matchup-bet-model-pick">Model pick</span>'
                );
              }
            } else if (pick) {
              pick.remove();
            }
          }
        } else if (isHome) {
          const strong = row.cells[2]?.querySelector("strong");
          if (strong) strong.textContent = prediction.lines.moneylineHome || "—";
          if (teamCell) {
            const pick = teamCell.querySelector(".matchup-bet-model-pick");
            if (modelPickSide === "home") {
              if (!pick) {
                teamCell.insertAdjacentHTML(
                  "beforeend",
                  ' <span class="matchup-bet-model-pick">Model pick</span>'
                );
              }
            } else if (pick) {
              pick.remove();
            }
          }
        }
      }
    });
  }

  function updateActiveCounts(awayActive, homeActive, awayTotal, homeTotal) {
    document.querySelectorAll(".matchup-roster-active-count").forEach((el) => {
      const col = el.closest(".schedule-roster-col--away, .schedule-roster-col--home");
      if (!col) return;
      const isAway = col.classList.contains("schedule-roster-col--away");
      const active = isAway ? awayActive : homeActive;
      const total = isAway ? awayTotal : homeTotal;
      el.textContent = `${active} of ${total} active`;
    });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function sideTag(side) {
    return side === "away" ? "Away" : "Home";
  }

  function renderDoubleBatterCard(alert) {
    const db = alert.doubleBatter;
    const imp = db && db.impact;
    if (!db) return "";
    let html =
      '<div class="matchup-lineup-alert matchup-lineup-alert--rule matchup-lineup-alert--double-batter">' +
      '<p class="matchup-lineup-alert-team"><span class="matchup-side-tag">' +
      escapeHtml(sideTag(alert.teamSide)) +
      "</span> " +
      escapeHtml(alert.teamName) +
      "</p>" +
      "<p class=\"matchup-lineup-alert-heading\"><strong>" +
      escapeHtml(alert.title) +
      "</strong></p>" +
      '<p class="matchup-lineup-alert-msg">' +
      escapeHtml(alert.message) +
      "</p>" +
      '<div class="matchup-double-batter-card">' +
      '<p class="matchup-double-batter-who"><span class="matchup-double-batter-badge">2× in lineup</span> ' +
      "<strong>" +
      escapeHtml(db.name) +
      '</strong> <span class="matchup-double-batter-meta">(Round ' +
      escapeHtml(db.round) +
      " pick)</span></p>" +
      '<p class="matchup-double-batter-reason">' +
      escapeHtml(db.reason) +
      "</p>";
    if (imp && imp.missingNamesLabel) {
      html +=
        '<p class="matchup-double-batter-missing"><strong>On bench:</strong> ' +
        escapeHtml(imp.missingNamesLabel) +
        "</p>";
    }
    html += "</div></div>";
    return html;
  }

  function renderNoteAlert(alert) {
    return (
      '<div class="matchup-lineup-alert matchup-lineup-alert--' +
      escapeHtml(alert.severity || "info") +
      '">' +
      '<p class="matchup-lineup-alert-team"><span class="matchup-side-tag">' +
      escapeHtml(sideTag(alert.teamSide)) +
      "</span> " +
      escapeHtml(alert.teamName) +
      "</p>" +
      "<p class=\"matchup-lineup-alert-heading\"><strong>" +
      escapeHtml(alert.title) +
      "</strong></p>" +
      '<p class="matchup-lineup-alert-msg">' +
      escapeHtml(alert.message) +
      "</p></div>"
    );
  }

  function renderPlayerNameHtml(p) {
    if (p.isReplacement && p.replacedName) {
      return (
        '<span class="matchup-roster-replaced-name">' +
        escapeHtml(p.replacedName) +
        "</span> " +
        escapeHtml(p.name) +
        '<span class="matchup-replacement-tag" title="Mid-season replacement">Replacement</span>'
      );
    }
    return escapeHtml(p.name);
  }

  function updateRosterRows(roster, side) {
    if (!roster || !roster.playersDetailed) return;
    for (const p of roster.playersDetailed) {
      const btn = document.querySelector(
        '[data-lineup-toggle][data-side="' + side + '"][data-norm="' + CSS.escape(p.norm) + '"]'
      );
      if (!btn) continue;
      const onBench = !!p.missing;
      btn.textContent = onBench ? "Bench" : "Active";
      btn.setAttribute("data-norm", p.norm);
      btn.classList.toggle("matchup-status-btn--active", !onBench);
      btn.classList.toggle("matchup-status-btn--missing", onBench);
      btn.setAttribute("aria-pressed", onBench ? "true" : "false");
      const row = btn.closest(".matchup-roster-item");
      if (row) {
        row.classList.toggle("matchup-roster-item--benched", onBench);
        row.classList.toggle("matchup-roster-item--hits-twice", !!p.hitsTwice);
        const nameEl = row.querySelector(".matchup-roster-name");
        if (nameEl) nameEl.innerHTML = renderPlayerNameHtml(p);
        let badge = row.querySelector(".matchup-roster-double-badge");
        if (p.hitsTwice) {
          if (!badge) {
            badge = document.createElement("span");
            badge.className = "matchup-roster-double-badge";
            badge.title = "Bats twice for the 11th lineup spot";
            badge.textContent = "2× lineup";
            if (nameEl && nameEl.nextSibling) {
              nameEl.parentNode.insertBefore(badge, nameEl.nextSibling);
            } else {
              row.insertBefore(badge, btn);
            }
          }
        } else if (badge) {
          badge.remove();
        }
      }
    }
  }

  function normPlayerName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[.'’]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function applyReplacementDisplay(originalPlayers, side, byOriginalNorm) {
    if (!originalPlayers?.length) return;
    const col = document.querySelector(".schedule-roster-col--" + side);
    if (!col) return;
    const items = col.querySelectorAll(".matchup-roster-item");
    items.forEach((row, idx) => {
      const originalName = originalPlayers[idx];
      if (!originalName) return;
      const norm = normPlayerName(originalName);
      const repl = byOriginalNorm?.get?.(norm);
      const nameEl = row.querySelector(".matchup-roster-name");
      const btn = row.querySelector("[data-lineup-toggle]");
      if (repl) {
        if (nameEl) {
          nameEl.innerHTML =
            '<span class="matchup-roster-replaced-name">' +
            escapeHtml(repl.original) +
            "</span> " +
            escapeHtml(repl.replacement) +
            '<span class="matchup-replacement-tag" title="Mid-season replacement">Replacement</span>';
        }
        if (btn) btn.setAttribute("data-norm", repl.replacementNorm);
      } else {
        if (nameEl) nameEl.textContent = originalName;
        if (btn) btn.setAttribute("data-norm", norm);
      }
    });
  }

  function updateLineupUi(enrichment) {
    if (!enrichment) return;
    updateRosterRows(enrichment.away, "away");
    updateRosterRows(enrichment.home, "home");

    const host = document.getElementById("matchup-lineup-rules-host");
    if (!host) return;

    const alerts = enrichment.lineupRuleAlerts || [];
    const batsTwice = alerts.filter((a) => a.doubleBatter);
    const notes = alerts.filter((a) => !a.doubleBatter);

    let html = "";
    if (batsTwice.length) {
      html +=
        '<section class="matchup-lineup-alerts matchup-bats-twice-section" aria-label="Bats twice in the lineup">' +
        '<h2 class="matchup-lineup-alerts-title">Bats twice in the lineup</h2>';
      for (const a of batsTwice) html += renderDoubleBatterCard(a);
      html += "</section>";
    }
    if (notes.length) {
      html +=
        '<section class="matchup-roster-notes" aria-label="Roster notes">' +
        '<h2 class="matchup-roster-notes-title">Roster notes (MMS bylaws)</h2>';
      for (const a of notes) html += renderNoteAlert(a);
      html += "</section>";
    }
    host.innerHTML = html;
  }

  function formatPredictorRecordValue(data) {
    return (
      `${data.wins}–${data.losses}` +
      (data.winPct != null
        ? `<span class="matchup-predictor-record-pct"> (${data.winPct}%)</span>`
        : "")
    );
  }

  function ensurePredictorRecordBlock(record) {
    const data = record || window.__MATCHUP_PREDICTOR_RECORD__;
    if (!data || !data.decided) return;
    if (document.querySelector(".matchup-predictor-record-block")) return;
    const form = document.getElementById("matchupForm");
    const controls = form && form.querySelector(".matchup-predictor-controls");
    if (!form || !controls) return;
    const block = document.createElement("div");
    block.className = "matchup-predictor-record-block matchup-predictor-panel";
    block.id = "matchupPredictorRecord";
    block.innerHTML =
      '<span class="matchup-predictor-record-label">Season pick record</span>' +
      `<span class="matchup-predictor-record-value">${formatPredictorRecordValue(data)}</span>`;
    form.insertBefore(block, controls);
  }

  function updatePredictorRecordUi(record) {
    if (!record || !record.decided) return;
    window.__MATCHUP_PREDICTOR_RECORD__ = record;
    let block = document.getElementById("matchupPredictorRecord");
    if (!block) block = document.querySelector(".matchup-predictor-record-block");
    if (block) {
      let valueEl = block.querySelector(".matchup-predictor-record-value");
      if (!valueEl) {
        valueEl = document.createElement("span");
        valueEl.className = "matchup-predictor-record-value";
        block.appendChild(valueEl);
      }
      valueEl.innerHTML = formatPredictorRecordValue(record);
      return;
    }
    ensurePredictorRecordBlock(record);
  }

  function ensurePredictionPanelStyles() {
    document.querySelectorAll("section.matchup-prediction").forEach((el) => {
      el.classList.add("matchup-predictor-panel");
    });
  }

  function renderBetStatus(status) {
    if (status === "hit") {
      return '<span class="matchup-bet-tag matchup-bet-tag--hit">Hit</span>';
    }
    if (status === "miss") {
      return '<span class="matchup-bet-tag matchup-bet-tag--miss">Miss</span>';
    }
    if (status === "push") {
      return '<span class="matchup-bet-tag matchup-bet-tag--push">Push</span>';
    }
    return "";
  }

  function renderOuActualSide(actualSide) {
    if (actualSide === "over") {
      return '<span class="matchup-bet-tag matchup-ou-side matchup-ou-side--over">Over</span>';
    }
    if (actualSide === "under") {
      return '<span class="matchup-bet-tag matchup-ou-side matchup-ou-side--under">Under</span>';
    }
    if (actualSide === "push") {
      return '<span class="matchup-bet-tag matchup-ou-side matchup-ou-side--push">Push</span>';
    }
    return "";
  }

  function renderGameResultUi(gameResult) {
    if (!gameResult) return;
    const section = document.querySelector(".matchup-prediction");
    if (!section) return;

    const gr = gameResult;
    const mp = gr.modelPrediction || {};
    const bets = gr.bets || {};
    const ou = bets.overUnder || {};
    const rl = bets.runLine || {};
    const ml = bets.moneyline || {};
    const mlAway = bets.moneylineAway || {};
    const mlHome = bets.moneylineHome || {};
    const rlSide = rl.side;
    const winnerSide = gr.winnerSide;

    const awayWinnerClass =
      winnerSide === "away" ? " matchup-pred-team--winner" : "";
    const homeWinnerClass =
      winnerSide === "home" ? " matchup-pred-team--winner" : "";

    let winnerTeamCell = "";
    if (winnerSide === "away") {
      winnerTeamCell =
        '<td class="matchup-lines-team matchup-lines-team--away matchup-lines-team--winner"><span class="matchup-side-tag matchup-side-tag--winner">Winner</span>' +
        escapeHtml(gr.awayLabel) +
        "</td>";
    } else if (winnerSide === "home") {
      winnerTeamCell =
        '<td class="matchup-lines-team matchup-lines-team--home matchup-lines-team--winner"><span class="matchup-side-tag matchup-side-tag--winner">Winner</span>' +
        escapeHtml(gr.homeLabel) +
        "</td>";
    } else {
      winnerTeamCell = '<td class="matchup-lines-team matchup-lines-team--both">Tie</td>';
    }

    let runLineTeamCell = "";
    if (rlSide === "away") {
      runLineTeamCell =
        '<td class="matchup-lines-team matchup-lines-team--away matchup-lines-team--favorite"><span class="matchup-side-tag">Away</span>' +
        escapeHtml(gr.awayLabel) +
        "</td>";
    } else if (rlSide === "home") {
      runLineTeamCell =
        '<td class="matchup-lines-team matchup-lines-team--home matchup-lines-team--favorite"><span class="matchup-side-tag">Home</span>' +
        escapeHtml(gr.homeLabel) +
        "</td>";
    } else {
      runLineTeamCell = '<td class="matchup-lines-team">—</td>';
    }

    const ouPickLabel =
      ou.pick === "over" ? "Over" : ou.pick === "under" ? "Under" : "—";
    const mlAwayLine = mp.lines?.moneylineAway || "—";
    const mlHomeLine = mp.lines?.moneylineHome || "—";

    section.className = "matchup-prediction matchup-predictor-panel matchup-prediction--final";
    section.innerHTML =
      "<h2>Final result</h2>" +
      '<p class="matchup-prediction-note">This game is complete. Scores are from the schedule sheet. Model lines use stats and records through the day before this game (frozen pre-game snapshot) and are graded against the actual outcome.</p>' +
      '<div class="matchup-pred-win-row matchup-pred-win-row--final">' +
      '<div class="matchup-pred-team matchup-pred-away' +
      awayWinnerClass +
      '"><span class="matchup-pred-team-name"><span class="matchup-side-tag">Away</span>' +
      escapeHtml(gr.awayLabel) +
      '</span><span class="matchup-pred-score">' +
      escapeHtml(gr.awayScore) +
      "</span></div>" +
      '<div class="matchup-pred-team matchup-pred-home' +
      homeWinnerClass +
      '"><span class="matchup-pred-team-name"><span class="matchup-side-tag">Home</span>' +
      escapeHtml(gr.homeLabel) +
      '</span><span class="matchup-pred-score">' +
      escapeHtml(gr.homeScore) +
      "</span></div></div>" +
      '<div class="page-table-wrap"><table class="matchup-pred-lines page-table"><thead><tr><th>Line</th><th>Team / pick</th><th>Value</th><th>Result</th></tr></thead><tbody>' +
      '<tr class="matchup-lines-row--final-score"><td>Final score</td>' +
      winnerTeamCell +
      '<td class="matchup-lines-value matchup-lines-score"><span class="matchup-score-runs ' +
      (winnerSide === "away" ? "matchup-score-runs--winner" : "matchup-score-runs--loser") +
      '">' +
      escapeHtml(gr.awayScore) +
      '</span><span class="matchup-score-sep">–</span><span class="matchup-score-runs ' +
      (winnerSide === "home" ? "matchup-score-runs--winner" : "matchup-score-runs--loser") +
      '">' +
      escapeHtml(gr.homeScore) +
      '</span></td><td class="matchup-bet-result">Actual</td></tr>' +
      "<tr><td>Over / under (total runs)</td>" +
      '<td class="matchup-lines-team matchup-lines-team--both">' +
      escapeHtml(ouPickLabel) +
      "</td>" +
      '<td class="matchup-lines-value"><strong>O/U ' +
      escapeHtml(ou.line) +
      "</strong></td>" +
      '<td class="matchup-bet-result"><span class="matchup-bet-actual">' +
      escapeHtml(gr.total) +
      " runs</span>" +
      renderOuActualSide(ou.actualSide) +
      "</td></tr>" +
      '<tr class="matchup-lines-row--runline"><td>Run line</td>' +
      runLineTeamCell +
      '<td class="matchup-lines-value"><strong>' +
      escapeHtml(rl.line) +
      "</strong></td>" +
      '<td class="matchup-bet-result">' +
      renderBetStatus(rl.status) +
      "</td></tr>" +
      "<tr><td>Moneyline</td>" +
      '<td class="matchup-lines-team matchup-lines-team--away"><span class="matchup-side-tag">Away</span>' +
      escapeHtml(gr.awayLabel) +
      (ml.favoriteSide === "away" ? ' <span class="matchup-bet-model-pick">Model pick</span>' : "") +
      "</td>" +
      '<td class="matchup-lines-value"><strong>' +
      escapeHtml(mlAwayLine) +
      "</strong></td>" +
      '<td class="matchup-bet-result">' +
      renderBetStatus(mlAway.status) +
      "</td></tr>" +
      "<tr><td>Moneyline</td>" +
      '<td class="matchup-lines-team matchup-lines-team--home"><span class="matchup-side-tag">Home</span>' +
      escapeHtml(gr.homeLabel) +
      (ml.favoriteSide === "home" ? ' <span class="matchup-bet-model-pick">Model pick</span>' : "") +
      "</td>" +
      '<td class="matchup-lines-value"><strong>' +
      escapeHtml(mlHomeLine) +
      "</strong></td>" +
      '<td class="matchup-bet-result">' +
      renderBetStatus(mlHome.status) +
      "</td></tr></tbody></table></div>";

    const hint = document.querySelector(".matchup-roster-hint");
    if (hint) {
      hint.textContent =
        "Rosters for this completed game. Players marked MG (missed game) in the game logs are shown on the bench.";
    }

    document.querySelectorAll("[data-lineup-toggle]").forEach((btn) => {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
    });
  }

  window.MmsMatchupPredictorUi = {
    updatePredictionUi,
    updateActiveCounts,
    updateLineupUi,
    applyReplacementDisplay,
    ensurePredictorRecordBlock,
    updatePredictorRecordUi,
    ensurePredictionPanelStyles,
    renderGameResultUi,
  };
})();
