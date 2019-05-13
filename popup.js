// Recursive

let activateFonts = document.getElementById('activateFonts');

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
            activateFonts.innerText = fontActivated ? "Turn off" : "Turn on";
        }
    );
}

updateStatus();