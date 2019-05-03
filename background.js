// Recursive

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    "fontActivated": true
  });
});

chrome.tabs.onUpdated.addListener((tabId, { status }, { active }) => {
  if (active && status === "loading") {
    chrome.storage.sync.get(
      "fontActivated", ({ fontActivated }) => {
        toggle(fontActivated);
      }
    );
  }
});

function toggle(fontActivated) {
  const color = fontActivated ? "hotpink" : "black";

  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, tabs => {
    chrome.tabs.executeScript(
      tabs[0].id, {
        code: `document.body.style.backgroundColor="${color}"`
      });
  });
}
