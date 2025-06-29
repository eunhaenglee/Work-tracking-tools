chrome.idle.onStateChanged.addListener((state) => {
  if (state === "idle" || state === "locked") {
    chrome.runtime.sendMessage({ action: "autoStop" });
  }
});

chrome.runtime.onSuspend.addListener(() => {
  chrome.runtime.sendMessage({ action: "autoStop" });
});