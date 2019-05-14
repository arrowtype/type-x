// Recursive

// User variables (should come from settings)
const defaultFonts = [{
        "name": "Recursive Mono",
        "file": "recursive-mono-var.woff2",
        "selectors": [
            "code",
            "code *", // Code blocks with syntax highlighting
            "pre",
            "pre *", // Code blocks with syntax highlighting
            "samp",
            "kbd",
            ".blob-code", // Github
            ".blob-code *" // Github
        ],
        "css": "line-height: normal; font-feature-settings: normal;"
    },
    {
        "name": "Recursive Sans",
        "file": "recursive-sans-var.woff2",
        "selectors": [
            "*"
        ],
        "css": ""
    }
];

// Extension variables
let stylesheets = [];
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
    for (const blacklistedClass of blacklistedClasses) {
        b += `:not(.${blacklistedClass})`;
    }
    return b;
})();

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({
        "fontActivated": false,
        "fonts": defaultFonts
    }, () => {
        generateStyleSheet();
    });
});

chrome.tabs.onUpdated.addListener((_tabId, { status }, { active }) => {
    if (active && status === "loading") {
        chrome.storage.sync.get(
            "fontActivated", ({ fontActivated }) => {
                updateFonts(fontActivated, true);
            }
        );
    }
});

chrome.tabs.onActivated.addListener(() => {
    chrome.storage.sync.get(
        "fontActivated", ({ fontActivated }) => {
            updateFonts(fontActivated);
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
function updateFonts(fontActivated, forceInsert) {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, tabs => {
        const tabId = tabs[0].id;

        if (fontActivated) {
            // Inject CSS to activate font
            if (!insertedTabs.has(tabId) || forceInsert) {
                chrome.tabs.insertCSS(tabId, {
                    code: stylesheets.join('\n'),
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

function generateStyleSheet(callback) {
    chrome.storage.sync.get(
        "fonts", ({ fonts }) => {
            stylesheets = [];

            for (const font of fonts) {
                let universal = false;
                const fontURL = chrome.runtime.getURL(`fonts/${font.file}`);

                let selectors = [];
                for (const selector of font.selectors) {
                    // Is this font using the `*` CSS selector? Put it last.
                    if (selector === "*") universal = true;
                    selectors.push(`body:not(.recursivetypetester-disabled) ${selector}${blacklist}`);
                }

                const stylesheet = `
                @font-face {
                    font-family: '${font.name}';
                    src: url('${fontURL}');
                }
                ${selectors.join(",")} {
                    font-family: '${font.name}' !important;
                    ${font.css}
                }`

                if (universal) {
                    stylesheets.push(stylesheet);
                } else {
                    stylesheets.unshift(stylesheet)
                }
            }

            callback && callback();
        }
    );
}