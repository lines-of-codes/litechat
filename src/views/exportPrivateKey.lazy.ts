import type { Component } from "mithril";
import m from "mithril";
import { getKey } from "../crypto";

let privKey: CryptoKey;
let jwk: string;

const ExportKeyPage = {
	async oninit() {
		const key = await getKey();

		if (key === null) {
			alert("You do not have a private key. 😔");
			window.location.href = "#!/importPrivateKey";
			return;
		}

		privKey = key;
		jwk = JSON.stringify(await crypto.subtle.exportKey("jwk", privKey));
		m.redraw();
	},
	view() {
		return m("main#pagecontainer.flex-center.flex-col.gap-4", [
			m(
				"p.exclude-printing",
				"Reminder: NEVER share this with other people. Unless you want others to see your chat."
			),
			m("input#privateKey.exclude-printing", {
				readonly: true,
				type: "text",
				value: jwk,
			}),
			m(".flex.gap-2.exclude-printing", [
				m(
					"button.button",
					{
						async onclick() {
							await navigator.clipboard.writeText(jwk);
							alert("Copied!");
						},
					},
					"Copy"
				),
				m(
					"a.cleanlink.button",
					{
						href: `data:application/json;charset=utf-8,${encodeURIComponent(
							jwk
						)}`,
						download: "litechat_privatekey.json",
					},
					"Download"
				),
				m(
					"button.button",
					{
						onclick() {
							const dialog = document.getElementById(
								"printDialog"
							) as HTMLDialogElement;
							dialog.showModal();
							setTimeout(() => {
								print();
								dialog.close();
							}, 250);
						},
					},
					"Print"
				),
			]),
			m(
				"dialog#printDialog",
				{
					style: "height: 90%; width: 90%; overflow-wrap: break-word; word-break: break-all;",
				},
				[
					m(
						"p",
						{
							style: "font-weight: 700;text-align: center;",
						},
						"litechat RSA Private key. NEVER share this document, keep this confidential."
					),
					m(
						"div",
						{
							style: "font-size: 0.95em;",
						},
						jwk
					),
				]
			),
		]);
	},
} as Component;

export default ExportKeyPage;
