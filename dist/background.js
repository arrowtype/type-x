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
let prevFonts;
const defaultBlacklist = [
	".icon",
	".Icon",
	".fa",
	".fas",
	".far",
	".fal",
	".DPvwYc", // google hangouts
	".Mwv9k", // google hangouts
	".NtU4hc" // google hangouts
];

chrome.runtime.onInstalled.addListener(() => {
	if (chrome.runtime.lastError) {
		handleError(chrome.runtime.lastError);
	}

	initTypeX();
});

function initTypeX() {
	chrome.storage.local.set(
		{
			extensionActive: false,
			fonts: defaultFonts,
			files: defaultFiles,
			blacklist: defaultBlacklist
		},
		() => {
			generateStyleSheet();
		}
	);
}

chrome.runtime.onStartup.addListener(() => {
	generateStyleSheet();
});

// Update font when tab becomes active
chrome.tabs.onActivated.addListener(() => {
	chrome.storage.local.get("extensionActive", ({ extensionActive }) => {
		updateFonts(extensionActive, false);
	});
});

// Fires when an open tab updates (e.g. following a link)
// and when a new tab is opened
chrome.tabs.onUpdated.addListener((_tabId, { status }, { active }) => {
	if (chrome.runtime.lastError) {
		handleError(chrome.runtime.lastError);
	}

	if (active && status === "loading") {
		chrome.storage.local.get("extensionActive", ({ extensionActive }) => {
			updateFonts(extensionActive, false);
		});
	}
});

// Update fonts across all tabs
let prevUpdateCount;
function updateFonts(extensionActive, updatingCurrentTab) {
	// Update only the active tab
	let tabsSettings = {
		active: true,
		windowType: "normal",
		currentWindow: true
	};

	if (extensionActive) {
		chrome.tabs.query(tabsSettings, tabs => {
			for (const tab of tabs) {
				chrome.tabs.insertCSS(
					tab.id,
					{
						code: "html{opacity:0.75!important}",
						runAt: "document_start"
					},
					() => {
						if (chrome.runtime.lastError) {
							handleError(chrome.runtime.lastError);
						}
					}
				);
			}
		});
	}

	generateStyleSheet(updatingCurrentTab, () => {
		chrome.tabs.query(tabsSettings, tabs => {
			for (const tab of tabs) {
				injectStyleSheet(tab.id, extensionActive);

				if (updatingCurrentTab) {
					chrome.tabs.executeScript(
						tab.id,
						{
							code: `document.documentElement.dataset.updatefont = "${updateCount}";`
						},
						() => {
							if (chrome.runtime.lastError) {
								handleError(chrome.runtime.lastError);
							}
						}
					);
				}
			}
		});
	});
}

// Injecting the stylesheet is fast, adding a class to
// the body isn't. We don't want a delay, so the CSS will
// enable the fonts immediately, and we only add a class
// when we want to *remove* the custom fonts.
function injectStyleSheet(tabId, extensionActive) {
	if (chrome.runtime.lastError) {
		handleError(chrome.runtime.lastError);
	}

	let stylesheetsCode = stylesheets.join("\n");
	stylesheetsCode += "\nhtml{opacity:1!important}";

	if (extensionActive) {
		// Inject CSS to activate font
		chrome.tabs.insertCSS(
			tabId,
			{
				code: stylesheetsCode,
				runAt: "document_start"
			},
			() => {
				if (chrome.runtime.lastError) {
					handleError(chrome.runtime.lastError);
				}
			}
		);

		// Remove force-disable class
		chrome.tabs.executeScript(
			tabId,
			{
				code: `delete document.documentElement.dataset.disablefont;`
			},
			() => {
				if (chrome.runtime.lastError) {
					handleError(chrome.runtime.lastError);
				}
			}
		);
	} else {
		// Add force-disable class
		chrome.tabs.executeScript(
			tabId,
			{
				code: `document.documentElement.dataset.disablefont = "";`
			},
			() => {
				if (chrome.runtime.lastError) {
					handleError(chrome.runtime.lastError);
				}
			}
		);
	}
}

function generateStyleSheet(updatingCurrentTab, callback) {
	chrome.storage.local.get(["fonts", "files", "blacklist"], ({ fonts, files, blacklist }) => {
		// Check if fonts have been updated
		const currentFonts = JSON.stringify(fonts);
		const same = currentFonts == prevFonts;
		prevFonts = currentFonts;
		if (!same) updateCount++;

		const updateSelector = updatingCurrentTab
			? `html[data-updatefont="${updateCount}"]`
			: "html:not([data-updatefont])";
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
				selectors.push(
					`${updateSelector}:not([data-disablefont]) ${selector}${blacklistSelectors}`
				);
			}

			let axes = false;
			if (font.axes && Object.entries(font.axes).length) {
				axes = font.axes;
			} else if (font.file in files) {
				axes = files[font.file].axes;
			}

			// Only inject variable axes when font has axes,
			// and we don't want to inherit page styles
			if (axes && !font.inherit) {
				for (const axisData in axes) {
					axesStyles.push(`'${axes[axisData].id}' ${axes[axisData].value}`);
				}
				fontName = font.name + font.id;
			}

			if (font.file in files) {
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
                            ${
								axesStyles.length
									? `font-variation-settings: ${axesStyles.join(",")};`
									: ""
							}
                            ${font.css}
                        }`;

			stylesheets.push(stylesheet);
		}

		callback && callback();
	});
}

function handleError(error) {
	// console.error(error);
}
