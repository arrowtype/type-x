// Recursive

const activateFonts = document.querySelector("#activateFonts");

// Toggle extension on/off using the button
activateFonts.onclick = () => {
    chrome.storage.sync.get(
        "fontActivated", ({ fontActivated }) => {
            updateStatus(!fontActivated);
        }
    );
};

// Toggle extension on/off
function updateStatus(status) {
    chrome.storage.sync.set({
        "fontActivated": status
    }, () => {
        chrome.runtime.getBackgroundPage(backgroundPage => {
            backgroundPage.updateFonts(status, true);
        });
        showStatus();
    });
}

// Show status of extension in the popup
const showStatus = () => {
    chrome.storage.sync.get(
        "fontActivated", ({ fontActivated }) => {
            activateFonts.innerText = fontActivated ? "Turn off" : "Turn on";
        }
    );
}

// Initialise form
function initForm() {
    const form = document.querySelector("#fontsForm");

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        storeForm();
    }, false);
}

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

        // CSS
        el = document.createElement("input");
        el.setAttribute("type", "text");
        el.setAttribute("name", "css");
        el.setAttribute("value", font.css);
        usedFont.appendChild(el);

        usedFonts.appendChild(usedFont);
    }
}

// Store changes made to fonts
function storeForm() {
    const newFonts = [];
    const fieldsets = document.querySelectorAll("#usedFonts > fieldset");

    for (const fieldset of fieldsets) {
        const newFont = {}
        const inputs = fieldset.querySelectorAll("input");

        for (const input of inputs) {
            if (input.name === "selectors") {
                // Selectors should become an array
                newFont["selectors"] = input.value.split(",").map(i => i.trim());
            } else {
                // The rest is plain text
                newFont[input.name] = input.value;
            }
        }
        newFonts.push(newFont);
    }

    // Apply new fonts and activate extension
    chrome.storage.sync.set({ "fonts": newFonts }, () => {
        chrome.runtime.getBackgroundPage(backgroundPage => {
            backgroundPage.generateStyleSheet(() => {
                updateStatus(true);
            });
        });
    });
}

// Get current fonts from storage and show them in the popup
chrome.storage.sync.get(
    "fonts", ({ fonts }) => {
        buildForm(fonts)
    }
);

// Initialise popup
showStatus();
initForm();