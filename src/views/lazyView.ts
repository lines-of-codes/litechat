import type { Component } from "mithril";
import m from "mithril";

const components: { [key: string]: Component } = {};

const LazyView = (file: string) =>
	({
		async oninit() {
			const mod = await import(`./${file}.lazy.ts`);
			components[file] = mod.default;
			m.redraw();
		},
		view() {
			return components[file] === undefined ? null : m(components[file]);
		},
	} as Component);

export default LazyView;
