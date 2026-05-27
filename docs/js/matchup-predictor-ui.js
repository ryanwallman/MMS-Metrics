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

  window.MmsMatchupPredictorUi = { updatePredictionUi, updateActiveCounts };
})();
