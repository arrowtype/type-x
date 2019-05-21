// Recursive

// Extension variables
let stylesheets = [];
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

// Update fonts across all tabs
function updateFonts(fontActivated, updateExisting) {
    const updateTrigger = window.crypto.getRandomValues(new Uint32Array(1)).join("");

    generateStyleSheet(updateExisting, updateTrigger, () => {

        chrome.tabs.query({}, tabs => {
            for (const tab of tabs) {
                injectStyleSheet(tab.id, fontActivated);

                if (updateExisting) {
                    chrome.tabs.executeScript(tab.id, {
                        code: `document.documentElement.dataset.updatefont = "${updateTrigger}";`
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

            for (const font of fonts) {
                let universal = false;
                const fontURL = font.file;

                let selectors = [];
                for (const selector of font.selectors) {
                    // Is this font using the `*` CSS selector? Put it last.
                    if (selector === "*") universal = true;

                    const updateSelector = updateExisting ? `html[data-updatefont="${updateTrigger}"]` : "html:not([data-updatefont])";

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