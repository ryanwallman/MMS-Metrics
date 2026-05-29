/**
 * Power rankings data visualizations (bar race, radar, trends, heatmap).
 */

const ROW_H = 34;

export function mountPowerRankingsViz(root, vizData, esc) {
  if (!root || !vizData) return;

  root.innerHTML = `
    <div class="pr-viz-grid">
      ${renderVizCard({
        title: "Animated ranking bar race",
        desc: "Horizontal bars race up and down each week as teams gain or lose power. Instantly shows momentum — who's climbing, who's sliding.",
        tag: "Power rankings",
        mountId: "prVizBarRace",
      })}
      ${renderVizCard({
        title: "Team radar / spider chart",
        desc: "Each axis = a stat category (AVG, SLG, OBP, HR, OPS). Overlay two teams to instantly see strengths vs weaknesses head-to-head.",
        tag: "Power rankings · Matchup",
        mountId: "prVizRadar",
      })}
      ${renderVizCard({
        title: "Weekly power score trend",
        desc: "Line chart per team showing power rating over the season. See who peaked early, who's peaking now, who's fading.",
        tag: "Power rankings",
        mountId: "prVizTrend",
      })}
      ${renderVizCard({
        title: "Tier heatmap",
        desc: "Grid of all teams × stat categories. Color intensity = performance. Instantly see which teams dominate which stats.",
        tag: "Power rankings",
        mountId: "prVizHeatmap",
      })}
    </div>`;

  mountBarRace(document.getElementById("prVizBarRace"), vizData, esc);
  mountRadarChart(document.getElementById("prVizRadar"), vizData, esc);
  mountPowerTrend(document.getElementById("prVizTrend"), vizData, esc);
  mountStatHeatmap(document.getElementById("prVizHeatmap"), vizData, esc);
}

function renderVizCard({ title, desc, tag, mountId }) {
  return `<article class="pr-viz-card">
    <header class="pr-viz-card__head">
      <span class="pr-viz-tag">${tag}</span>
      <h3 class="pr-viz-card__title">${title}</h3>
      <p class="pr-viz-card__desc">${desc}</p>
    </header>
    <div class="pr-viz-mount" id="${mountId}"></div>
  </article>`;
}

function formatPower(n) {
  if (!Number.isFinite(n)) return "—";
  return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
}

