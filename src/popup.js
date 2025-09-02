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

const activateFonts = document.querySelector("#activateFonts");
const fullReset = document.querySelector(".full-reset");

import { defaultFiles, defaultFonts } from "./recursive-fonts";
import { addFormElement, saveForm } from "./form.js";

const defaultBlacklist = [
	".icon",
	".Icon",
	".glyphicon",
	".fa",
	".fas",
	".far",
	".fal",
	".fab",
	".font-fontello",
	".material-icons",
	".DPvwYc", // google hangouts
	".Mwv9k", // google hangouts
	".NtU4hc" // google hangouts
];
let stylesheets = [];

const showBlacklist = document.querySelector("#showBlacklist");
const addFont = document.querySelector("#addFont");

// Show/hide blacklist
showBlacklist.onclick = () => {
	document.querySelector(".blacklist").classList.toggle("show");
};

// Add new font fieldset to form
addFont.onclick = () => {
	const randomId = window.crypto.getRandomValues(new Uint32Array(2)).join("");
	chrome.storage.local.get("files", ({ files }) => {
		const newFont = {
			new: true,
			id: randomId,
			file: Object.keys(files)[0],
			fallback: ["monospace"],
			selectors: ["/* Add CSS selectors here */"],
			css: "/* Additional styles to apply */"
		};

		addFormElement(newFont, files);
		saveForm();
	});
};

let injectedCSS = {};
async function insertOrReplaceCss(tabId, text) {
	if (tabId in injectedCSS) {
		if (injectedCSS[tabId] == text) {
			return;
		}
		await chrome.scripting.removeCSS({
			target: { tabId },
			css: injectedCSS[tabId]
		});
	}
	await chrome.scripting.insertCSS({
		target: { tabId },
		css: text
	});
	injectedCSS[tabId] = text;
}

fullReset.onclick = () => {
	if (
		window.confirm(
			"Do you really want to reset Type-X? This will remove all loaded fonts and reset all font overrides to the extension default values. THIS CANNOT BE UNDONE."
		)
	) {
		chrome.storage.local.set(
			{
				extensionActive: false,
				fonts: defaultFonts,
				files: defaultFiles,
				blacklist: defaultBlacklist
			},
			() => updateStatus(false)
		);
	}
};

// Toggle extension on/off using the button
activateFonts.onclick = () => {
	chrome.storage.local.get("extensionActive", ({ extensionActive }) => {
		updateStatus(!extensionActive);
	});
};

// Toggle extension on/off
export function updateStatus(status) {
	chrome.storage.local.set(
		{
			extensionActive: status
		},
		() => {
			chrome.tabs.query(
				{ active: true, currentWindow: true },
				async tabs => {
					const activeTab = tabs[0];
					await generateStyleSheet();
					await injectStyleSheet(activeTab.id, status);
				}
			);
			showStatus();
		}
	);
}

// Show status of extension in the popup
const showStatus = firstRun => {
	chrome.storage.local.get("extensionActive", ({ extensionActive }) => {
		chrome.action.setIcon({
			path: `icons/typex-${extensionActive ? "active" : "off"}@128.png`
		});
		activateFonts.classList.toggle("active", extensionActive);
		!firstRun && activateFonts.classList.remove("first-run");
	});
};

// Injecting the stylesheet is fast, adding a class to
// the body isn't. We don't want a delay, so the CSS will
// enable the fonts immediately, and we only add a class
// when we want to *remove* the custom fonts.
let customFontsOn = () => {
	delete document.documentElement.dataset.disablefont;
};
let customFontsOff = () => {
	document.documentElement.dataset.disablefont = "";
};
async function injectStyleSheet(tabId, extensionActive) {
	let stylesheetsCode = stylesheets.join("\n");
	if (extensionActive) {
		// Inject CSS to activate font
		await insertOrReplaceCss(tabId, stylesheetsCode);
	}
	chrome.scripting.executeScript({
		target: { tabId },
		func: extensionActive ? customFontsOn : customFontsOff
	});
}

async function generateStyleSheet() {
	let { fonts, files, blacklist } = await chrome.storage.local.get([
		"fonts",
		"files",
		"blacklist"
	]);
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
				`html:not([data-disablefont]) ${selector}${blacklistSelectors}`
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
				axesStyles.push(
					`'${axes[axisData].id}' ${axes[axisData].value}`
				);
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
							${axesStyles.length ? `font-variation-settings: ${axesStyles.join(",")};` : ""}
							${font.css}
						}`;

		stylesheets.push(stylesheet);
	}
}

// Initial setup when popup is opened
updateStatus(false);
