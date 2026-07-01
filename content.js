(() => {
  if (window.__tabRotInstalled) return;
  window.__tabRotInstalled = true;

  const OVERLAY_ID = "tab-rot-overlay";
  const ROOT_CLASS_PREFIX = "tab-rot-stage-";
  let currentStage = 0;

  function ensureOverlay() {
    let el = document.getElementById(OVERLAY_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = OVERLAY_ID;
      el.setAttribute("aria-hidden", "true");
      (document.documentElement || document.body).appendChild(el);
    }
    return el;
  }

  function setStage(stage, { heal = false } = {}) {
    const root = document.documentElement;
    if (!root) return;
    ensureOverlay();

    if (heal) {
      root.classList.add("tab-rot-healing");
      setTimeout(() => root.classList.remove("tab-rot-healing"), 2200);
    }

    for (let i = 0; i <= 4; i++) root.classList.remove(ROOT_CLASS_PREFIX + i);
    root.classList.add(ROOT_CLASS_PREFIX + stage);
    currentStage = stage;
  }

  const mo = new MutationObserver(() => {
    if (!document.getElementById(OVERLAY_ID)) ensureOverlay();
  });
  if (document.documentElement) {
    mo.observe(document.documentElement, { childList: true, subtree: false });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "TAB_ROT_STAGE") setStage(msg.stage, { heal: msg.heal });
  });

  // Announce ready so background can push current stage
  try {
    chrome.runtime.sendMessage({ type: "TAB_ROT_HELLO" });
  } catch (_) {}

  setStage(0);
})();
