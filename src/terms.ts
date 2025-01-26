import { marked } from "marked";
import { Component } from "mithril";
import m from "mithril";

const Terms = {
	content: "",
	async oninit(vnode) {
		const res = await fetch("/tos.md");
		vnode.state.content = await marked.parse(await res.text());
		m.redraw();
	},
	view() {
		return m("#pagecontainer", [
			m("header", [
				m(
					"p",
					`These terms are originally written in Markdown. Below is the rendered HTML version of it.`
				),
				m(
					"a",
					{
						href: "/tos.md",
					},
					"Raw Markdown version"
				),
			]),
			m.trust(this.content),
		]);
	},
} as Component<
	{},
	{
		content: string;
	}
>;

m.mount(document.body, Terms);
