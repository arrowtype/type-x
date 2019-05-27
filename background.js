// Recursive

// Extension variables
let stylesheets = [];
let updateCount = 0;
const blacklistedSelectors = [
    ".icon",
    ".Icon",
    ".fa",
    ".fas",
    ".far",
    ".fal",
    '.DPvwYc', // google hangouts
    '.Mwv9k', // google hangouts
    '.NtU4hc', // google hangouts
];
const blacklist = (() => {
    let b = "";
    for (const blacklistedSelector of blacklistedSelectors) {
        b += `:not(${blacklistedSelector})`;
    }
    return b;
})();

chrome.runtime.onInstalled.addListener(() => {
    if (chrome.runtime.lastError) {
        handleError(chrome.runtime.lastError);
    }

    chrome.storage.local.set({
        "fontActivated": false,
        "fonts": defaultFonts,
        "files": defaultFiles
    }, () => {
        generateStyleSheet();
    });
});

chrome.runtime.onStartup.addListener(() => {
    generateStyleSheet();
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

// Update fonts across all tabs
function updateFonts(fontActivated, updateExisting) {
    updateCount++;

    generateStyleSheet(updateExisting, () => {
        chrome.tabs.query({}, tabs => {
            for (const tab of tabs) {
                injectStyleSheet(tab.id, fontActivated);

                if (updateExisting) {
                    chrome.tabs.executeScript(tab.id, {
                        code: `document.documentElement.dataset.updatefont = "${updateCount}";`
                    }, () => {
                        if (chrome.runtime.lastError) {
                            handleError(chrome.runtime.lastError);
                        }
                    });
                }
            }
        });
    });
}

// Injecting the stylesheet is fast, adding a class to
// the body isn't. We don't want a delay, so the CSS will
// enable the fonts immediately, and we only add a class
// when we want to *remove* the custom fonts.
function injectStyleSheet(tabId, fontActivated) {
    if (chrome.runtime.lastError) {
        handleError(chrome.runtime.lastError);
    }

    if (fontActivated) {
        // Inject CSS to activate font
        chrome.tabs.insertCSS(tabId, {
            code: stylesheets.join('\n'),
            runAt: "document_start"
        }, () => {
            if (chrome.runtime.lastError) {
                handleError(chrome.runtime.lastError);
            }
        });

        // Remove force-disable class
        chrome.tabs.executeScript(tabId, {
            code: `delete document.documentElement.dataset.disablefont;`
        }, () => {
            if (chrome.runtime.lastError) {
                handleError(chrome.runtime.lastError);
            }
        });
    } else {
        // Add force-disable class
        chrome.tabs.executeScript(tabId, {
            code: `document.documentElement.dataset.disablefont = "";`
        }, () => {
            if (chrome.runtime.lastError) {
                handleError(chrome.runtime.lastError);
            }
        });
    }
}

function generateStyleSheet(updateExisting, callback) {
    const updateSelector = updateExisting ? `html[data-updatefont="${updateCount}"]` : "html:not([data-updatefont])";

    chrome.storage.local.get(
        ["fonts", "files"], ({ fonts, files }) => {
            stylesheets = [];

            for (const font of fonts) {
                let universal;
                const selectors = [];

                for (const selector of font.selectors) {
                    // Is this font using the `*` CSS selector? Put it last.
                    universal = selector === "*" ? true : false;
                    selectors.push(`${updateSelector}:not([data-disablefont]) ${selector}${blacklist}`);
                }

                const stylesheet = `
                @font-face {
                    font-family: '${font.file}';
                    src: url('${files[font.file]}');
                }
                ${selectors.join(",")} {
                    font-family: '${font.file}' !important;
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

function handleError(error) {
    // console.error(error);
}