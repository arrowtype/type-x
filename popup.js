// Recursive

const activateFonts = document.querySelector("#activateFonts");
const addFont = document.querySelector("#addFont");
const fontFiles = {};
// const fontfile = document.querySelector("#fontfile");

// Toggle extension on/off using the button
activateFonts.onclick = () => {
    chrome.storage.local.get(
        "fontActivated", ({ fontActivated }) => {
            updateStatus(!fontActivated);
        }
    );
};

// Toggle extension on/off using the button
addFont.onclick = () => {
    chrome.storage.local.get(
        "fonts", ({ fonts }) => {
            fonts.push({
                "name": "",
                "file": "",
                "selectors": [],
                "css": ""
            });
            buildForm(fonts);
        }
    );
};

// Toggle extension on/off
function updateStatus(status) {
    chrome.storage.local.set({
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
    chrome.storage.local.get(
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
        saveForm();
    }, false);
}

// Generate form based on current settings
function buildForm(fonts) {
    const usedFonts = document.querySelector("#usedFonts");

    while (usedFonts.firstChild) {
        usedFonts.removeChild(usedFonts.firstChild);
    }

    for (const font of fonts) {
        const usedFont = document.createElement("fieldset");

        let el = null;

        // Name
        el = document.createElement("input");
        el.setAttribute("type", "text");
        el.setAttribute("name", "name");
        el.setAttribute("value", font.name);
        usedFont.appendChild(el);

        // Original file
        el = document.createElement("input");
        el.setAttribute("type", "hidden");
        el.setAttribute("name", "originalfile");
        el.setAttribute("value", font.file);
        usedFont.appendChild(el);

        // Optional new file
        el = document.createElement("input");
        el.setAttribute("type", "file");
        el.setAttribute("accept", ".ttf,.otf,.eot,.woff,.woff2");
        el.setAttribute("name", (Math.random() + 1).toString(36).substring(7));
        el.onchange = grabFont;
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
function saveForm() {
    const newFonts = [];
    const fieldsets = document.querySelectorAll("#fontsForm fieldset");

    for (const fieldset of fieldsets) {
        const newFont = {}
        const inputs = fieldset.querySelectorAll("input");

        for (const input of inputs) {
            if (input.name === "selectors") {
                // Selectors should become an array
                newFont["selectors"] = input.value.split(",").map(i => i.trim());
            } else if (input.name === "name" || input.name === "css") {
                newFont[input.name] = input.value;
            } else {
                if (fontFiles[input.name]) {
                    newFont["file"] = fontFiles[input.name];
                } else {
                    newFont["file"] = inputs["originalfile"];
                }
            }
        }
        newFonts.push(newFont);
    }

    // Apply new fonts and activate extension
    chrome.storage.local.set({ "fonts": newFonts }, () => {
        chrome.runtime.getBackgroundPage(backgroundPage => {
            backgroundPage.generateStyleSheet(() => {
                updateStatus(true);
            });
        });
    });
}

// Keep track of file data, and hook up to rest
// of form data on submit
function grabFont(e) {
    const file = e.target.files[0];
    const id = e.target.name;

    const reader = new FileReader();
    reader.onload = ({ target }) => {
        fontFiles[id] = target.result;
    };
    reader.readAsDataURL(file);
}

// Get current fonts from storage and show them in the popup
chrome.storage.local.get(
    "fonts", ({ fonts }) => {
        buildForm(fonts);
    }
);

// Initialise popup
showStatus();
initForm();