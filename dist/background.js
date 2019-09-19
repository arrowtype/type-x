// Copyright 2019 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Extension variables
let stylesheets = [];
let updateCount = 0;
const defaultBlacklist = [
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

chrome.runtime.onInstalled.addListener(() => {
    if (chrome.runtime.lastError) {
        handleError(chrome.runtime.lastError);
    }

    chrome.storage.local.set({
        "fontActivated": false,
        "fonts": defaultFonts,
        "files": defaultFiles,
        "blacklist": defaultBlacklist
    }, () => {
        generateStyleSheet();
    });
});

chrome.runtime.onStartup.addListener(() => {
    generateStyleSheet();
});

// Fires when an open tab updates (e.g. following a link)
// and when a new tab is opened
chrome.tabs.onUpdated.addListener((_tabId, {
    status
}, {
    active
}) => {
    if (chrome.runtime.lastError) {
        handleError(chrome.runtime.lastError);
    }

    if (active && status === "loading") {
        chrome.storage.local.get(
            "fontActivated", ({
                fontActivated
            }) => {
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
            ["fonts", "files", "blacklist"], ({
                fonts,
                files,
                blacklist
            }) => {
                stylesheets = [];

                const blacklistSelectors = (() => {
                    let b = "";
                    for (const blacklistItem of blacklist) {
                        b += `:not(${blacklistItem})`;
                    }
                    return b;
                })();

                for (const font of fonts) {
                    const selectors = [];
                    const axesStyles = [];
                    let fontName = font.name;
                    let stylesheet = "";

                    for (const selector of font.selectors) {
                        selectors.push(`${updateSelector}:not([data-disablefont]) ${selector}${blacklistSelectors}`);
                    }

                    let axes = false;
                    if (font.axes && Object.entries(font.axes).length) {
                        axes = font.axes;
                    } else if (font.file in files) {
                        axes = files[font.file].axes;
                    }

                    if (axes) {
                        for (const axisData in axes) {
                            axesStyles.push(`'${axes[axisData].id}' ${axes[axisData].value}`);
                        }
                        fontName = font.name + font.id;
                        stylesheet += `
                    @font-face {
                        font-family: '${fontName}';
                        src: url('${files[font.file].file}');
                        font-weight: 100 900;
                        font-stretch: 50% 200%;
                    }`;
                    }

                    const stack = `'${fontName}', ${font.fallback}`;
                    stylesheet += `
                ${selectors.join(",")} {
                    font-family: ${stack} !important;
                    ${axesStyles.length ? `font-variation-settings: ${axesStyles.join(",")};` : ""}
                    ${font.css}
                }`

                stylesheets.push(stylesheet);
            }

            callback && callback();
        }
    );
}

function handleError(error) {
    // console.error(error);
}