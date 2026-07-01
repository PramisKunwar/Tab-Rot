document.getElementById("reset").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "TAB_ROT_RESET_ALL" });
  window.close();
});
document.getElementById("opts").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
