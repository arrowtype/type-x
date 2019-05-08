// Recursive

const insertedTabs = new Set();

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

function toggle(fontActivated, forceInsert) {
    const className = "recursivetypetester-disabled";

    // Injecting the stylesheet is fast, adding a class to
    // the body isn't. We don't want a delay, so the CSS will
    // enable the fonts immediately, and we only add a class
    // when we want to *remove* the custom fonts.
    if (fontActivated) {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, tabs => {
            const tabId = tabs[0].id;

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
        });
    } else {
        // If font has been previously enabled, force-disable it
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, tabs => {
            const tabId = tabs[0].id;

            chrome.tabs.executeScript(tabId, {
                code: `document.body.classList.add("${className}");`
            });
        });
    }
}