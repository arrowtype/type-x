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

import { defaultFiles, defaultFonts } from "./recursive-fonts.js";
import { addFormElement, buildForm, saveForm } from "./form";
import { Font } from "./font";

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
const showBlacklist: HTMLButtonElement =
	document.querySelector("#showBlacklist");
const addFont: HTMLButtonElement = document.querySelector("#addFont");
const activateFonts: HTMLButtonElement =
	document.querySelector("#activateFonts");
const fullReset: HTMLButtonElement = document.querySelector(".full-reset");

// Show/hide blacklist
showBlacklist.onclick = () => {
	document.querySelector(".blacklist").classList.toggle("show");
};

// Add new font fieldset to form
addFont.onclick = async () => {
	const randomId = window.crypto.getRandomValues(new Uint32Array(2)).join("");
	let { files } = await chrome.storage.local.get("files");
	const newFont = Font.fromObject({
		new: true,
		id: randomId,
		file: Object.keys(files)[0],
		fallback: ["monospace"],
		selectors: ["/* Add CSS selectors here */"],
		css: "/* Additional styles to apply */"
	});

	addFormElement(newFont, files);
	saveForm();
};

fullReset.onclick = async () => {
	if (
		window.confirm(
			"Do you really want to reset Type-X? This will remove all loaded fonts and reset all font overrides to the extension default values. THIS CANNOT BE UNDONE."
		)
	) {
		await chrome.storage.local.set({
			extensionActive: false,
			fonts: defaultFonts,
			files: defaultFiles,
			blacklist: defaultBlacklist
		});
		// Rebuild the menu
		buildForm();
		callTypeX();
	}
};

// Update the status and the tabs when storage changes
chrome.storage.local.onChanged.addListener(changes => {
	if (changes.extensionActive) {
		showStatus();
	}
	callTypeX();
});

async function showStatus() {
	let { extensionActive } = await chrome.storage.local.get("extensionActive");
	// Show status of extension in the popup
	chrome.action.setIcon({
		path: `icons/typex-${extensionActive ? "active" : "off"}@128.png`
	});
	activateFonts.classList.toggle("active", extensionActive);
}

// Toggle extension on/off using the button
activateFonts.onclick = async () => {
	let { extensionActive } = await chrome.storage.local.get("extensionActive");
	await chrome.storage.local.set({
		extensionActive: !extensionActive
	});
	await callTypeX();
};

export async function callTypeX() {
	chrome.runtime.sendMessage({ runTypeX: true });
}

// Check there's something in local storage and reset to defaults if not
chrome.storage.local.get(
	["fonts", "files", "blacklist"],
	async ({ fonts, files, blacklist }) => {
		if (fonts === undefined) fonts = defaultFonts;
		if (files === undefined) files = defaultFiles;
		if (blacklist === undefined) blacklist = defaultBlacklist;
		await chrome.storage.local.set({
			fonts,
			files,
			blacklist
		});
	}
);

showStatus();
