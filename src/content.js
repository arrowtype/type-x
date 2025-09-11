// Trigger TypeX on load
chrome.runtime.sendMessage({ runTypeX: true, pageLoad: true });
// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.reloadAnimation) {
		console.log("Received reload animation message");
		// Flash document opacity to show reloading
		document.documentElement.style.transition = "opacity 0.3s";
		document.documentElement.style.opacity = "0.5";
		setTimeout(() => {
			document.documentElement.style.opacity = "1";
		}, 300);
	}
});
