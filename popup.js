// Recursive

const activateFonts = document.querySelector("#activateFonts");
const showFonts = document.querySelector("#showFonts");
const addFont = document.querySelector("#addFont");
const fontFiles = {};

// Get current fonts from storage and show them in the popup
chrome.storage.local.get(
    "fonts", ({ fonts }) => {
        buildForm(fonts);
    }
);

// Toggle extension on/off using the button
activateFonts.onclick = () => {
    chrome.storage.local.get(
        "fontActivated", ({ fontActivated }) => {
            updateStatus(!fontActivated);
        }
    );
};

// Show/hide font form
showFonts.onclick = () => {
    document.querySelector(".main-fonts").classList.toggle("show");
    showFonts.classList.toggle("active");
}

// Toggle extension on/off using the button
addFont.onclick = () => {
    chrome.storage.local.get(
        "fonts", ({ fonts }) => {
            fonts.push({
                "new": true,
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
function updateStatus(status, updateExisting) {
    chrome.storage.local.set({
        "fontActivated": status
    }, () => {
        chrome.runtime.getBackgroundPage(backgroundPage => {
            backgroundPage.updateFonts(status, updateExisting);
        });
        showStatus();
    });
}

// Show status of extension in the popup
const showStatus = (firstRun) => {
    chrome.storage.local.get(
        "fontActivated", ({ fontActivated }) => {
            chrome.browserAction.setIcon({
                path: `icons/typex-${fontActivated ? "active" : "off"}@128.png`
            });
            activateFonts.classList.toggle("active", fontActivated);
            !firstRun && activateFonts.classList.remove("first-run");
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
    const template = document.querySelector("#newFont");

    while (usedFonts.firstChild) {
        usedFonts.removeChild(usedFonts.firstChild);
    }

    let id = 0;

    for (const font of fonts) {
        const el = document.importNode(template.content, true);

        el.querySelector("[name=name]").value = font.name;
        el.querySelector("[name=css]").value = font.css;
        el.querySelector("[name=selectors]").value = font.selectors.join(", ");

        el.querySelector("[name=file]").setAttribute("id", `font${id++}`);
        el.querySelector("[name=file]").dataset.original = font.file;
        el.querySelector("[name=file]").onchange = grabFont;

        el.querySelector(".delete-button-container button").onclick = (e) => {
            e.target.closest("fieldset").remove()
        };

        el.querySelector(".font-title button").onclick = (e) => {
            e.target.closest("fieldset").classList.toggle("show-font-details")
        };

        if (font.new) {
            el.querySelector("fieldset").classList.add("show-font-details");
        }

        usedFonts.appendChild(el);
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
            } else if (input.name === "file") {
                if (fontFiles[input.id]) {
                    newFont["file"] = fontFiles[input.id];
                } else {
                    newFont["file"] = input.dataset.original;
                }
            }
        }
        newFonts.push(newFont);
    }

    // Apply new fonts and activate extension
    chrome.storage.local.set({ "fonts": newFonts }, () => {
        updateStatus(true, true);
    });
}

// Keep track of file data, and hook up to rest
// of form data on submit
function grabFont(e) {
    const file = e.target.files[0];
    const id = e.target.id;

    const reader = new FileReader();
    reader.onload = ({ target }) => {
        fontFiles[id] = target.result;
    };
    reader.readAsDataURL(file);
}

// Initialise popup
showStatus(true);
initForm();