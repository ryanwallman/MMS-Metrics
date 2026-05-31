/**
 * Site-wide full-page loading overlay (same UX as the DFS leaderboard).
 */
export function showMmsLoadingScreen() {
  const screen = document.getElementById("mmsLoadingScreen");
  if (screen) {
    screen.hidden = false;
    screen.setAttribute("aria-busy", "true");
  }
  document.body.classList.remove("mms-page-ready", "leaderboard-ready");
  const main = document.querySelector(".page-main");
  main?.classList.add("mms-page-main--loading");
  main?.classList.add("dfs-leaderboard-page--loading");
}

export function hideMmsLoadingScreen() {
  const screen = document.getElementById("mmsLoadingScreen");
  if (screen) {
    screen.hidden = true;
    screen.setAttribute("aria-busy", "false");
  }
  document.body.classList.add("mms-page-ready");
  if (document.querySelector(".dfs-leaderboard-page")) {
    document.body.classList.add("leaderboard-ready");
  }
  document.querySelector(".page-main")?.classList.remove("mms-page-main--loading");
  document.querySelector(".dfs-leaderboard-page")?.classList.remove("dfs-leaderboard-page--loading");
}

export function setMmsLoadingMessage(_message) {
  const el = document.querySelector(".mms-loading-screen__title");
  if (el) el.textContent = "Loading...";
}

if (typeof window !== "undefined") {
  window.MmsLoadingScreen = {
    show: showMmsLoadingScreen,
    hide: hideMmsLoadingScreen,
    setMessage: setMmsLoadingMessage,
  };
}
