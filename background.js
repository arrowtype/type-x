// Recursive

let stylesheet = "";
const insertedTabs = new Set();
const className = "recursivetypetester-disabled";
const blacklistedClasses = [
    "icon",
    "Icon",
    "fa",
    "fas",
    "far",
    "fal",
    "fab",
    "font-fontello",
    "glyphicon"
];
const blacklist = (() => {
    let b = "";
    for(const blacklistedClass of blacklistedClasses) {
        b += `:not(.${blacklistedClass})`;
    }
    return b;
})();

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({
        "fontActivated": false,
        "fonts": [
            {
                "name": "Recursive Mono",
                "file": "recursive-mono-var.woff2"
            },
            {
                "name": "Recursive Sans",
                "file": "recursive-sans-var.woff2"
            }
        ]
    }, () => {
        generateStyleSheet();
    });
});

chrome.tabs.onUpdated.addListener((_tabId, { status }, { active }) => {
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

chrome.tabs.onRemoved.addListener(tabId => {
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
                    code: stylesheet,
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

function generateStyleSheet() {
    chrome.storage.sync.get(
        "fonts", ({ fonts }) => {
            for (const font of fonts) {
                const fontURL = chrome.runtime.getURL(`fonts/${font.file}`);
                stylesheet += `
                    @font-face {
                        font-family: '${font.name}';
                        src: url('${fontURL}');
                    }

                    body:not(.recursivetypetester-disabled) *${blacklist} {
                        font-family: '${font.name}' !important;
                    }`;
            }
        }
    );
}