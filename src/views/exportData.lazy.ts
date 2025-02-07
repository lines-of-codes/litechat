import type { Component } from "mithril";
import m from "mithril";
import pb, { thisUserId } from "../pocketbase";
import type { ChatModel } from "../collections/chats";
import type { UserModel } from "../collections/users";
import type { MessageModel } from "../collections/messages";
import {
	decryptMessage,
	generateChatName,
	getSymmetricKey,
	ivFromJson,
} from "../utils/chatUtils";
import {
	ASYMMETRIC_KEY_ALG,
	ASYMMETRIC_KEY_HASH_ALG,
	SYMMETRIC_KEY_ALG,
} from "../crypto";
import { arrayBufferToBase64 } from "../utils/base64";
import { zipSync, strToU8, ZippableFile } from "fflate";

interface UserData {
	chats: ChatModel[];
	relatedPeople: UserModel[];
	messages: MessageModel[];
}

interface ExportResult {
	blob?: Blob;
	fileExt: string;
}

type StringMap = { [key: string]: string };

let hasEncryptionKeys = false;

async function processChatData(
	userData: UserData,
	users: { [id: string]: UserModel }
): Promise<{
	chatNames: StringMap;
	chatKeys: { [id: string]: CryptoKey };
	undecryptableChat: string[];
}> {
	let chatNames: StringMap = {};
	let chatKeys: { [id: string]: CryptoKey } = {};
	let undecryptableChat = [];

	for (const chat of userData.chats) {
		let name = chat.name;

		if (name === "") {
			const recipients = chat.members
				.map((memberId) => users[memberId])
				.filter((value) => value !== undefined);
			name = generateChatName(recipients, thisUserId);
		}

		chatNames[chat.id] = name;

		const symKey = await getSymmetricKey(thisUserId, chat.id);

		if (symKey === null) {
			undecryptableChat.push(`${chatNames[chat.id]} (ID: ${chat.id})`);
			continue;
		}

		chatKeys[chat.id] = symKey;
	}

	return {
		chatNames,
		chatKeys,
		undecryptableChat,
	};
}