function mountBarRace(mount, vizData, esc) {
  const frames = vizData.weeklyHistory || [];
  if (!frames.length) {
    mount.innerHTML = `<p class="pr-viz-empty">Not enough schedule data for a bar race yet.</p>`;
    return;
  }

  mount.innerHTML = `
    <div class="pr-bar-race">
      <div class="pr-bar-race__controls">
        <button type="button" class="dfs-btn pr-bar-race__play" aria-pressed="false">▶ Play</button>
        <label class="pr-bar-race__scrub-label">
          <span class="pr-bar-race__week-label">Week</span>
          <input type="range" class="pr-bar-race__scrub" min="0" max="${frames.length - 1}" value="${frames.length - 1}" />
        </label>
      </div>
      <p class="pr-bar-race__frame-label" aria-live="polite"></p>
      <div class="pr-bar-race__chart-wrap">
        <div class="pr-bar-race__chart"></div>
      </div>
    </div>`;

  const chart = mount.querySelector(".pr-bar-race__chart");
  const scrub = mount.querySelector(".pr-bar-race__scrub");
  const frameLabel = mount.querySelector(".pr-bar-race__frame-label");
  const playBtn = mount.querySelector(".pr-bar-race__play");
  let frameIndex = frames.length - 1;
  let timer = null;
  let rowEls = new Map();

  function powerRange(frame) {
    const vals = frame.rankings.map((r) => r.powerRating);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return { min, max: max === min ? min + 1 : max };
  }

  function ensureRows(allTeamIds) {
    for (const id of allTeamIds) {
      if (rowEls.has(id)) continue;
      const el = document.createElement("div");
      el.className = "pr-bar-race__row";
      el.dataset.teamId = id;
      el.innerHTML = `
        <span class="pr-bar-race__rank"></span>
        <span class="pr-bar-race__name"></span>
        <div class="pr-bar-race__track"><div class="pr-bar-race__bar"></div></div>
        <span class="pr-bar-race__value"></span>`;
      chart.appendChild(el);
      rowEls.set(id, el);
    }
  }

  const allIds = new Set();
  for (const f of frames) {
    for (const r of f.rankings) allIds.add(String(r.teamId));
  }
  ensureRows(allIds);
  chart.style.height = `${allIds.size * ROW_H}px`;

  function renderFrame(index, animate) {
    frameIndex = index;
    scrub.value = String(index);
    const frame = frames[index];
    frameLabel.textContent = frame.label;

    const ranked = frame.rankings;
    const { min, max } = powerRange(frame);
    const rankById = new Map(ranked.map((r, i) => [String(r.teamId), { ...r, displayRank: i }]));

    for (const [id, el] of rowEls) {
      const info = rankById.get(id);
      if (!info) {
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
        continue;
      }
      el.style.opacity = "1";
      el.style.pointerEvents = "";
      el.style.transform = `translateY(${info.displayRank * ROW_H}px)`;
      if (!animate) el.style.transition = "none";
      else el.style.transition = "transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)";

      const pct = ((info.powerRating - min) / (max - min)) * 100;
      el.querySelector(".pr-bar-race__rank").textContent = info.rank;
      el.querySelector(".pr-bar-race__name").textContent = info.teamName;
      el.querySelector(".pr-bar-race__value").textContent = formatPower(info.powerRating);
      const bar = el.querySelector(".pr-bar-race__bar");
      bar.style.width = `${Math.max(4, pct)}%`;
      bar.style.backgroundColor = info.color;
    }

    if (!animate) {
      requestAnimationFrame(() => {
        for (const el of rowEls.values()) el.style.transition = "";
      });
    }
  }

  function stopPlay() {
    if (timer) clearInterval(timer);
    timer = null;
    playBtn.textContent = "▶ Play";
    playBtn.setAttribute("aria-pressed", "false");
  }

  function startPlay() {
    stopPlay();
    playBtn.textContent = "⏸ Pause";
    playBtn.setAttribute("aria-pressed", "true");
    timer = setInterval(() => {
      const next = (frameIndex + 1) % frames.length;
      renderFrame(next, true);
    }, 1400);
  }

  scrub.addEventListener("input", () => {
    stopPlay();
    renderFrame(Number(scrub.value), true);
  });

  playBtn.addEventListener("click", () => {
    if (timer) stopPlay();
    else startPlay();
  });

  renderFrame(frameIndex, false);
}

