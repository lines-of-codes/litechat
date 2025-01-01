import type { Component } from "mithril";
import m from "mithril";
import { getKey } from "../crypto";

let key = "";
let activeTab: "text" | "file" = "text";
let chosenFile: File | undefined;
let chosenFileName: string = "";

const ImportKeyPage = {
	view() {
		const textImport = [
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
				"Import from text field"
			),
		];

		const fileImport = [
			m("div.flex.flex-col.gap-1", [
				m("label[for='keyFile'].button.text-center", "Pick File"),
				chosenFileName === "" ? null : m("pre", chosenFileName),
			]),
			m("input#keyFile", {
				type: "file",
				accept: ".json",
				onchange(e: Event) {
					let input = e.target as HTMLInputElement;

					if (input.files === null || input.files[0] === null) return;

					chosenFile = input.files[0];
					chosenFileName = input.files[0].name;
				},
			}),
			m(
				"button.button",
				{
					onclick() {
						if (chosenFile === undefined) return;

						const reader = new FileReader();

						reader.onload = async () => {
							key = reader.result as string;
							localStorage.setItem("privateKey", key);
							try {
								await getKey();
								window.location.href = "#!/chat";
							} catch (e) {
								alert(e);
							}
						};

						reader.readAsText(chosenFile);
					},
				},
				"Import"
			),
		];

		return m("main#pagecontainer.flex-center.flex-col.gap-4", [
			m("div.flex.items-center.flex-col.gap-2", [
				m("div.secondary", "Import from..."),
				m("div.flex.gap-2", [
					m(
						"button.button",
						{
							class: activeTab === "text" ? "active" : undefined,
							onclick() {
								activeTab = "text";
							},
						},
						"Text"
					),
					m(
						"button.button",
						{
							class: activeTab === "file" ? "active" : undefined,
							onclick() {
								activeTab = "file";
							},
						},
						"File"
					),
				]),
			]),
			activeTab === "text" ? textImport : fileImport,
		]);
	},
} as Component;

export default ImportKeyPage;
