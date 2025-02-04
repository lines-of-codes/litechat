import type { Component } from "mithril";
import m from "mithril";

function exportData() {}

const ExportDataPage = {
	view() {
		return m("#pagecontainer.flex.flex-col.gap-2.h-90vh", [
			m("header.flex.gap-2", { style: "height: auto;" }, [
				m(
					"a.cleanlink.iconbutton.md",
					{
						href: `#!/manageAccount`,
					},
					m.trust(`<i class="bi bi-chevron-left"></i>`)
				),
				m(".flex.gap-2.items-center#chatHeader", [
					m("span", "Export Data"),
				]),
			]),
			m(
				"form[action=].flex.flex-wrap.gap-2",
				{
					onsubmit(e: SubmitEvent) {
						e.preventDefault();

						if (
							confirm(
								"Please make sure you have selected the correct options. You can only export your data once per 12 hours. Would you like to check your selections again?"
							)
						) {
							return;
						}

						console.log("Submit event fired!");
						const formData = new FormData(
							e.target as HTMLFormElement
						);
						console.log(formData);
					},
				},
				[
					m("fieldset.flex.flex-col#format", [
						m("legend", "Export format"),
						m("div", [
							m(
								"input[type=radio][checked][name=format][value=json]#json"
							),
							m("label[for=json]", " JSON"),
						]),
						m("div", [
							m(
								"input[type=radio][name=format][value=markdown]#markdown"
							),
							m("label[for=markdown]", " Markdown"),
						]),
						m("div", [
							m("input[type=radio][name=format][value=log]#log"),
							m("label[for=log]", " Plain Text"),
						]),
					]),
					m("fieldset.flex.flex-col#includes", [
						m("legend", "Included data"),
						m("div", [
							m(
								"input[type=checkbox][checked][name=hasMessages]#hasMessages"
							),
							m("label[for=hasMessages]", " Messages"),
						]),
						m("div", [
							m(
								"input[type=checkbox][checked][name=hasChatList]#hasChatList"
							),
							m("label[for=hasChatList]", " Chat List"),
						]),
						m("div", [
							m(
								"input[type=checkbox][name=hasRelatedPeople]#hasRelatedPeople"
							),
							m(
								"label[for=hasRelatedPeople]",
								" Related People Information"
							),
						]),
						m("div", [
							m(
								"input[type=checkbox][name=hasEncryptionKeys]#hasEncryptionKeys"
							),
							m(
								"label[for=hasEncryptionKeys]",
								" Encryption Keys"
							),
						]),
					]),
					m("fieldset.flex.flex-col#encryptionKeyFormat", [
						m("legend", "Encryption Keys Format"),
						m("div", [
							m(
								"input[type=radio][checked][name=keyFormat][value=jwk]#jwkKey"
							),
							m("label[for=jwk]", " JWK"),
						]),
						m("dialog#notJwkHelp", [
							m("p", [
								`Export AES keys in `,
								m(
									"a",
									{
										href: "https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#raw",
										target: "blank",
										rel: "noopener noreferrer",
									},
									"Raw format"
								),
								`, Export public keys of related people in the `,
								m(
									"a",
									{
										href: "https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#subjectpublickeyinfo",
										target: "blank",
										rel: "noopener noreferrer",
									},
									"SubjectPublicKeyInfo"
								),
								` format, Export your own private key in the `,
								m(
									"a",
									{
										href: "https://en.wikipedia.org/wiki/PKCS_8",
										target: "blank",
										rel: "noopener noreferrer",
									},
									"PKCS#8"
								),
								` format and save all of them in `,
								m(
									"a",
									{
										href: "https://en.wikipedia.org/wiki/Privacy-Enhanced_Mail",
										target: "blank",
										rel: "noopener noreferrer",
									},
									"the PEM format."
								),
							]),
							m("br"),
							m(
								"button.button[type=button]",
								{
									onclick() {
										(
											document.getElementById(
												"notJwkHelp"
											) as HTMLDialogElement
										).close();
									},
								},
								"Close"
							),
						]),
						m("div", [
							m(
								"input[type=radio][name=keyFormat][value=notJwk]#notJwkKey"
							),
							m("label[for=notJwkKey]", " PEM format "),
							m(
								"button",
								{
									type: "button",
									onclick() {
										(
											document.getElementById(
												"notJwkHelp"
											) as HTMLDialogElement
										).showModal();
									},
								},
								m.trust(`<i class="bi bi-info-circle"></i>`)
							),
						]),
					]),
					m("fieldset.flex.flex-col#simplified", [
						m("legend", "Simplified?"),
						m("div", [
							m(
								"input[type=radio][checked][name=simplified][value=yes]#doSimplify"
							),
							m("label[for=doSimplify]", " Yes"),
						]),
						m("div", [
							m(
								"input[type=radio][name=simplified][value=no]#dontSimplify"
							),
							m("label[for=dontSimplify]", " No"),
						]),
					]),
					m("fieldset.flex.flex-col#decrypted", [
						m("legend", "Decrypt?"),
						m("div", [
							m(
								"input[type=radio][checked][name=decrypted][value=yes]#doDecrypt"
							),
							m("label[for=doDecrypt]", " Yes"),
						]),
						m("div", [
							m(
								"input[type=radio][name=decrypted][value=no]#dontDecrypt"
							),
							m("label[for=dontDecrypt]", " No"),
						]),
					]),
					m("fieldset", [
						m("legend", "Export!"),
						m("button[type=submit].button", [
							m.trust(
								`<i class="bi bi-rocket-takeoff-fill"></i>`
							),
							" Export",
						]),
					]),
				]
			),
		]);
	},
} as Component;

export default ExportDataPage;
