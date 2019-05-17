// Recursive

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
    if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError);
    }

    chrome.storage.local.set({
        "fontActivated": false,
        "fonts": defaultFonts
    }, () => {
        generateStyleSheet();
    });
});

chrome.tabs.onUpdated.addListener((_tabId, { status }, { active }) => {
    if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError);
    }

    if (active && status === "loading") {
        chrome.storage.local.get(
            "fontActivated", ({ fontActivated }) => {
                updateFonts(fontActivated, true);
            }
        );
    }
});

chrome.tabs.onActivated.addListener(() => {
    if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError);
    }

    chrome.storage.local.get(
        "fontActivated", ({ fontActivated }) => {
            updateFonts(fontActivated);
        }
    );
});

chrome.tabs.onRemoved.addListener(tabId => {
    if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError);
    }

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
        if (chrome.runtime.lastError) {
            console.log(chrome.runtime.lastError);
        }

        const tabId = tabs[0].id;

        if (fontActivated) {
            // Inject CSS to activate font
            if (!insertedTabs.has(tabId) || forceInsert) {
                chrome.tabs.insertCSS(tabId, {
                    code: stylesheets.join('\n'),
                    runAt: "document_start"
                }, () => {
                    if (chrome.runtime.lastError) {
                        console.log(chrome.runtime.lastError);
                    }
                });
                insertedTabs.add(tabId);
            }
            // Remove force-disable class
            chrome.tabs.executeScript(tabId, {
                code: `document.body.classList.remove("${className}");`
            }, () => {
                if (chrome.runtime.lastError) {
                    console.log(chrome.runtime.lastError);
                }
            });
        } else {
            // Add force-disable class
            chrome.tabs.executeScript(tabId, {
                code: `document.body.classList.add("${className}");`
            }, () => {
                if (chrome.runtime.lastError) {
                    console.log(chrome.runtime.lastError);
                }
            });
        }
    });
}

function generateStyleSheet(callback) {
    chrome.storage.local.get(
        "fonts", ({ fonts }) => {
            stylesheets = [];

            for (const font of fonts) {
                let universal = false;
                // const fontURL = chrome.runtime.getURL(`fonts/${font.file}`);
                const fontURL = font.file;

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

            // New stylesheet, reset all tabs
            insertedTabs.clear();
        }
    );
}