let stylesheets = [];
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

// Do the thing! (Generate stylesheet and inject into active tab)
export async function runTypeX() {
	let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
	let { extensionActive } = await chrome.storage.local.get("extensionActive");
	const activeTab = tabs[0];
	await generateStyleSheet();
	await injectStyleSheet(activeTab.id);
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
async function injectStyleSheet(tabId) {
	let { extensionActive } = await chrome.storage.local.get("extensionActive");
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
                            ${
								axesStyles.length
									? `font-variation-settings: ${axesStyles.join(
											","
									  )};`
									: ""
							}
                            ${font.css}
                        }`;

		stylesheets.push(stylesheet);
	}
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
