const $ = (id) => document.getElementById(id);

function listToText(list) {
  return (list || []).join("\n");
}
function textToList(text) {
  return text
    .split(/\n+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function load() {
  const settings = await chrome.runtime.sendMessage({
    type: "TAB_ROT_GET_SETTINGS",
  });
  $("threshold").value = String(settings.thresholdMinutes);
  $("speed").value = String(settings.speed);
  $("whitelist").value = listToText(settings.whitelist);
  $("blacklist").value = listToText(settings.blacklist);
}

async function save() {
  const settings = {
    thresholdMinutes: Number($("threshold").value),
    speed: Number($("speed").value),
    whitelist: textToList($("whitelist").value),
    blacklist: textToList($("blacklist").value),
  };
  await chrome.runtime.sendMessage({
    type: "TAB_ROT_SAVE_SETTINGS",
    settings,
  });
  flash("Saved");
}

async function resetAll() {
  await chrome.runtime.sendMessage({ type: "TAB_ROT_RESET_ALL" });
  flash("All tabs restored to fresh");
}

function flash(msg) {
  const el = $("status");
  el.textContent = msg;
  setTimeout(() => (el.textContent = ""), 1800);
}

$("save").addEventListener("click", save);
$("reset").addEventListener("click", resetAll);
load();
