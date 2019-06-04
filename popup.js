// Copyright 2019 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const activateFonts = document.querySelector("#activateFonts");
const showFonts = document.querySelector("#showFonts");
const addFont = document.querySelector("#addFont");
const showBlacklist = document.querySelector("#showBlacklist");
const fontFiles = {};
const localFonts = {};

// Get current fonts from storage and show them in the popup
chrome.fontSettings.getFontList((fonts) => {
    for (const font of fonts) {
        localFonts[font.displayName] = font.fontId;
    }
    chrome.storage.local.get(
        ["fonts", "files", "blacklist"], ({
            fonts,
            files,
            blacklist
        }) => {
            buildForm(fonts, files, blacklist);
        }
    );
});

// Toggle extension on/off using the button
activateFonts.onclick = () => {
    chrome.storage.local.get(
        "fontActivated", ({
            fontActivated
        }) => {
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

// Show/hide blacklist
showBlacklist.onclick = () => {
    // document.querySelector(".blacklist-container").classList.toggle("show");
    document.querySelector(".ignores").classList.toggle("show-blacklist");
}

// Add new font fieldset to form
addFont.onclick = () => {
    const randomId = window.crypto.getRandomValues(new Uint32Array(2)).join("");
    chrome.storage.local.get(
        "files", ({
            files
        }) => {
            const newFont = {
                "new": true,
                "id": randomId,
                "file": Object.keys(files)[0],
                "selectors": ["/* Add CSS selectors here */"],
                "css": "/* Additional styles to apply */"
            };

            addFormElement(newFont, files);
            showChange(true);
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
        "fontActivated", ({
            fontActivated
        }) => {
            chrome.browserAction.setIcon({
                path: `icons/typex-${fontActivated ? "active" : "off"}@128.png`
            });
            activateFonts.classList.toggle("active", fontActivated);
            !firstRun && activateFonts.classList.remove("first-run");
        }
    );
}

// Show/hide button to apply changes
function showChange(show) {
    document.querySelector(".apply-changes").classList.toggle("show", show);
}

// Initialise form
function initForm() {
    document.querySelector(".apply-changes").onclick = () => {
        saveForm();
        showChange(false);
    }

    document.querySelector("#fontsForm").oninput = () => {
        showChange(true);
    }
}

// Generate form based on current settings
function buildForm(fonts, files, blacklist) {
    const form = document.querySelector("#fontsForm");
    const usedFonts = form.querySelector("#usedFonts");
    const blacklistEl = form.querySelector("[name=blacklist]");

    // Clear out previous form
    while (usedFonts.firstChild) {
        usedFonts.removeChild(usedFonts.firstChild);
    }

    // Inject new fonts
    for (const font of fonts) {
        addFormElement(font, files);
    }

    // Inject blacklist
    blacklistEl.value = blacklist.join(", ");
}

// New file uploaded, append to all selects
function updateFontDropdowns(id) {
    const optgroups = document.querySelectorAll(".select-font select optgroup:first-child");
    for (const optgroup of optgroups) {
        const options = optgroup.querySelectorAll("option");
        let present = false;
        for (const option of options) {
            present = option.value === id ? true : present;
        }
        if (present) {
            optgroup.value = id;
        } else {
            const option = document.createElement("option");
            option.value = id;
            option.text = id;
            optgroup.append(option);
        }
    }
}

function addFormElement(font, files) {
    const usedFonts = document.querySelector("#usedFonts");
    const template = document.querySelector("#newFont");
    const el = document.importNode(template.content, true);

    el.querySelector(".font-name-title").innerText = font.file || "New font override";

    const fontSelect = el.querySelector(".select-font select");

    const dropdown = document.createElement("select");
    dropdown.setAttribute("name", "file");
    dropdown.setAttribute("id", `file${font.id}`);

    const extensionGroup = document.createElement("optgroup");
    extensionGroup.setAttribute("label", "Custom fonts:");
    for (const id in files) {
        const option = document.createElement("option");
        option.value = id;
        option.text = id;
        option.selected = font.file == id;
        extensionGroup.append(option);
    }
    dropdown.append(extensionGroup);

    const localGroup = document.createElement("optgroup");
    localGroup.setAttribute("label", "Local fonts:");
    for (const id in localFonts) {
        const option = document.createElement("option");
        option.value = id;
        option.text = id;
        option.selected = font.file == id;
        localGroup.append(option);
    }
    dropdown.append(localGroup);

    dropdown.onchange = (e) => {
        e.target.closest("fieldset").querySelector(".font-name-title").innerText = e.target.value;
    };

    fontSelect.replaceWith(dropdown);

    el.querySelector("[name=newfile]").dataset.fontid = font.id;
    el.querySelector("[name=newfile]").onchange = grabFont;

    el.querySelector("[name=id]").value = font.id;
    el.querySelector("[name=css]").value = font.css;
    el.querySelector("[name=selectors]").value = font.selectors.join(", ");

    el.querySelector(".delete-button-container button").onclick = (e) => {
        e.target.closest("fieldset").remove();
        showChange(true);
    };

    el.querySelector(".font-title button").onclick = (e) => {
        e.target.closest("fieldset").classList.toggle("show-font-details");
    };

    if (font.new) {
        el.querySelector("fieldset").classList.add("show-font-details");
    }

    usedFonts.prepend(el);
}

// Store changes made to fonts
// Note: files have already been stored at this point
function saveForm() {
    const newFonts = [];
    const form = document.querySelector("#fontsForm");
    const fieldsets = form.querySelectorAll("fieldset");

    // Get new fonts
    for (const fieldset of fieldsets) {
        const newFont = {}
        const inputs = fieldset.querySelectorAll("*[name]");

        for (const input of inputs) {
            if (input.name === "id" || input.name === "css" || input.name === "file") {
                newFont[input.name] = input.value;
            } else if (input.name === "selectors") {
                // Selectors should become an array
                newFont["selectors"] = input.value.split(",").map(i => i.trim());
            }
        }
        newFonts.unshift(newFont);
    }

    // Get blacklist
    const blacklist = form.querySelector("[name=blacklist]").value.split(",").map(i => i.trim());

    // Apply new fonts and activate extension
    chrome.storage.local.set({
        "fonts": newFonts,
        "blacklist": blacklist
    }, () => {
        updateStatus(true, true);
    });
}

// Keep track of file data, and hook up to rest
// of form data on submit
function grabFont(e) {
    const file = e.target.files[0];
    const name = file.name;
    const fontId = e.target.dataset.fontid;

    const reader = new FileReader();
    reader.onload = ({
        target
    }) => {
        // Stick new file in storage
        chrome.storage.local.get(
            "files", ({
                files
            }) => {
                files[name] = target.result;
                chrome.storage.local.set({
                    "files": files
                }, () => {
                    updateFontDropdowns(name);
                    const dropdown = document.querySelector(`#file${fontId}`);
                    dropdown.value = name;
                    dropdown.dispatchEvent(new Event("change"));
                });
            }
        );
    };
    reader.readAsDataURL(file);
}

// Initialise popup
showStatus(true);
initForm();