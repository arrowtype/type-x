export interface Axis {
	id: string;
	name: string;
	min: number;
	max: number;
	value: number;
}
export interface FontkitAxis {
	name: string;
	min: number;
	default: number;
	max: number;
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
	activeinstance: string;
	axes: Record<string, Axis>;
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
	activeinstance: string;
	axes: Record<string, Axis>;
	new: boolean;
	constructor(
		id: string,
		name: string,
		file: string,
		fallback: string,
		selectors: string[],
		css: string,
		inherit: boolean,
		activeinstance: string,
		axes: Record<string, Axis>,
		isNew: boolean
	) {
		this.id = id;
		this.name = name;
		this.file = file;
		this.fallback = fallback;
		this.selectors = selectors;
		this.css = css;
		this.inherit = inherit;
		this.activeinstance = activeinstance;
		this.axes = axes;
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
			obj.activeinstance,
			obj.axes,
			obj.new
		);
	}
}

export class FontFile {
	file: string;
	name: string;
	axes: Record<string, Axis>;
	instances: Record<string, Location>;
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
	}
	static fromObject(obj: any): FontFile {
		return new FontFile(obj.file, obj.name, obj.axes, obj.instances);
	}
}
