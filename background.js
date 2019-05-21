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
        handleError(chrome.runtime.lastError);
    }

    chrome.storage.local.set({
        "fontActivated": false,
        "fonts": defaultFonts
    }, () => {
        generateStyleSheet();
    });
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(
        "fonts", ({ fonts }) => {
            generateStyleSheet();
        }
    );
});

// Fires when an open tab updates (e.g. following a link)
// and when a new tab is opened
chrome.tabs.onUpdated.addListener((_tabId, { status }, { active }) => {
    if (chrome.runtime.lastError) {
        handleError(chrome.runtime.lastError);
    }

    if (active && status === "loading") {
        chrome.storage.local.get(
            "fontActivated", ({ fontActivated }) => {
                updateFonts(fontActivated);
            }
        );
    }
});

chrome.tabs.onRemoved.addListener(tabId => {
    if (chrome.runtime.lastError) {
        handleError(chrome.runtime.lastError);
    }

    insertedTabs.delete(tabId);
});

// Update fonts across all tabs
function updateFonts(fontActivated, updateExisting) {
    chrome.tabs.query({}, tabs => {
        for (const tab of tabs) {
            injectStyleSheet(tab.id, fontActivated, updateExisting);
        }
    });
}

// Injecting the stylesheet is fast, adding a class to
// the body isn't. We don't want a delay, so the CSS will
// enable the fonts immediately, and we only add a class
// when we want to *remove* the custom fonts.
function injectStyleSheet(tabId, fontActivated, updateExisting) {
    if (chrome.runtime.lastError) {
        handleError(chrome.runtime.lastError);
    }

    const updateTrigger = window.crypto.getRandomValues(new Uint32Array(1)).join("");

    if (fontActivated) {
        // Inject CSS to activate font
        if (!insertedTabs.has(tabId)) {
            generateStyleSheet(updateExisting, updateTrigger, () => {
                chrome.tabs.insertCSS(tabId, {
                    code: stylesheets.join('\n'),
                    runAt: "document_start"
                }, () => {
                    if (chrome.runtime.lastError) {
                        handleError(chrome.runtime.lastError);
                    }
                });

                insertedTabs.add(tabId);

                if (updateExisting) {
                    chrome.tabs.executeScript(tabId, {
                        code: `document.documentElement.dataset.updatefont = "${updateTrigger}";`
                    }, () => {
                        if (chrome.runtime.lastError) {
                            handleError(chrome.runtime.lastError);
                        }
                    });
                }
            });
        }

        // Remove force-disable class
        chrome.tabs.executeScript(tabId, {
            code: `document.body.classList.remove("${className}");`
        }, () => {
            if (chrome.runtime.lastError) {
                handleError(chrome.runtime.lastError);
            }
        });
    } else {
        // Add force-disable class
        chrome.tabs.executeScript(tabId, {
            code: `document.body.classList.add("${className}");`
        }, () => {
            if (chrome.runtime.lastError) {
                handleError(chrome.runtime.lastError);
            }
        });
    }
}

function generateStyleSheet(updateExisting, updateTrigger, callback) {
    chrome.storage.local.get(
        "fonts", ({ fonts }) => {
            stylesheets = [];

            let test = "";

            for (const font of fonts) {
                let universal = false;
                const fontURL = font.file;

                let selectors = [];
                for (const selector of font.selectors) {
                    let updateSelector = "html:not([data-updatefont])";
                    if (updateExisting) {
                        updateSelector = `html[data-updatefont="${updateTrigger}"]`;
                        test = `color:#${Math.floor(Math.random()*16777215).toString(16)};`;
                    }

                    // Is this font using the `*` CSS selector? Put it last.
                    if (selector === "*") universal = true;

                    selectors.push(`${updateSelector} body:not(.recursivetypetester-disabled) ${selector}${blacklist}`);
                }

                const stylesheet = `
                @font-face {
                    font-family: '${font.name}';
                    src: url('${fontURL}');
                }
                ${selectors.join(",")} {
                    font-family: '${font.name}' !important;
                    ${font.css}
                    ${test}
                }`

                if (universal) {
                    stylesheets.push(stylesheet);
                } else {
                    stylesheets.unshift(stylesheet)
                }
            }

            callback && callback();

            // New stylesheet, reset all tabs
            // TODO: we might not need this anymore. The tabs should _know_
            // that a new stylesheet is getting injected
            insertedTabs.clear();
        }
    );
}

function handleError(error) {
    // console.error(error);
}