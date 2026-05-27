/**
 * Update matchup prediction DOM from a client-side prediction result.
 */
(function () {
  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function updatePredictionUi(prediction) {
    if (!prediction) return;
    const section = document.querySelector(".matchup-prediction");
    if (!section) return;

    const awayPct = prediction.winPct.away;
    const homePct = prediction.winPct.home;
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
        bar.classList.toggle("matchup-pred-bar--leader", awayPct >= homePct);
        bar.classList.toggle("matchup-pred-bar--trailer", awayPct < homePct);
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
        bar.classList.toggle("matchup-pred-bar--leader", homePct >= awayPct);
        bar.classList.toggle("matchup-pred-bar--trailer", homePct < awayPct);
      }
    }

    const tbody = section.querySelector(".matchup-pred-lines tbody");
    if (!tbody) return;

    const finalScore = prediction.lines.finalScore || {};
    let winnerSide = finalScore.winnerSide;
    if (!winnerSide) {
      winnerSide = homePct > awayPct ? "home" : awayPct > homePct ? "away" : homePct >= awayPct ? "home" : "away";
    }

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
        let runLineSide = runLine.side;
        if (!runLineSide) {
          runLineSide = homePct > awayPct ? "home" : awayPct > homePct ? "away" : homePct >= awayPct ? "home" : "away";
        }
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
        } else if (isHome) {
          const strong = row.cells[2]?.querySelector("strong");
          if (strong) strong.textContent = prediction.lines.moneylineHome || "—";
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

  function updateRosterRows(roster, side) {
    if (!roster || !roster.playersDetailed) return;
    for (const p of roster.playersDetailed) {
      const btn = document.querySelector(
        '[data-lineup-toggle][data-side="' + side + '"][data-norm="' + CSS.escape(p.norm) + '"]'
      );
      if (!btn) continue;
      const onBench = !!p.missing;
      btn.textContent = onBench ? "Bench" : "Active";
      btn.classList.toggle("matchup-status-btn--active", !onBench);
      btn.classList.toggle("matchup-status-btn--missing", onBench);
      btn.setAttribute("aria-pressed", onBench ? "true" : "false");
      const row = btn.closest(".matchup-roster-item");
      if (row) {
        row.classList.toggle("matchup-roster-item--benched", onBench);
        row.classList.toggle("matchup-roster-item--hits-twice", !!p.hitsTwice);
        let badge = row.querySelector(".matchup-roster-double-badge");
        if (p.hitsTwice) {
          if (!badge) {
            badge = document.createElement("span");
            badge.className = "matchup-roster-double-badge";
            badge.title = "Bats twice for the 11th lineup spot";
            badge.textContent = "2× lineup";
            const nameEl = row.querySelector(".matchup-roster-name");
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

  window.MmsMatchupPredictorUi = {
    updatePredictionUi,
    updateActiveCounts,
    updateLineupUi,
  };
})();