function mountRadarChart(mount, vizData, esc) {
  const profiles = vizData.teamStatProfiles || [];
  const categories = vizData.statCategories || [];
  if (!profiles.length || !categories.length) {
    mount.innerHTML = `<p class="pr-viz-empty">Team stat profiles unavailable.</p>`;
    return;
  }

  const options = profiles
    .map((p) => `<option value="${esc(String(p.teamId))}">${esc(p.teamName)}</option>`)
    .join("");

  mount.innerHTML = `
    <div class="pr-radar">
      <div class="pr-radar__pickers">
        <label>Team A <select class="pr-radar__select" data-side="a">${options}</select></label>
        <label>Team B <select class="pr-radar__select" data-side="b">${options}</select></label>
      </div>
      <div class="pr-radar__legend">
        <span class="pr-radar__swatch pr-radar__swatch--a"></span><span class="pr-radar__legend-a"></span>
        <span class="pr-radar__swatch pr-radar__swatch--b"></span><span class="pr-radar__legend-b"></span>
      </div>
      <svg class="pr-radar__svg" viewBox="0 0 420 420" role="img" aria-label="Team comparison radar chart"></svg>
    </div>`;

  const selA = mount.querySelector('[data-side="a"]');
  const selB = mount.querySelector('[data-side="b"]');
  if (profiles.length > 1) selB.selectedIndex = 1;

  const svg = mount.querySelector(".pr-radar__svg");
  const legendA = mount.querySelector(".pr-radar__legend-a");
  const legendB = mount.querySelector(".pr-radar__legend-b");
  const swatchA = mount.querySelector(".pr-radar__swatch--a");
  const swatchB = mount.querySelector(".pr-radar__swatch--b");

  function profileById(id) {
    return profiles.find((p) => String(p.teamId) === String(id));
  }

  function draw() {
    const a = profileById(selA.value);
    const b = profileById(selB.value);
    if (!a || !b) return;

    legendA.textContent = a.teamName;
    legendB.textContent = b.teamName;
    swatchA.style.background = a.color;
    swatchB.style.background = b.color;

    const n = categories.length;
    const cx = 210;
    const cy = 210;
    const maxR = 150;
    const rings = [0.25, 0.5, 0.75, 1];
    const angleStep = (Math.PI * 2) / n;

    let html = "";

    for (const t of rings) {
      const pts = [];
      for (let i = 0; i < n; i += 1) {
        const ang = -Math.PI / 2 + i * angleStep;
        pts.push(`${cx + Math.cos(ang) * maxR * t},${cy + Math.sin(ang) * maxR * t}`);
      }
      html += `<polygon points="${pts.join(" ")}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;
    }

    for (let i = 0; i < n; i += 1) {
      const ang = -Math.PI / 2 + i * angleStep;
      const x = cx + Math.cos(ang) * maxR;
      const y = cy + Math.sin(ang) * maxR;
      html += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`;
      const lx = cx + Math.cos(ang) * (maxR + 22);
      const ly = cy + Math.sin(ang) * (maxR + 22);
      html += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" class="pr-radar__label">${categories[i].label}</text>`;
    }

    function poly(team, cls, stroke) {
      const pts = categories.map((cat, i) => {
        const ang = -Math.PI / 2 + i * angleStep;
        const r = maxR * (team.normalized[cat.key] ?? 0);
        return `${cx + Math.cos(ang) * r},${cy + Math.sin(ang) * r}`;
      });
      return `<polygon points="${pts.join(" ")}" class="${cls}" fill="${stroke}" fill-opacity="0.22" stroke="${stroke}" stroke-width="2.5"/>`;
    }

    html += poly(a, "pr-radar__poly-a", a.color);
    html += poly(b, "pr-radar__poly-b", b.color);
    svg.innerHTML = html;
  }

  selA.addEventListener("change", draw);
  selB.addEventListener("change", draw);
  draw();
}

