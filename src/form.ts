import { Axis, Font, FontFile, FontkitAxis, IFont, Location } from "./font.js";
import { callTypeX } from "./popup.js";
import { create } from "fontkit";
import type { Font as FontkitFont } from "fontkit";

const localFonts: Record<string, string> = {};

// Get current fonts from storage and show them in the popup
chrome.fontSettings.getFontList(fonts => {
	for (const font of fonts) {
		localFonts[font.displayName] = font.fontId;
	}
	buildForm();
});

// Generate form based on current settings
export async function buildForm() {
	let { fonts, files, blacklist } = await chrome.storage.local.get([
		"fonts",
		"files",
		"blacklist"
	]);

	const form = document.querySelector("#fontsForm");
	const usedFonts = form.querySelector("#usedFonts");
	const blacklistEl = form.querySelector("[name=blacklist]") as HTMLInputElement;

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
function updateFontDropdowns(id: string, name: string) {
	const optgroups = document.querySelectorAll(
		".font-file-select optgroup:first-child"
	) as NodeListOf<HTMLOptGroupElement>;
	optgroups.forEach(optgroup => {
		const options = optgroup.querySelectorAll("option");
		let present = false;
		options.forEach(option => {
			present = option.value === name ? true : present;
		});
		if (present) {
			optgroup.label = name;
		} else {
			const option = document.createElement("option");
			option.value = id;
			option.text = name;
			optgroup.append(option);
		}
	})
}

// Add new font to the form
export function addFormElement(font: Font, files: Record<string, FontFile>) {
	const usedFonts = document.querySelector("#usedFonts");
	const template: HTMLTemplateElement = document.querySelector("#newFont");
	const el = document.importNode(template.content, true);
	const parentEl: HTMLFieldSetElement = el.querySelector(".font");

	el.querySelector<HTMLSpanElement>(".font-name-title").innerText =
		font.name || "New font override";

	const fontSelect = el.querySelector(".font-file-select");

	const dropdown = document.createElement("select") as HTMLSelectElement;
	dropdown.setAttribute("name", "file");
	dropdown.setAttribute("id", `file${font.id}`);
	dropdown.classList.add("font-file-select");
	dropdown.onchange = e => {
		let target = e.target as HTMLSelectElement;
		const parent: HTMLFieldSetElement = target.closest(".font");
		const name = target.options[target.selectedIndex].text;
		const fileId = target.options[target.selectedIndex].value;
		addVariableSliders({}, parent);
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
		parent.querySelector<HTMLSpanElement>(".font-name-title").innerText = name;
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

	const newFileInput: HTMLInputElement = el.querySelector("[name=newfile]");
	newFileInput.dataset.fontid = font.id;
	newFileInput.onchange = grabFont;

	parentEl.dataset.fontid = font.id;
	el.querySelector<HTMLInputElement>("[name=id]").value = font.id;
	el.querySelector<HTMLTextAreaElement>("[name=css]").value = font.css;
	el.querySelector<HTMLTextAreaElement>("[name=fallback]").value = font.fallback;
	el.querySelector<HTMLTextAreaElement>("[name=selectors]").value = font.selectors.join(", ");

	el.querySelector<HTMLButtonElement>(".show-fallbacks").onclick = e => {
		(e.target as HTMLButtonElement).closest("fieldset").classList.toggle("show-font-fallbacks");
	};

	el.querySelector<HTMLButtonElement>(".delete-font").onclick = e => {
		(e.target as HTMLButtonElement).closest("fieldset").remove();
		saveForm();
	};

	el.querySelector<HTMLButtonElement>(".font-title button").onclick = e => {
		(e.target as HTMLButtonElement).closest("fieldset").classList.toggle("show-font-details");
	};

	if (font.new) {
		el.querySelector("fieldset").classList.add("show-font-details");
	}

	// Add variable sliders
	let axes = {};
	if (font.axes) {
		axes = font.axes;
	} else if (font.file in files) {
		axes = files[font.file].axes;
	}
	addVariableSliders(axes, parentEl);

	// Add named variable instances
	let instances = {};
	if (font.file in files) {
		instances = files[font.file].instances || {};
	}
	addNamedInstances(instances, parentEl);

	// Select the named instance, if in use
	const instanceDropdown: HTMLSelectElement | null = el.querySelector(".select-instance");
	if (instanceDropdown) {
		instanceDropdown.value = font.activeinstance;
		el.querySelector<HTMLSpanElement>(".font-name-instance").innerText = font.activeinstance;
	}

	parentEl.addEventListener("dragover", highlight, false);
	parentEl.addEventListener("dragleave", unhighlight, false);
	parentEl.addEventListener("drop", grabFont, false);

	const textareas = el.querySelectorAll("textarea");
	textareas.forEach(textarea => {
		textarea.oninput = saveForm;
	});

	usedFonts.prepend(el);
}

// Select named instance based on slider values
function syncVariableValues() {
	const containers: NodeListOf<HTMLFieldSetElement> = document.querySelectorAll(".font");
	containers.forEach(container => {
		const sliders: NodeListOf<HTMLInputElement> = container.querySelectorAll(
			".variable-sliders [type=range]"
		);

		if (!sliders.length) return;

		const customInstance: Location = {};
		sliders.forEach(slider => {
			const name = slider.name.replace("var-", "");
			customInstance[name] = parseFloat(slider.value);
		});
		const ci = JSON.stringify(customInstance);

		const dropdown = container.querySelector<HTMLSelectElement>(".select-instance");
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
		options.forEach(option => {
			if (option.dataset.instance == ci) {
				sel = option.index;
				return;
			}
		});
		dropdown.selectedIndex = sel;
	})
}

/**
 * Add named instances to the font editor.
 */
function addNamedInstances(instances: Record<string, Location>, el: HTMLElement) {
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
			const orderedAxes: Location = {};
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

function applyNamedInstance(e: Event) {
	const sel = e.target as HTMLSelectElement;
	const parent = sel.closest(".font");

	const instanceName = sel.value == "--inherit--" ? "" : sel.value;
	parent.querySelector<HTMLSpanElement>(".font-name-instance").innerText = instanceName;

	if (sel.value == "--inherit--" || sel.value == "--axes--") {
		saveForm();
		return;
	}

	const axes = JSON.parse(sel.options[sel.selectedIndex].dataset.instance);

	for (const axis in axes) {
		const slider = parent.querySelector(`[name=var-${axis}]`) as HTMLInputElement;
		slider.value = axes[axis];
	}

	saveForm();
}

function addVariableSliders(axes: Record<string, FontkitAxis|Axis>, el: HTMLElement) {
	const newAxes: Record<string, Axis> = {};
	el.querySelector(".variable-sliders").innerHTML = "";
	if (!axes) {
		el.querySelector(".variable-sliders-container").classList.remove(
			"show"
		);
	} else {
		const keys = Object.keys(axes).sort();
		for (let i = 0; i < keys.length; ++i) {
			let inputAxis = axes[keys[i]];
			const value = "default" in inputAxis
				? inputAxis.default
				: inputAxis.value || 0;
			const axis: Axis = {
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

type StraightInput = "id" | "css" | "fallback";
function isStraightInput(input: string): input is StraightInput {
	return ["id", "css", "fallback"].includes(input);
}

// Store changes made to fonts
// Note: files have already been stored at this point
export function saveForm() {
	const newFonts: IFont[] = [];
	const form = document.querySelector("#fontsForm");
	const fieldsets: NodeListOf<HTMLFieldSetElement> = form.querySelectorAll("fieldset");

	// Get new fonts
	fieldsets.forEach(fieldset => {
		const newFont: IFont = {
			axes: {},
		} as IFont;
		const inputs: NodeListOf<HTMLInputElement> = fieldset.querySelectorAll("*[name]");

		inputs.forEach(input => {
			if (input.name === "file" && input instanceof HTMLSelectElement) {
				newFont["name"] = input.options[input.selectedIndex].text;
				newFont["file"] = input.options[input.selectedIndex].value;
			} else if (input.name === "select-instance") {
				if (input.value === "--inherit--") {
					newFont["inherit"] = true;
				} else {
					newFont["activeinstance"] = input.value;
				}
			} else if (isStraightInput(input.name)) {
				newFont[input.name] = input.value;
			} else if (input.name.startsWith("var-")) {
				const name = input.name.replace("var-", "");
				const axis = {
					id: name,
					name: input.dataset.name,
					min: parseInt(input.min, 10),
					max: parseInt(input.max, 10),
					value: parseInt(input.value, 10)
				};
				newFont.axes[name] = axis;
			} else if (input.name === "selectors") {
				// Selectors should become an array
				newFont["selectors"] = input.value
					.split(",")
					.map(i => i.trim());
			}
		});

		newFonts.unshift(newFont);
	});

	// Get blacklist
	const blacklist = form
		.querySelector<HTMLInputElement>("[name=blacklist]")
		.value.split(",")
		.map(i => i.trim());

	// Apply new fonts and activate extension
	chrome.storage.local.set(
		{
			fonts: newFonts,
			blacklist: blacklist
		},
		async () => {
			await chrome.storage.local.set({
				extensionActive: true
			});
			callTypeX();
		}
	);

	syncVariableValues();
}

// Keep track of file data, and hook up to rest
// of form data on submit
function grabFont(e: DragEvent) {
	const files = e.dataTransfer.files;
	const file = files[0]; // Only use first file if multiple are dropped
	const name = file.name;
	const parent = (e.target as HTMLElement).closest("fieldset");
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
					parent.querySelector<HTMLSpanElement>(".font-name-title").innerText = name;
					// Update dropdown
					updateFontDropdowns(name, name);
					const dropdown: HTMLSelectElement = document.querySelector(`#file${fontId}`);
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
function grabVariableData(file: File, parent: HTMLElement) {
	parent
		.querySelector(".variable-sliders-container")
		.classList.remove("show");
	let bufferPromise = file.arrayBuffer();

	let font = false;
	return bufferPromise.then(buffer => {
		try {
			let font = create(Buffer.from(buffer)) as FontkitFont;
			// @ts-ignore // Types are not updated for this version of Fontkit
			let instances: Record<string, Location> = font.namedVariations;

			const axes = addVariableSliders(font.variationAxes, parent);
			addNamedInstances(instances, parent);

			chrome.storage.local.get("files", ({ files }: { files: Record<string, FontFile> }) => {
				files[file.name].axes = axes;
				files[file.name].instances = instances;

				chrome.storage.local.set({
					files: files
				});
			});
		} catch (e) {
			console.log("Failed to parse font.");
		}
	});
}

function addSlider(axis: Axis, parent: HTMLElement) {
	const variableSliders = parent.querySelector(".variable-sliders");
	const template: HTMLTemplateElement = document.querySelector("#variableSlider");
	const el = document.importNode(template.content, true);

	const input: HTMLInputElement = el.querySelector("input");
	const label: HTMLLabelElement = el.querySelector("label");
	const value: HTMLSpanElement = el.querySelector(".slider-value");

	label.innerText = axis.name;

	input.name = `var-${axis.id}`;
	input.min = axis.min.toString();
	input.max = axis.max.toString();
	input.value = axis.value.toString();
	input.dataset.name = axis.name;
	value.innerText = axis.value.toString();

	input.onchange = e => {
		value.innerText = (e.target as HTMLInputElement).value;
		// Move dropdown away from "--inherit--" option to ensure
		// axes/dropdown are synced properly
		parent.querySelector<HTMLSelectElement>(".select-instance").value = "--axes--";
		saveForm();
	};

	variableSliders.append(el);
}

function highlight(e: Event) {
	this.classList.add("highlight");
	e.preventDefault();
	e.stopPropagation();
}

function unhighlight(e: Event) {
	this.classList.remove("highlight");
	e.preventDefault();
	e.stopPropagation();
}
