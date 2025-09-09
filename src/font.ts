import { create } from "fontkit";
import type { Font as FontkitFont } from "fontkit";

const randomId = () =>
	window.crypto.getRandomValues(new Uint32Array(2)).join("");

export interface Axis {
	id: string;
	name: string;
	min: number;
	max: number;
	default: number;
}

export type Location = Record<string, number>;
export interface IFont {
	id: string;
	name: string;
	file: string;
	fallback: string;
	selectors: string[];
	css: string;
	inherit: boolean;
	location: Location;
	new: boolean;
}

export class Font {
	id: string;
	name: string;
	file: string;
	fallback: string;
	selectors: string[];
	css: string;
	inherit: boolean;
	location: Location;
	new: boolean;

	constructor(
		id: string,
		name: string,
		file: string,
		fallback: string,
		selectors: string[],
		css: string,
		inherit: boolean,
		location: Location,
		isNew: boolean
	) {
		this.id = id;
		this.name = name;
		this.file = file;
		this.fallback = fallback;
		this.selectors = selectors;
		this.css = css;
		this.inherit = inherit;
		this.location = location;
		this.new = isNew;
	}
	static fromObject(obj: any): Font {
		return new Font(
			obj.id,
			obj.name,
			obj.file,
			obj.fallback,
			obj.selectors,
			obj.css,
			obj.inherit,
			obj.location || {},
			obj.new
		);
	}

	static async fromFilename(filename: string): Promise<Font> {
		let files = await getFiles();
		const newFont = Font.fromObject({
			name: files[filename]?.name || filename,
			new: true,
			id: randomId(),
			file: filename,
			location: files[filename]?.defaultLocation || {},
			inherit: true,
			fallback: ["monospace"],
			selectors: ["/* Add CSS selectors here */"],
			css: "/* Additional styles to apply */"
		});

		return newFont;
	}

	async fontFile(): Promise<FontFile | null> {
		// XXX This is a hack until we restructure the storage
		let { files }: { files: Record<string, FontFile> } =
			await chrome.storage.local.get("files");
		return files[this.file] || null;
	}

	async activeInstance(): Promise<string | undefined> {
		let fontfile = await this.fontFile();
		if (!fontfile || Object.keys(fontfile.instances).length === 0) {
			return;
		}
		for (const [instanceName, instanceLoc] of Object.entries(
			fontfile.instances
		)) {
			let match = true;
			for (const [axisId, axisValue] of Object.entries(instanceLoc)) {
				if (
					!(axisId in this.location) ||
					this.location[axisId] !== axisValue
				) {
					match = false;
					break;
				}
			}
			if (match) {
				return instanceName;
			}
		}
	}

	async setInstance(name: string) {
		let fontfile = await this.fontFile();
		this.location = {};
		if (fontfile && name in fontfile.instances) {
			let instanceLocation = fontfile.instances[name];
			// Make a deep copy here so changes to sliders don't affect the instance
			// definitions in the FontFile object
			for (const [axisId, axisValue] of Object.entries(
				instanceLocation
			)) {
				this.location[axisId] = axisValue;
			}
		}
	}

	cssSelectorString(blacklistItems: string[]): string {
		let blacklist = blacklistItems.map(item => `:not(${item})`).join("");
		return this.selectors
			.map(
				selector =>
					`html:not([data-disablefont]) ${selector}${blacklist}`
			)
			.join(", ");
	}

	cssVariationSettings(): string {
		// Only inject variable axes when font has axes,
		// and we don't want to inherit page styles
		if (!this.location || this.inherit) {
			return "";
		}
		let settings = Object.entries(this.location)
			.map(([axisId, axisValue]) => `'${axisId}' ${axisValue}`)
			.join(",");
		if (settings) {
			return `font-variation-settings: ${settings};`;
		}
		return "";
	}
}

const lastLoaded: Record<string, number> = {};

export class FontFile {
	file: string;
	name: string;
	axes: Record<string, Axis>;
	instances: Record<string, Location>;
	handle: FileSystemFileHandle;

