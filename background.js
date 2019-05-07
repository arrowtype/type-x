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
            const id = tabs[0].id;

            if(!insertedTabs.has(id) || forceInsert) {
                // Inject CSS to activate font
                chrome.tabs.insertCSS(id, {
                    file: "css/apply.css",
                    runAt: "document_start"
                });
            }

            insertedTabs.add(id);

            // Remove force-disable class
            chrome.tabs.executeScript(id, {
                code: `document.body.classList.remove("${className}");`
            });
        });
    } else {
        // If font has been previously enabled, force-disable it
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, tabs => {
            const id = tabs[0].id;

            chrome.tabs.executeScript(id, {
                code: `document.body.classList.add("${className}");`
            });
        });
    }
}