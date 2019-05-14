// Recursive

const activateFonts = document.querySelector("#activateFonts");

// Toggle extension on/off
activateFonts.onclick = () => {
    chrome.storage.sync.get(
        "fontActivated", ({ fontActivated }) => {
            chrome.storage.sync.set({
                "fontActivated": !fontActivated
            }, () => {
                chrome.runtime.getBackgroundPage(backgroundPage => {
                    backgroundPage.toggle(!fontActivated, true);
                });
                updateStatus();
            });
        }
    );
};

// Show status of extension in the popup
const updateStatus = () => {
    chrome.storage.sync.get(
        "fontActivated", ({ fontActivated }) => {
            activateFonts.innerText = fontActivated ? "Turn off" : "Turn on";
        }
    );
}

// Get current fonts from storage and show them in the popup
chrome.storage.sync.get(
    "fonts", ({ fonts }) => {
        buildForm(fonts)
    }
);

function buildForm(fonts) {
    const usedFonts = document.querySelector("#usedFonts");

    for (const font of fonts) {
        const usedFont = document.createElement("fieldset");

        // Name
        const nameElement = document.createElement("input");
        nameElement.setAttribute("type", "text");
        nameElement.setAttribute("name", "name");
        nameElement.setAttribute("value", font.name);
        usedFont.appendChild(nameElement);

        usedFonts.appendChild(usedFont);
    }
}

function initForm() {
    const form = document.querySelector("#fontsForm");

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        storeForm();
    }, false);
}

function storeForm() {
    const newFonts = [];
    const fieldsets = document.querySelectorAll("#usedFonts > fieldset");

    for (const fieldset of fieldsets) {
        const newFont = {}
        const inputs = fieldset.querySelectorAll("input");

        for (const input of inputs) {
            // console.log(input);
            newFont[input.name] = input.value;
        }

        // Temp
        newFont["file"] = "testfont.ttf";
        newFont["selectors"] = "*";

        newFonts.push(newFont);
    }

    chrome.storage.sync.set({ "fonts": newFonts }, () => {
        chrome.runtime.getBackgroundPage(backgroundPage => {
            // TODO!! The new stylesheet will be overwritten
            // by the previous one. E.g. all current tabs
            // will stay on the old font, new tabs will get
            // the new font
            backgroundPage.generateStyleSheet();
        });
    });
}

// Initialise popup
updateStatus();
initForm();