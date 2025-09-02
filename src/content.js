// executeScript isolates the variable tables between the popup and the
// tab, so we can't pass `updateCount` from one to the other. So we have
// to do as a message instead.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.updateCount) {
		document.documentElement.dataset.updatefont = message.updateCount;
	}
});
