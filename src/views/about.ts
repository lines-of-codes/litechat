import m from "mithril";
import type { Component } from "mithril";

const AboutPage = {
	view: () => {
		return m("[", [
			m("header#pageheader", [
				m(
					"h1",
					{
						style: "margin-bottom: 8px;",
					},
					"About"
				),
			]),
			m("main#pagecontainer.flex.flex-col.gap-4", [
				m(
					"div",
					{
						style: "margin-bottom: 15px;",
					},
					[
						m(
							"a.button",
							{
								href: "#!/chat",
							},
							"← Back to home"
						),
					]
				),
				m(
					"p",
					`litechat is a chat application designed to be lightweight, fast, and secure. Open-source under the GPLv3 license.`
				),
				m("div", [
					m("strong", "Notification sound"),
					m("div", [
						m.trust(
							`<a href="https://freesound.org/people/FoolBoyMedia/sounds/352651/">Piano Notification 3</a> by <a href="https://freesound.org/people/FoolBoyMedia/">FoolBoyMedia</a><br/>
                            License: <a href="https://creativecommons.org/licenses/by-nc/4.0/">Attribution NonCommercial 4.0</a><br/>
                            Original in .mp3 format, converted to .flac`
						),
					]),
				]),
				m("div", [
					m("strong", "Icons sourced from"),
					m(
						"div",
						"Lineicons Free (MIT license) & Bootstrap Icons (MIT license)"
					),
				]),
				m("div", [
					m("strong", "Tools & Libraries"),
					m("ul", [
						m("li", [
							m(
								"a",
								{
									href: "https://pocketbase.io/",
									target: "_blank",
									rel: "noopener noreferrer",
								},
								"PocketBase (MIT license)"
							),
						]),
						m("li", [
							m(
								"a",
								{
									href: "https://mithril.js.org/",
									target: "_blank",
									rel: "noopener noreferrer",
								},
								"Mithril.js (MIT license)"
							),
						]),
						m("li", [
							m(
								"a",
								{
									href: "https://vite.dev/",
									target: "_blank",
									rel: "noopener noreferrer",
								},
								"Vite (MIT license)"
							),
						]),
						m("li", [
							m(
								"a",
								{
									href: "https://www.typescriptlang.org/",
									target: "_blank",
									rel: "noopener noreferrer",
								},
								"TypeScript (Apache-2.0 license)"
							),
						]),
					]),
				]),
			]),
		]);
	},
} as Component;

export default AboutPage;