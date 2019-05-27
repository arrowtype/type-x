// Recursive

const activateFonts = document.querySelector("#activateFonts");
const showFonts = document.querySelector("#showFonts");
const addFont = document.querySelector("#addFont");
const fontFiles = {};

// Get current fonts from storage and show them in the popup
chrome.storage.local.get(
    ["fonts", "files"], ({ fonts, files }) => {
        buildForm(fonts, files);
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
    document.querySelector("footer").classList.toggle("show");
    showFonts.classList.toggle("active");
}

// Add new font fieldset to form
addFont.onclick = () => {
    const randomId = window.crypto.getRandomValues(new Uint32Array(2)).join("");
    const newFont = {
        "new": true,
        "id": randomId,
        "file": 20, // TODO: which file?
        "selectors": [],
        "css": ""
    };

    chrome.storage.local.get(
        "files", ({ files }) => {
            addFormElement(newFont, files);
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
function buildForm(fonts, files) {
    const usedFonts = document.querySelector("#usedFonts");

    // Clear out previous form
    while (usedFonts.firstChild) {
        usedFonts.removeChild(usedFonts.firstChild);
    }

    for (const font of fonts) {
        addFormElement(font, files);
    }
}

// New file uploaded, append to all selects
function updateFontDropdowns(id, name) {
    const dropdowns = document.querySelectorAll(".select-font select");
    for (const dropdown of dropdowns) {
        const selected = false;
        dropdown.options.add(new Option(name, id, false, selected));
    }
}

function addFormElement(font, files) {
    const usedFonts = document.querySelector("#usedFonts");
    const template = document.querySelector("#newFont");
    const el = document.importNode(template.content, true);

    el.querySelector(".font-name-title").innerText = `${files[font.file].name}`;

    const fontSelect = el.querySelector(".select-font select");

    const dropdown = document.createElement("select");
    dropdown.setAttribute("name", "file");
    dropdown.setAttribute("id", `file${font.id}`);
    for (const id in files) {
        const selected = font.file == id;
        dropdown.options.add(new Option(files[id].name, id, false, selected));
    }
    fontSelect.replaceWith(dropdown);

    el.querySelector("[name=newfile]").dataset.fontid = font.id;
    el.querySelector("[name=newfile]").onchange = grabFont;

    el.querySelector("[name=id]").value = font.id;
    el.querySelector("[name=css]").value = font.css;
    el.querySelector("[name=selectors]").value = font.selectors.join(", ");

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

// Store changes made to fonts
function saveForm() {
    const newFonts = [];
    const fieldsets = document.querySelectorAll("#fontsForm fieldset");

    for (const fieldset of fieldsets) {
        const newFont = {}
        const inputs = fieldset.querySelectorAll("*[name]");

        for (const input of inputs) {
            if (input.name === "id" || input.name === "file" || input.name === "css") {
                newFont[input.name] = input.value;
            } else if (input.name === "selectors") {
                // Selectors should become an array
                newFont["selectors"] = input.value.split(",").map(i => i.trim());
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
    const fontId = e.target.dataset.fontid;
    const fileId = window.crypto.getRandomValues(new Uint32Array(2)).join("");

    const reader = new FileReader();
    reader.onload = ({ target }) => {
        const name = file.name;

        // Store new file in local font storage
        chrome.storage.local.get(
            "files", ({ files }) => {
                files[fileId] = {
                    "name": name,
                    "file": target.result
                }
                chrome.storage.local.set({ "files": files }, () => {
                    updateFontDropdowns(fileId, name);
                    document.querySelector(`#file${fontId}`).value = fileId;
                });
            }
        );
    };
    reader.readAsDataURL(file);
}

// Initialise popup
showStatus(true);
initForm();