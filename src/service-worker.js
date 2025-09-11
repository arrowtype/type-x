import { getFonts } from "./font";

/** @type {string[]} */
let stylesheets = [];
/** @type {Object.<number, string>} */
let injectedCSS = {};
/**
 * @param {number} tabId
 * @param {string} category
 * @param {string} text
 */
async function insertOrReplaceCss(tabId, category, text) {
	if (tabId in injectedCSS && category in injectedCSS[tabId]) {
		if (injectedCSS[tabId][category] == text) {
			return;
		}
		await chrome.scripting.removeCSS({
			target: { tabId },
			css: injectedCSS[tabId][category]
		});
	}
	if (!(tabId in injectedCSS)) {
		injectedCSS[tabId] = {};
	}
	injectedCSS[tabId][category] = text;
	await chrome.scripting.insertCSS({
		target: { tabId },
		css: text
	});
}

// Do the thing! (Generate stylesheet and inject into active tab)
export async function runTypeX() {
	let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
	const activeTab = tabs[0];
	if (activeTab) {
		let fontDeclarations = await generateFontStyleSheets();
		let fontFileDeclarations = await generateFontFileStyleSheets();
		await injectStyleSheets(
			activeTab.id,
			fontDeclarations,
			fontFileDeclarations
		);
	}
}

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

/**
 * @param {number} tabId
 */
async function injectStyleSheets(
	tabId,
	fontDeclarations,
	fontFileDeclarations
) {
	let { extensionActive } = await chrome.storage.local.get("extensionActive");
	let fontDeclarationsCss = fontDeclarations.join("\n");
	let fontFileDeclarationsCss = fontFileDeclarations.join("\n");
	if (extensionActive) {
		// Inject CSS to activate font
		await insertOrReplaceCss(tabId, "fonts", fontDeclarationsCss);
		await insertOrReplaceCss(tabId, "fontfiles", fontFileDeclarationsCss);
	}
	chrome.scripting.executeScript({
		target: { tabId },
		func: extensionActive ? customFontsOn : customFontsOff
	});
}

async function generateFontStyleSheets() {
	let { blacklist } = await chrome.storage.local.get(["blacklist"]);
	let fonts = await getFonts();
	stylesheets = [];

	for (const font of fonts) {
		let fontName = font.name;
		let stylesheet = "";
		let selectors = font.cssSelectorString(blacklist);
		const stack = `'${fontName}', ${font.fallback}`;
		stylesheet += `
                        ${selectors} {
                            font-family: ${stack} !important;
                            ${font.cssVariationSettings()}
                            ${font.css}
                        }`;

		stylesheets.push(stylesheet);
	}
	return stylesheets;
}

async function generateFontFileStyleSheets() {
	let fonts = await getFonts();
	let { files } = await chrome.storage.local.get("files");
	let stylesheets = [];
	for (const font of fonts) {
		let fontName = font.name;
		if (font.file in files) {
			stylesheets.push(`
                            @font-face {
                                font-family: '${fontName}';
                                src: url('${files[font.file].file}');
                                font-weight: 100 900;
                                font-stretch: 50% 200%;
                            }`);
		}
	}
	return stylesheets;
}

// Listen for call from popup or page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.pageLoad) {
		// We moved to a new page; although we may have injected CSS into this *tab* previously,
		// we haven't for this page, so clear it from our cache so we inject some more.
		delete injectedCSS[sender.tab.id];
	}
	if (message.runTypeX) {
		runTypeX();
	}
});
