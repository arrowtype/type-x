// Recursive

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({
        "fontActivated": false
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

chrome.tabs.onActivated.addListener(() => {
    chrome.storage.sync.get(
        "fontActivated", ({ fontActivated }) => {
            toggle(fontActivated);
        }
    );
});

function toggle(fontActivated) {
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
            // Inject CSS to activate font
            // TODO: Inject only once per page
            // It's only injected again when toggling the extension
            // on and off, and doesn't really fudge anyting up, so
            // I guess this is low prio.
            chrome.tabs.insertCSS(tabs[0].id, {
                file: "css/apply.css",
                runAt: "document_start"
            });
            // Remove force-disable class
            chrome.tabs.executeScript(tabs[0].id, {
                code: `document.body.classList.remove("${className}");`
            });
        });
    } else {
        // If font has been previously enabled, force-disable it
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, tabs => {
            chrome.tabs.executeScript(tabs[0].id, {
                code: `document.body.classList.add("${className}");`
            });
        });
    }
}