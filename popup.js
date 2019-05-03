// Recursive

let activateFonts = document.getElementById('activateFonts');

activateFonts.onclick = element => {
    chrome.storage.sync.get(
        "fontActivated", ({ fontActivated }) => {
            chrome.storage.sync.set({
                "fontActivated": !fontActivated
            }, () => {
                // TODO: properly show state of fontActivated
                // instead of sticking it in the button text
                activateFonts.innerText = !fontActivated;

                chrome.runtime.getBackgroundPage(backgroundPage => {
                    backgroundPage.toggle(!fontActivated);
                });
            });
        }
    );
};