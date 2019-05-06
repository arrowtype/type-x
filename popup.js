// Recursive

let activateFonts = document.getElementById('activateFonts');
let activateFontsStatus = document.getElementById('activateFontsStatus');

activateFonts.onclick = () => {
    chrome.storage.sync.get(
        "fontActivated", ({ fontActivated }) => {
            chrome.storage.sync.set({
                "fontActivated": !fontActivated
            }, () => {
                chrome.runtime.getBackgroundPage(backgroundPage => {
                    backgroundPage.toggle(!fontActivated);
                });
                updateStatus();
            });
        }
    );
};

const updateStatus = () => {
    chrome.storage.sync.get(
        "fontActivated", ({ fontActivated }) => {
            activateFontsStatus.innerText = `Active: ${fontActivated ? "Yep" : "Nope"}`;
        }
    );
}

updateStatus();