	constructor(
		file: string,
		name: string,
		axes: Record<string, Axis>,
		instances: Record<string, Location>
	) {
		this.file = file;
		this.name = name;
		this.axes = axes;
		this.instances = instances;
		this.handle = null;
	}
	static fromObject(obj: any): FontFile {
		return new FontFile(obj.file, obj.name, obj.axes, obj.instances);
	}

	loadVariableInfo(buffer: ArrayBuffer) {
		// Use Fontkit to parse the font data
		try {
			let fontkitFont = create(Buffer.from(buffer)) as FontkitFont;
			try {
				// @ts-ignore // Types are not updated for this version of Fontkit
				this.instances = fontkitFont.namedVariations;
			} catch (e) {
				console.warn("Failure to load named instances:", e);
			}
			// Convert fontkit's axes to our representation
			this.axes = {};
			try {
				for (const [tag, axis] of Object.entries(
					fontkitFont.variationAxes
				)) {
					this.axes[tag] = { ...axis, id: tag };
				}
			} catch (e) {
				console.warn("Failure to load variation axes:", e);
			}
		} catch (error) {
			console.error("Error parsing font:", error);
		}
	}

	setupReload(handle: FileSystemFileHandle, onReload?: () => void) {
		this.handle = handle;
		setInterval(this.compare.bind(this, onReload), 1000);
	}

	async compare(onReload?: () => void) {
		const file = await this.handle.getFile();

		if (
			!(this.file in lastLoaded) ||
			file.lastModified > lastLoaded[this.file]
		) {
			lastLoaded[this.file] = file.lastModified;
			onReload?.();
		}
	}

	get defaultLocation(): Location {
		return Object.fromEntries(
			Object.values(this.axes).map(axis => [axis.id, axis.default])
		);
	}
}

// Keep track of file data, and hook up to rest of form data on submit
export async function dropFont(
	e: DragEvent,
	fontReadyHook: (fontName: string) => void,
	reloadHook: () => void
): Promise<string | null> {
	e.preventDefault();
	e.stopPropagation();
	const items = e.dataTransfer.items;
	if (items.length == 0) {
		return null;
	}
	const item = items[0];
	let handle = (await item.getAsFileSystemHandle()) as FileSystemFileHandle;
	const file = await handle.getFile();
	return setupFont(file, handle, reloadHook, fontReadyHook);
}

export async function inputFont(
	e: Event,
	fontReadyHook: (fontName: string) => void
): Promise<string | null> {
	const input = e.target as HTMLInputElement;
	let files = input.files;
	if (files.length == 0) {
		return null;
	}
	return setupFont(files[0], null, null, fontReadyHook);
}

async function setupFont(
	file: File,
	handle: FileSystemFileHandle | null,
	reloadHook: () => void,
	fontReadyHook: (fontName: string) => void
): Promise<string | null> {
	const name = file.name;
	// Check if filetype is allowed
	const allowedExt = ["ttf", "otf", "eot", "woff", "woff2"];
	const ext = name.split(".").pop().toLowerCase();
	if (!allowedExt.includes(ext)) {
		return null;
	}

	const reader = new FileReader();
	reader.onload = async ({ target }) => {
		let fontfile = new FontFile(target.result as string, name, {}, {});
		fontfile.loadVariableInfo(await file.arrayBuffer());
		if (handle) {
			fontfile.setupReload(handle, reloadHook);
		}
		// Stick new file in storage
		let { files } = await chrome.storage.local.get("files");
		files[name] = fontfile;
		await chrome.storage.local.set({ files });
		fontReadyHook?.(name);
	};
	reader.readAsDataURL(file);
	return name;
}

// Things in the storage will be bare Javascript objects, so we need to
// rehydrate them into Font and FontFile instances
export async function getFonts(): Promise<Font[]> {
	let fontObjects: object[] = (await chrome.storage.local.get("fonts")).fonts;
	return fontObjects.map(obj => Font.fromObject(obj));
}
export async function getFiles(): Promise<Record<string, FontFile>> {
	let fileObjects: object = (await chrome.storage.local.get("files")).files;
	return Object.fromEntries(
		Object.entries(fileObjects).map(([k, v]) => [k, FontFile.fromObject(v)])
	);
}
