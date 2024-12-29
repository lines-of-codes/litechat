import type { Component } from "mithril";
import m from "mithril";
import { getKey } from "../crypto";

let key = "";

const ImportKeyPage = {
	view() {
		return m("main#pagecontainer.flex-center.flex-col.gap-4", [
			m("input#privateKey", {
				type: "text",
				placeholder: "Enter private key...",
				onchange(event: InputEvent) {
					let newKey = (event.target as HTMLInputElement).value;
					key = newKey;
				},
			}),
			m(
				"button.button",
				{
					async onclick() {
						localStorage.setItem("privateKey", key);
						try {
							await getKey();
							window.location.href = "#!/chat";
						} catch (e) {
							alert(e);
						}
					},
				},
				"Import"
			),
		]);
	},
} as Component;

export default ImportKeyPage;
