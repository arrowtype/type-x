import { updateStatus } from "./popup.js";

const localFonts = {};

// Get current fonts from storage and show them in the popup
chrome.fontSettings.getFontList(fonts => {
	for (const font of fonts) {
		localFonts[font.displayName] = font.fontId;
	}
	chrome.storage.local.get(
		["fonts", "files", "blacklist"],
		({ fonts, files, blacklist }) => {
			buildForm(fonts, files, blacklist);
		}
	);
});

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
	blacklistEl.oninput = saveForm;

	syncVariableValues();
}

// New file uploaded, append to all selects
function updateFontDropdowns(id, name) {
	const optgroups = document.querySelectorAll(
		".font-file-select optgroup:first-child"
	);
	for (const optgroup of optgroups) {
		const options = optgroup.querySelectorAll("option");
		let present = false;
		for (const option of options) {
			present = option.value === name ? true : present;
		}
		if (present) {
			optgroup.value = name;
		} else {
			const option = document.createElement("option");
			option.value = id;
			option.text = name;
			optgroup.append(option);
		}
	}
}

// Add new font to the form
export function addFormElement(font, files) {
	const usedFonts = document.querySelector("#usedFonts");
	const template = document.querySelector("#newFont");
	const el = document.importNode(template.content, true);
	const parentEl = el.querySelector(".font");

	el.querySelector(".font-name-title").innerText =
		font.name || "New font override";

	const fontSelect = el.querySelector(".font-file-select");

	const dropdown = document.createElement("select");
	dropdown.setAttribute("name", "file");
	dropdown.setAttribute("id", `file${font.id}`);
	dropdown.classList.add("font-file-select");
	dropdown.onchange = e => {
		const parent = e.target.closest(".font");
		const name = e.target.options[e.target.selectedIndex].text;
		const fileId = e.target.options[e.target.selectedIndex].value;
		addVariableSliders(false, parent);
		addNamedInstances({}, parent);
		chrome.storage.local.get("files", ({ files }) => {
			for (const file in files) {
				if (file == fileId) {
					addVariableSliders(files[file].axes, parent);
					addNamedInstances(files[file].instances, parent);
				}
			}
			saveForm();
		});
		parent.querySelector(".font-name-title").innerText = name;
	};

	const extensionGroup = document.createElement("optgroup");
	extensionGroup.setAttribute("label", "Custom fonts:");
	for (const id in files) {
		const option = document.createElement("option");
		option.value = id;
		option.text = files[id].name;
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

	fontSelect.replaceWith(dropdown);

	el.querySelector("[name=newfile]").dataset.fontid = font.id;
	el.querySelector("[name=newfile]").onchange = grabFont;

	parentEl.dataset.fontid = font.id;
	el.querySelector("[name=id]").value = font.id;
	el.querySelector("[name=css]").value = font.css;
	el.querySelector("[name=fallback]").value = font.fallback;
	el.querySelector("[name=selectors]").value = font.selectors.join(", ");

	el.querySelector(".show-fallbacks").onclick = e => {
		e.target.closest("fieldset").classList.toggle("show-font-fallbacks");
	};

	el.querySelector(".delete-font").onclick = e => {
		e.target.closest("fieldset").remove();
		saveForm();
	};

	el.querySelector(".font-title button").onclick = e => {
		e.target.closest("fieldset").classList.toggle("show-font-details");
	};

	if (font.new) {
		el.querySelector("fieldset").classList.add("show-font-details");
	}

	// Add variable sliders
	let axes = false;
	if (font.axes) {
		axes = font.axes;
	} else if (font.file in files) {
		axes = files[font.file].axes;
	}
	addVariableSliders(axes, parentEl);

	// Add named variable instances
	let instances = false;
	if (font.instances) {
		instances = font.instances;
	} else if (font.file in files) {
		instances = files[font.file].instances;
	}
	addNamedInstances(instances, parentEl);

	// Select the named instance, if in use
	const instanceDropdown = el.querySelector(".select-instance");
	if (instanceDropdown) {
		instanceDropdown.value = font.activeinstance;
		el.querySelector(".font-name-instance").innerText = font.activeinstance;
	}

	parentEl.addEventListener("dragover", highlight, false);
	parentEl.addEventListener("dragleave", unhighlight, false);
	parentEl.addEventListener("drop", grabFont, false);

	const textareas = el.querySelectorAll("textarea");
	for (const textarea of textareas) {
		textarea.oninput = saveForm;
	}

	usedFonts.prepend(el);
}

// Select named instance based on slider values
function syncVariableValues() {
	const containers = document.querySelectorAll(".font");
	for (const container of containers) {
		const sliders = container.querySelectorAll(
			".variable-sliders [type=range]"
		);

		if (!sliders.length) break;

		const customInstance = {};
		for (const slider of sliders) {
			const name = slider.name.replace("var-", "");
			customInstance[name] = parseFloat(slider.value);
		}
		const ci = JSON.stringify(customInstance);

		const dropdown = container.querySelector(".select-instance");
		if (dropdown.value == "--inherit--") {
			container
				.querySelector(".variable-sliders-container")
				.classList.add("mute");
			return;
		} else {
			container
				.querySelector(".variable-sliders-container")
				.classList.remove("mute");
		}

		const options = dropdown.querySelectorAll("option");
		let sel = 1; // "--axes--"
		for (const option of options) {
			if (option.dataset.instance == ci) {
				sel = option.index;
				break;
			}
		}
		dropdown.selectedIndex = sel;
	}
}

/**
 * Add named instances to the font editor.
 * @param {Record<string, any>} instances
 * @param {HTMLElement} el
 */
function addNamedInstances(instances, el) {
	const container = el.querySelector(".variable-instances");
	container.innerHTML = "";

	if (Object.keys(instances).length > 0) {
		// Create instances dropdown
		const dropdown = document.createElement("select");
		dropdown.classList.add("select-instance");
		dropdown.name = "select-instance";
		dropdown.onchange = applyNamedInstance;

		// Add "turn off font-variation-settings" option
		const option = document.createElement("option");
		option.text = "[Inherit page styles]";
		option.value = "--inherit--";
		dropdown.append(option);

		// Add "using axes, but none of a named instance" option
		const option2 = document.createElement("option");
		option2.text = "[Custom axes]";
		option2.value = "--axes--";
		option2.disabled = true;
		dropdown.append(option2);

		for (const instance in instances) {
			const option = document.createElement("option");
			option.text = instance;
			option.value = instance;

			const axes = instances[instance];
			const orderedAxes = {};
			Object.keys(axes)
				.sort()
				.forEach(function (key) {
					orderedAxes[key] = axes[key];
				});
			option.dataset.instance = JSON.stringify(orderedAxes);
			dropdown.append(option);
		}

		container.append(dropdown);
	}
}

function applyNamedInstance(e) {
	const sel = e.target;
	const parent = e.target.closest(".font");

	const instanceName = sel.value == "--inherit--" ? "" : sel.value;
	parent.querySelector(".font-name-instance").innerText = instanceName;

	if (sel.value == "--inherit--" || sel.value == "--axes--") {
		saveForm();
		return;
	}

	const axes = JSON.parse(sel.options[sel.selectedIndex].dataset.instance);

	for (const axis in axes) {
		const slider = parent.querySelector(`[name=var-${axis}]`);
		slider.value = axes[axis];
	}

	saveForm();
}

function addVariableSliders(axes, el) {
	const newAxes = {};
	el.querySelector(".variable-sliders").innerHTML = "";
	if (!axes) {
		el.querySelector(".variable-sliders-container").classList.remove(
			"show"
		);
	} else {
		const keys = Object.keys(axes).sort();
		for (let i = 0; i < keys.length; ++i) {
			const value = axes[keys[i]].value || axes[keys[i]].default || 0;
			const axis = {
				id: keys[i],
				name: axes[keys[i]].name,
				min: axes[keys[i]].min,
				max: axes[keys[i]].max,
				value: value
			};
			newAxes[keys[i]] = axis;

			addSlider(axis, el);
			el.querySelector(".variable-sliders-container").classList.add(
				"show"
			);
		}
	}
	// Return new object of axes. TODO: we could just use
	// the object Fontkit returns.
	return newAxes;
}

// Store changes made to fonts
// Note: files have already been stored at this point
export function saveForm() {
	const newFonts = [];
	const form = document.querySelector("#fontsForm");
	const fieldsets = form.querySelectorAll("fieldset");

	// Get new fonts
	for (const fieldset of fieldsets) {
		const newFont = {};
		const inputs = fieldset.querySelectorAll("*[name]");
		const axes = {};
		const straightInputs = ["id", "css", "fallback"];

		for (const input of inputs) {
			if (input.name === "file") {
				newFont["name"] = input.options[input.selectedIndex].text;
				newFont["file"] = input.options[input.selectedIndex].value;
			} else if (input.name === "select-instance") {
				if (input.value === "--inherit--") {
					newFont["inherit"] = true;
				} else {
					newFont["activeinstance"] = input.value;
				}
			} else if (straightInputs.includes(input.name)) {
				newFont[input.name] = input.value;
			} else if (input.name.startsWith("var-")) {
				const name = input.name.replace("var-", "");
				const axis = {
					id: name,
					name: input.dataset.name,
					min: input.min,
					max: input.max,
					value: input.value
				};
				axes[name] = axis;
			} else if (input.name === "selectors") {
				// Selectors should become an array
				newFont["selectors"] = input.value
					.split(",")
					.map(i => i.trim());
			}
		}

		newFont.axes = axes;
		newFonts.unshift(newFont);
	}

	// Get blacklist
	const blacklist = form
		.querySelector("[name=blacklist]")
		.value.split(",")
		.map(i => i.trim());

	// Apply new fonts and activate extension
	chrome.storage.local.set(
		{
			fonts: newFonts,
			blacklist: blacklist
		},
		() => {
			updateStatus(true);
		}
	);

	syncVariableValues();
}

// Keep track of file data, and hook up to rest
// of form data on submit
function grabFont(e) {
	const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
	const file = files[0]; // Only use first file if multiple are dropped
	const name = file.name;
	const parent = e.target.closest("fieldset");
	const fontId = parent.dataset.fontid;

	parent.classList.remove("highlight");

	// Check if filetype is allowed
	const allowedExt = ["ttf", "otf", "eot", "woff", "woff2"];
	const ext = name.split(".").pop().toLowerCase();
	if (!allowedExt.includes(ext)) {
		return false;
	}

	const reader = new FileReader();
	reader.onload = ({ target }) => {
		// Stick new file in storage
		chrome.storage.local.get("files", ({ files }) => {
			files[name] = {};
			files[name].file = target.result;
			files[name].name = name;
			files[name].axes = {};

			chrome.storage.local.set(
				{
					files: files
				},
				() => {
					parent.querySelector(".font-name-title").innerText = name;
					// Update dropdown
					updateFontDropdowns(name, name);
					const dropdown = document.querySelector(`#file${fontId}`);
					dropdown.value = name;

					// Font is saved, add variable axes, if any
					grabVariableData(file, parent).then(() => {
						saveForm();
					});
				}
			);
		});
	};
	reader.readAsDataURL(file);
}

// Analyse a *new* font for variable axes, create form inputs
/**
 *
 * @param {File} file
 * @param {HTMLElement} parent
 * @returns
 */
function grabVariableData(file, parent) {
	parent
		.querySelector(".variable-sliders-container")
		.classList.remove("show");
	let bufferPromise = file.arrayBuffer().then(buff => {
		return new Uint8Array(buff);
	});

	return import(/* webpackChunkName: "fontkit" */ "fontkit-next").then(
		({ default: fontkit }) => {
			let font = false;
			bufferPromise.then(buffer => {
				try {
					font = fontkit.create(buffer);

					const axes = addVariableSliders(font.variationAxes, parent);
					addNamedInstances(font.namedVariations, parent);

					chrome.storage.local.get("files", ({ files }) => {
						files[file.name].axes = axes;
						files[file.name].instances = font.namedVariations;

						chrome.storage.local.set({
							files: files
						});
					});
				} catch (e) {
					console.log("Failed to parse font.");
				}
			});
		}
	);
}

function addSlider(axis, parent) {
	const variableSliders = parent.querySelector(".variable-sliders");
	const template = document.querySelector("#variableSlider");
	const el = document.importNode(template.content, true);

	const input = el.querySelector("input");
	const label = el.querySelector("label");
	const value = el.querySelector(".slider-value");

	label.innerText = axis.name;

	input.name = `var-${axis.id}`;
	input.min = axis.min;
	input.max = axis.max;
	input.value = axis.value;
	input.dataset.name = axis.name;
	value.innerText = axis.value;

	input.onchange = e => {
		value.innerText = e.target.value;
		// Move dropdown away from "--inherit--" option to ensure
		// axes/dropdown are synced properly
		parent.querySelector(".select-instance").value = "--axes--";
		saveForm();
	};

	variableSliders.append(el);
}

function highlight(e) {
	this.classList.add("highlight");
	e.preventDefault();
	e.stopPropagation();
}

function unhighlight(e) {
	this.classList.remove("highlight");
	e.preventDefault();
	e.stopPropagation();
}