async function exportJson(
	formData: FormData,
	userData: UserData
): Promise<ExportResult> {
	const simplified = formData.get("simplified") === "yes";
	const decrypt = formData.get("decrypted") === "yes";
	const hasRelatedPeople = formData.get("hasRelatedPeople");
	let keyFormat = formData.get("keyFormat");
	const progressBar = document.getElementById(
		"progressBar"
	) as HTMLProgressElement;
	const currentAction = document.getElementById(
		"currentAction"
	) as HTMLDivElement;
	let output: { [key: string]: any } = {
		options: {
			simplified,
			decrypt,
		},
	};
	let users: { [id: string]: UserModel } = {};
	let userNames: StringMap = {};

	currentAction.innerText = "Parsing and extracting data...";

	if (!hasEncryptionKeys) {
		keyFormat = "jwk";
	}

	for (const person of userData.relatedPeople) {
		users[person.id] = person;
		userNames[person.id] = `${person.name} (${person.id})`;
	}

	const chatData = await processChatData(userData, users);

	output.undecryptableChat = chatData.undecryptableChat;
	let chatNames = chatData.chatNames;
	let chatKeys = chatData.chatKeys;

	if (formData.get("hasMessages")) {
		currentAction.innerText = "Processing message data...";
		let messageData = userData.messages;
		output.messages = [];

		progressBar.max = messageData.length;
		progressBar.value = 0;
		for (const message of messageData) {
			progressBar.value++;
			let processedMessage: { [key: string]: any } = {
				attachments: [],
				created: message.created,
				updated: message.updated,
			};

			if (simplified) {
				for (const attachment in message.attachments) {
					processedMessage.attachments.push(
						pb.files.getURL(message, attachment)
					);
				}
				processedMessage.chat = chatNames[message.chat];
				processedMessage.sender = userNames[message.sender];
			} else {
				processedMessage.attachments = message.attachments;
				processedMessage.chat = message.chat;
				processedMessage.sender = message.sender;
			}

			if (decrypt) {
				processedMessage.content = await decryptMessage(
					message.content,
					ivFromJson(message.iv),
					chatKeys[message.chat]
				);
			} else {
				processedMessage.content = message.content;
				processedMessage.iv = message.iv;
			}

			output.messages.push(processedMessage);
		}
		progressBar.removeAttribute("value");
	}

	if (formData.get("hasChatList")) {
		currentAction.innerText = "Processing chat list...";
		output.chats = [];

		progressBar.max = userData.chats.length;
		progressBar.value = 0;
		for (const chat of userData.chats) {
			progressBar.value++;
			let processedChat: { [key: string]: any } = {
				id: chat.id,
				created: chat.created,
				updated: chat.updated,
				name: chat.name,
				photo: chat.photo,
				theme: chat.theme,
				members: chat.members,
			};

			if (simplified) {
				processedChat.photo = pb.files.getURL(chat, chat.photo);
				processedChat.members = [];

				for (const member of chat.members) {
					processedChat.members.push(userNames[member]);
				}
			}
		}
		progressBar.removeAttribute("value");
	}

	if (hasEncryptionKeys) {
		currentAction.innerText = "Exporting encryption keys...";
		const storageLength = localStorage.length;
		output.encryptionKeys = {};

		progressBar.max = storageLength;
		for (let i = 0; i < storageLength; i++) {
			progressBar.value = i;
			const key = localStorage.key(i);
			const value = localStorage.getItem(key ?? "");

			if (
				(!key?.startsWith("chat_") && key !== "privateKey") ||
				value === null
			)
				continue;

			if (key === "privateKey") {
				if (keyFormat === "notJwk") {
					const importedKey = await crypto.subtle.importKey(
						"jwk",
						JSON.parse(value),
						{
							name: ASYMMETRIC_KEY_ALG,
							hash: ASYMMETRIC_KEY_HASH_ALG,
						} as RsaHashedImportParams,
						true,
						["decrypt"]
					);
					output.encryptionKeys["privateKey.pem"] = strToU8(
						"-----BEGIN PRIVATE KEY-----\n".concat(
							arrayBufferToBase64(
								await crypto.subtle.exportKey(
									"pkcs8",
									importedKey
								)
							),
							"\n-----END PRIVATE KEY-----"
						)
					);
				} else {
					output.encryptionKeys["privateKey"] = value;
				}

				continue;
			}

			if (keyFormat === "notJwk") {
				const importedKey = await crypto.subtle.importKey(
					"jwk",
					JSON.parse(value),
					{ name: SYMMETRIC_KEY_ALG, length: 256 } as AesKeyAlgorithm,
					true,
					["encrypt", "decrypt"]
				);
				output.encryptionKeys[`${key}.pem`] = strToU8(
					"-----BEGIN SECRET KEY-----\n".concat(
						arrayBufferToBase64(
							await crypto.subtle.exportKey("raw", importedKey)
						),
						"\n-----END SECRET KEY-----"
					)
				);
			} else {
				output.encryptionKeys[key] = value;
			}
		}
		progressBar.removeAttribute("value");
	}

	if (hasRelatedPeople) {
		currentAction.innerText = "Processing related people information...";
		output.relatedPeople = await Promise.all(
			userData.relatedPeople.map(async (user) => {
				let processed: { [key: string]: any } = {
					avatar: user.avatar,
					id: user.id,
					name: user.name,
					created: user.created,
					updated: user.updated,
				};

				if (simplified) {
					processed.avatar = pb.files.getURL(user, user.avatar);
				}

				if (hasEncryptionKeys) {
					switch (keyFormat) {
						case "jwk":
							output.encryptionKeys[`user_${user.id}`] =
								user.publicKey;
							break;
						case "notJwk":
							const userPubKey = await crypto.subtle.importKey(
								"jwk",
								JSON.parse(user.publicKey),
								{
									name: ASYMMETRIC_KEY_ALG,
									hash: ASYMMETRIC_KEY_HASH_ALG,
								} as RsaHashedImportParams,
								true,
								["encrypt"]
							);
							output.encryptionKeys[`user_${user.id}.pem`] =
								strToU8(
									"-----BEGIN PUBLIC KEY-----\n".concat(
										arrayBufferToBase64(
											await crypto.subtle.exportKey(
												"spki",
												userPubKey
											)
										),
										"\n-----END PUBLIC KEY-----"
									)
								);
							break;
					}
				}

				return processed;
			})
		);
	}

	let blob: Blob | undefined;
	let fileExt = "json";

	switch (keyFormat) {
		case "jwk":
			let stringified = JSON.stringify(output);
			blob = new Blob([stringified]);
			break;
		case "notJwk":
			let files: { [name: string]: ZippableFile } = output.encryptionKeys;

			delete output.encryptionKeys;
			files["data.json"] = strToU8(JSON.stringify(output));

			blob = new Blob([zipSync(files)]);
			fileExt = "zip";
			break;
	}

	return {
		blob,
		fileExt,
	};
}

