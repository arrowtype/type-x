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

// Generate form based on current settings
function buildForm(fonts) {
    const usedFonts = document.querySelector("#usedFonts");

    for (const font of fonts) {
        const usedFont = document.createElement("fieldset");

        let el = null;

        // Name
        el = document.createElement("input");
        el.setAttribute("type", "text");
        el.setAttribute("name", "name");
        el.setAttribute("value", font.name);
        usedFont.appendChild(el);

        // File
        el = document.createElement("input");
        el.setAttribute("type", "text");
        el.setAttribute("name", "file");
        el.setAttribute("value", font.file);
        usedFont.appendChild(el);

        // Selectors
        el = document.createElement("input");
        el.setAttribute("type", "text");
        el.setAttribute("name", "selectors");
        el.setAttribute("value", font.selectors.join(", "));
        usedFont.appendChild(el);

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

// Store changes made to fonts
function storeForm() {
    const newFonts = [];
    const fieldsets = document.querySelectorAll("#usedFonts > fieldset");

    for (const fieldset of fieldsets) {
        const newFont = {}
        const inputs = fieldset.querySelectorAll("input");

        for (const input of inputs) {
            if (input.name === "name" || input.name === "file") {
                newFont[input.name] = input.value;
            }

            if (input.name === "selectors") {
                newFont["selectors"] = input.value.split(",").map(item => item.trim());
            }
        }
        newFonts.push(newFont);
    }

    // Apply new fonts and activate extension
    chrome.storage.sync.set({ "fonts": newFonts }, () => {
        chrome.runtime.getBackgroundPage(backgroundPage => {
            backgroundPage.generateStyleSheet(() => {
                chrome.storage.sync.set({
                    "fontActivated": true
                }, () => {
                    chrome.runtime.getBackgroundPage(backgroundPage => {
                        backgroundPage.toggle(true, true);
                    });
                    updateStatus();
                });
            });
        });
    });
}

// Initialise popup
updateStatus();
initForm();