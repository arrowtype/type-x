// Recursive

const insertedTabs = new Set();
const className = "recursivetypetester-disabled";

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({
        "fontActivated": false
    });
});

chrome.tabs.onUpdated.addListener((tabId, { status }, { active }) => {
    if (active && status === "loading") {
        chrome.storage.sync.get(
            "fontActivated", ({ fontActivated }) => {
                toggle(fontActivated, true);
            }
        );
    }
});

chrome.tabs.onActivated.addListener(() => {
    chrome.storage.sync.get(
        "fontActivated", ({ fontActivated }) => {
            toggle(fontActivated);
        }
    );
});

chrome.tabs.onRemoved.addListener((tabId) => {
    insertedTabs.delete(tabId);
});

// Injecting the stylesheet is fast, adding a class to
// the body isn't. We don't want a delay, so the CSS will
// enable the fonts immediately, and we only add a class
// when we want to *remove* the custom fonts.
function toggle(fontActivated, forceInsert) {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, tabs => {
        const tabId = tabs[0].id;

        if (fontActivated) {
            // Inject CSS to activate font
            if (!insertedTabs.has(tabId) || forceInsert) {
                chrome.tabs.insertCSS(tabId, {
                    file: "css/apply.css",
                    runAt: "document_start"
                });
                insertedTabs.add(tabId);
            }
            // Remove force-disable class
            chrome.tabs.executeScript(tabId, {
                code: `document.body.classList.remove("${className}");`
            });
        } else {
            // Add force-disable class
            chrome.tabs.executeScript(tabId, {
                code: `document.body.classList.add("${className}");`
            });
        }
    });
}