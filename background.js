const DEFAULT_SETTINGS = {
  thresholdMinutes: 1440, 
  speed: 1,
  whitelist: [],
  blacklist: [],
};

const STATE_KEY = "tabRotState"; 
const SETTINGS_KEY = "settings";

let urlState = {}; 
const tabUrl = new Map(); 

let hydrated = false;
async function hydrate() {
  if (hydrated) return;
  const { [STATE_KEY]: s } = await chrome.storage.local.get(STATE_KEY);
  urlState = s && typeof s === "object" ? s : {};
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    if (t.id != null && t.url) tabUrl.set(t.id, t.url);
  }
  hydrated = true;
}

async function loadSettings() {
  const { [SETTINGS_KEY]: s } = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}
async function saveSettings(s) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: s });
}

let persistTimer = null;
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    try {
      await chrome.storage.local.set({ [STATE_KEY]: urlState });
    } catch (_) {}
  }, 250);
}

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
function isTrackable(url) {
  if (!url) return false;
  return /^https?:/i.test(url);
}
function matchesList(url, list) {
  if (!url || !list?.length) return false;
  const host = hostnameOf(url);
  return list.some((entry) => {
    const e = (entry || "").trim().toLowerCase().replace(/^www\./, "");
    if (!e) return false;
    return host === e || host.endsWith("." + e);
  });
}

function computeStage(elapsedMin, settings) {
  const base = Math.max(1, settings.thresholdMinutes) * Math.max(0.1, settings.speed);
  if (elapsedMin < base) return 0;
  return Math.min(4, Math.floor(elapsedMin / base));
}

async function sendStage(tabId, stage, opts = {}) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "TAB_ROT_STAGE",
      stage,
      heal: !!opts.heal,
    });
  } catch (_) 
}

async function evaluateTab(tabId, { heal = false } = {}) {
  await hydrate();
  const url = tabUrl.get(tabId);
  if (!isTrackable(url)) return;
  const settings = await loadSettings();

  if (matchesList(url, settings.blacklist) || matchesList(url, settings.whitelist)) {
    await sendStage(tabId, 0, { heal });
    return;
  }

  const entry = urlState[url];
  if (!entry) {
    urlState[url] = { lastActive: Date.now(), stage: 0 };
    schedulePersist();
    await sendStage(tabId, 0, { heal });
    return;
  }

  const elapsedMin = (Date.now() - entry.lastActive) / 60000;
  const stage = computeStage(elapsedMin, settings);

  if (stage !== entry.stage || heal) {
    entry.stage = stage;
    schedulePersist();
  }
  await sendStage(tabId, stage, { heal });
}

async function evaluateAll() {
  await hydrate();
  for (const tabId of tabUrl.keys()) await evaluateTab(tabId);
}

function touchUrl(url) {
  if (!isTrackable(url)) return;
  urlState[url] = { lastActive: Date.now(), stage: 0 };
  schedulePersist();
}

chrome.runtime.onInstalled.addListener(async () => {
  const s = await loadSettings();
  await saveSettings(s);
  chrome.alarms.create("tabRotTick", { periodInMinutes: 1 });
  await hydrate();
  for (const url of tabUrl.values()) {
    if (isTrackable(url) && !urlState[url]) touchUrl(url);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.alarms.create("tabRotTick", { periodInMinutes: 1 });
  await hydrate();
  await evaluateAll();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "tabRotTick") await evaluateAll();
});

chrome.tabs.onCreated.addListener(async (tab) => {
  await hydrate();
  if (tab.id != null && tab.url) {
    tabUrl.set(tab.id, tab.url);
    if (!urlState[tab.url]) touchUrl(tab.url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabUrl.delete(tabId);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await hydrate();
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;
  if (tab.url) tabUrl.set(tabId, tab.url);
  touchUrl(tab.url);
  await evaluateTab(tabId, { heal: true });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await hydrate();
  if (changeInfo.url) tabUrl.set(tabId, changeInfo.url);
  if (changeInfo.url || changeInfo.status === "complete") {
    if (tab.url) {
      tabUrl.set(tabId, tab.url);
      touchUrl(tab.url);
    }
    await evaluateTab(tabId, { heal: true });
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  await hydrate();
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (tab?.id != null) {
    if (tab.url) tabUrl.set(tab.id, tab.url);
    touchUrl(tab.url);
    await evaluateTab(tab.id, { heal: true });
  }
});


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    await hydrate();
    if (msg?.type === "TAB_ROT_HELLO" && sender.tab?.id != null) {
      const tabId = sender.tab.id;
      if (sender.tab.url) tabUrl.set(tabId, sender.tab.url);
      await evaluateTab(tabId);
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "TAB_ROT_RESET_ALL") {
      const now = Date.now();
      for (const url of Object.keys(urlState)) {
        urlState[url] = { lastActive: now, stage: 0 };
      }
      schedulePersist();
      for (const tabId of tabUrl.keys()) sendStage(tabId, 0, { heal: true });
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "TAB_ROT_GET_SETTINGS") {
      sendResponse(await loadSettings());
      return;
    }
    if (msg?.type === "TAB_ROT_SAVE_SETTINGS") {
      await saveSettings({ ...DEFAULT_SETTINGS, ...msg.settings });
      await evaluateAll();
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "TAB_ROT_CLEAR_HISTORY") {
      urlState = {};
      await chrome.storage.local.set({ [STATE_KEY]: urlState });
      for (const tabId of tabUrl.keys()) sendStage(tabId, 0, { heal: true });
      sendResponse({ ok: true });
      return;
    }
  })();
  return true;
});

hydrate();
