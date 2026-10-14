import { getFonts } from "./font";

/** @type {string[]} */
let stylesheets = [];
// The CSS we last injected into each tab, per category. This lives in session
// storage rather than a variable because Chrome stops idle service workers
// after ~30 seconds, and we need the exact text to remove an old stylesheet
// once the worker starts up again. Otherwise the old stylesheet stays in the
// page: e.g. the slider values keep overriding "[Inherit page styles]".
const injectedCssKey = tabId => `injectedCSS-${tabId}`;

/**
 * @param {number} tabId
 * @returns {Promise<Object.<string, string>>}
 */
async function getInjectedCss(tabId) {
	const key = injectedCssKey(tabId);
	return (await chrome.storage.session.get(key))[key] || {};
}

/**
 * @param {number} tabId
 * @param {Object.<string, string>} css
 */
async function setInjectedCss(tabId, css) {
	try {
		await chrome.storage.session.set({ [injectedCssKey(tabId)]: css });
	} catch (error) {
		// Session storage is limited to 10 MB, and font files are inlined
		console.debug(`Can't remember CSS for ${tabId}:`, error.message);
	}
}

// Run CSS updates one at a time, so quick successive changes (like dragging
// a slider) can't both replace the same stylesheet and leave one behind
let cssQueue = Promise.resolve();
function queueCssUpdate(update) {
	const result = cssQueue.then(update);
	cssQueue = result.catch(() => {});
	return result;
}

/**
 * @param {number} tabId
 * @param {string} category
 * @param {string} text
 */
function insertOrReplaceCss(tabId, category, text) {
	return queueCssUpdate(async () => {
		const injectedCss = await getInjectedCss(tabId);
		const previousCss = injectedCss[category];
		if (previousCss == text) {
			return;
		}

		// Insert new CSS...
		await chrome.scripting.insertCSS({
			target: { tabId },
			css: text
		});

		if (previousCss) {
			// ...and remove old CSS *afterwards* to prevent FOUT
			await chrome.scripting.removeCSS({
				target: { tabId },
				css: previousCss
			});
		}

		injectedCss[category] = text;
		await setInjectedCss(tabId, injectedCss);
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
	try {
		let { extensionActive } = await chrome.storage.local.get(
			"extensionActive"
		);
		let fontDeclarationsCss = fontDeclarations.join("\n");
		let fontFileDeclarationsCss = fontFileDeclarations.join("\n");
		if (extensionActive) {
			// Inject CSS to activate font
			await insertOrReplaceCss(tabId, "fonts", fontDeclarationsCss);
			await insertOrReplaceCss(
				tabId,
				"fontfiles",
				fontFileDeclarationsCss
			);
		}
		await chrome.scripting.executeScript({
			target: { tabId },
			func: extensionActive ? customFontsOn : customFontsOff
		});
	} catch (error) {
		// Silently ignore errors for protected pages (chrome://, extension pages, etc.)
		console.debug(`Can't inject into ${tabId}:`, error.message);
	}
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
		queueCssUpdate(() =>
			chrome.storage.session.remove(injectedCssKey(sender.tab.id))
		);
	}
	if (message.runTypeX) {
		runTypeX();
	}
});

chrome.tabs.onRemoved.addListener(tabId => {
	queueCssUpdate(() => chrome.storage.session.remove(injectedCssKey(tabId)));
});