// TODO: Implement Markdown export
async function exportMarkdown(
	formData: FormData,
	userData: UserData
): Promise<ExportResult> {
	return {
		blob: new Blob(),
		fileExt: "md",
	};
}

// TODO: Implement plain text export
async function exportPlainText(
	formData: FormData,
	userData: UserData
): Promise<ExportResult> {
	return {
		blob: new Blob(),
		fileExt: "md",
	};
}

async function exportData(formData: FormData) {
	const progressDialog = document.getElementById(
		"progressDialog"
	) as HTMLDialogElement;
	const currentAction = document.getElementById("currentAction");
	const format = formData.get("format");

	progressDialog.showModal();

	try {
		if (currentAction !== null) {
			currentAction.innerText = "Fetching your data on the server...";
		}

		let userData = await pb.send(
			`/api/litechat/users/export/${thisUserId}`,
			{}
		);

		let result: ExportResult | undefined;

		switch (format) {
			case "json":
				result = await exportJson(formData, userData);
				break;
			case "markdown":
				result = await exportMarkdown(formData, userData);
				break;
			case "log":
				result = await exportPlainText(formData, userData);
				break;
		}

		if (result === undefined) throw "Export result is empty.";

		let element = document.createElement("a");

		if (result.blob === undefined) {
			throw "Result file is empty.";
		}

		let urlBlob = URL.createObjectURL(result.blob);
		let date = new Date();

		element.setAttribute("href", urlBlob);
		element.setAttribute(
			"download",
			`litechat_data_export_${date
				.getUTCDate()
				.toString()
				.padStart(2, "0")}${date
				.getUTCMonth()
				.toString()
				.padStart(2, "0")}${date.getUTCFullYear()}.${result.fileExt}`
		);
		element.style.display = "none";

		document.body.appendChild(element);
		element.click();
		document.body.removeChild(element);

		URL.revokeObjectURL(urlBlob);
	} catch (err) {
		alert(
			`An unknown error occurred while processing your request. (${err})`
		);
		return;
	}

	progressDialog.close();
}

const ExportDataPage = {
	view() {
		return m("#pagecontainer.flex.flex-col.gap-2.h-90vh", [
			m("dialog#progressDialog", [
				m("p", [
					"This will either take a long long time or be lightning fast depending on the selected options ",
					"and how much data you have. Please do not close this page until the data export is complete.",
				]),
				m("progress#progressBar.w-full.rounded.mt-4"),
				m("#currentAction"),
			]),
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

						const formData = new FormData(
							e.target as HTMLFormElement
						);
						exportData(formData);
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
								"input[type=checkbox][name=hasEncryptionKeys]#hasEncryptionKeys",
								{
									oninput(e: InputEvent) {
										hasEncryptionKeys = (
											e.target as HTMLInputElement
										).checked;
									},
								}
							),
							m(
								"label[for=hasEncryptionKeys]",
								" Encryption Keys"
							),
						]),
					]),
					hasEncryptionKeys
						? m("fieldset.flex.flex-col#encryptionKeyFormat", [
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
										" This will also cause the output to be downloaded as a `.zip` file rather than a `.json` file.",
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
										m.trust(
											`<i class="bi bi-info-circle"></i>`
										)
									),
								]),
						  ])
						: null,
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