function mountPowerTrend(mount, vizData, esc) {
  const { labels = [], teams = [] } = vizData.powerTrends || {};
  if (!labels.length || !teams.length) {
    mount.innerHTML = `<p class="pr-viz-empty">Not enough weekly snapshots for trend lines yet.</p>`;
    return;
  }

  const width = 720;
  const height = 340;
  const pad = { top: 16, right: 16, bottom: 52, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const allPower = teams.flatMap((t) => t.points.map((p) => p.powerRating));
  let yMin = Math.min(...allPower);
  let yMax = Math.max(...allPower);
  if (yMin === yMax) {
    yMin -= 0.5;
    yMax += 0.5;
  }
  const yPad = (yMax - yMin) * 0.08;
  yMin -= yPad;
  yMax += yPad;

  const xAt = (i) => pad.left + (labels.length <= 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
  const yAt = (v) => pad.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  let grid = "";
  for (let g = 0; g <= 4; g += 1) {
    const v = yMin + ((yMax - yMin) * g) / 4;
    const y = yAt(v);
    grid += `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#eef2f7" stroke-width="1"/>`;
    grid += `<text x="${pad.left - 8}" y="${y}" text-anchor="end" dominant-baseline="middle" class="pr-trend__tick">${v.toFixed(1)}</text>`;
  }

  const xLabels = labels
    .map((l, i) => {
      if (labels.length > 14 && i % 2 !== 0 && i !== labels.length - 1) return "";
      const x = xAt(i);
      return `<text x="${x}" y="${height - 12}" text-anchor="middle" class="pr-trend__tick">${esc(l.key)}</text>`;
    })
    .join("");

  const paths = teams
    .map((team) => {
      const pts = team.points
        .map((p, i) => {
          const idx = labels.findIndex((l) => l.key === p.key);
          return `${xAt(idx >= 0 ? idx : i)},${yAt(p.powerRating)}`;
        })
        .join(" ");
      return `<polyline points="${pts}" fill="none" stroke="${team.color}" stroke-width="2" opacity="0.85" data-team-id="${esc(String(team.teamId))}" class="pr-trend__line"/>`;
    })
    .join("");

  mount.innerHTML = `
    <div class="pr-trend">
      <svg class="pr-trend__svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Weekly power rating trends">
        ${grid}
        ${paths}
        ${xLabels}
      </svg>
      <div class="pr-trend__legend"></div>
    </div>`;

  const legend = mount.querySelector(".pr-trend__legend");
  legend.innerHTML = teams
    .map(
      (t) =>
        `<button type="button" class="pr-trend__legend-item" data-team-id="${esc(String(t.teamId))}" style="--team-color:${t.color}">
          <span class="pr-trend__legend-swatch"></span>${esc(t.teamName)}
        </button>`
    )
    .join("");

  const lines = mount.querySelectorAll(".pr-trend__line");
  const items = mount.querySelectorAll(".pr-trend__legend-item");

  function highlight(teamId) {
    for (const line of lines) {
      const on = !teamId || line.dataset.teamId === teamId;
      line.style.opacity = on ? "1" : "0.12";
      line.style.strokeWidth = on && teamId ? "3" : "2";
    }
    for (const item of items) {
      item.classList.toggle("pr-trend__legend-item--active", teamId && item.dataset.teamId === teamId);
    }
  }

  for (const item of items) {
    item.addEventListener("mouseenter", () => highlight(item.dataset.teamId));
    item.addEventListener("mouseleave", () => highlight(null));
    item.addEventListener("focus", () => highlight(item.dataset.teamId));
    item.addEventListener("blur", () => highlight(null));
  }
}

function mountStatHeatmap(mount, vizData, esc) {
  const profiles = vizData.teamStatProfiles || [];
  const categories = vizData.statCategories || [];
  if (!profiles.length) {
    mount.innerHTML = `<p class="pr-viz-empty">Team stats unavailable.</p>`;
    return;
  }

  const sorted = [...profiles].sort((a, b) => b.ops - a.ops);
  const head = categories.map((c) => `<th>${esc(c.label)}</th>`).join("");
  const body = sorted
    .map((team) => {
      const cells = categories
        .map((cat) => {
          const val = team[cat.key];
          const display =
            cat.key === "hr" ? Math.round(val) : Number.isFinite(val) ? val.toFixed(3) : "—";
          return `<td class="pr-heat-cell" style="${team.heatStyle[cat.key] || ""}">${display}</td>`;
        })
        .join("");
      return `<tr>
        <th scope="row" class="pr-heat-team">
          <span class="pr-heat-dot" style="background:${team.color}"></span>${esc(team.teamName)}
        </th>
        ${cells}
      </tr>`;
    })
    .join("");

  mount.innerHTML = `
    <div class="rankings-table-wrap pr-heat-wrap">
      <table class="page-table pr-heat-table">
        <thead>
          <tr><th>Team</th>${head}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="pr-viz-footnote">Darker green = higher value within each stat column.</p>`;
}

export function renderVizTabShell() {
  return `<div id="powerRankingsVizRoot" class="power-rankings-viz-root"></div>`;
}
