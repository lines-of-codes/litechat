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

interface ExportOptions {
	simplified: boolean;
	decrypted: boolean;
	hasMessages: FormDataEntryValue | null;
	hasChatList: FormDataEntryValue | null;
	hasRelatedPeople: FormDataEntryValue | null;
	hasEncryptionKeys: FormDataEntryValue | null;
	keyFormat: FormDataEntryValue | null;
}

interface ExportResult {
	blob?: Blob;
	fileExt: string;
}

type StringMap = { [key: string]: string };

let hasEncryptionKeys = false;
let exportFormat = "json";

function processUsers(userData: UserData): {
	users: { [id: string]: UserModel };
	userNames: StringMap;
} {
	let users: { [id: string]: UserModel } = {};
	let userNames: StringMap = {};

	for (const person of userData.relatedPeople) {
		users[person.id] = person;
		userNames[person.id] = `${person.name} (${person.id})`;
	}

	return {
		users,
		userNames,
	};
}

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
			undecryptableChat.push(`${chatNames[chat.id]} (${chat.id})`);
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
	options: ExportOptions,
	userData: UserData
): Promise<ExportResult> {
	const progressBar = document.getElementById(
		"progressBar"
	) as HTMLProgressElement;
	const currentAction = document.getElementById(
		"currentAction"
	) as HTMLDivElement;
	let output: { [key: string]: any } = {
		options: {
			simplified: options.simplified,
			decrypt: options.decrypted,
		},
	};

	currentAction.innerText = "Parsing and extracting data...";

	const userList = processUsers(userData);
	let users: { [id: string]: UserModel } = userList.users;
	let userNames: StringMap = userList.userNames;

	const chatData = await processChatData(userData, users);

	output.undecryptableChat = chatData.undecryptableChat;
	let chatNames = chatData.chatNames;
	let chatKeys = chatData.chatKeys;

	if (options.hasMessages) {
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

			if (options.simplified) {
				for (const attachment of message.attachments) {
					processedMessage.attachments.push(
						pb.files.getURL(message, attachment as string)
					);
				}
				processedMessage.chat = chatNames[message.chat];
				processedMessage.sender = userNames[message.sender];
			} else {
				processedMessage.attachments = message.attachments;
				processedMessage.chat = message.chat;
				processedMessage.sender = message.sender;
			}

			if (options.decrypted) {
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

	if (options.hasChatList) {
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

			if (options.simplified) {
				processedChat.photo = pb.files.getURL(chat, chat.photo);
				processedChat.members = [];

				for (const member of chat.members) {
					processedChat.members.push(userNames[member]);
				}
			}

			output.chats.push(processedChat);
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
				if (options.keyFormat === "notJwk") {
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

			if (options.keyFormat === "notJwk") {
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

	if (options.hasRelatedPeople) {
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

				if (options.simplified) {
					processed.avatar = pb.files.getURL(user, user.avatar);
				}

				if (hasEncryptionKeys) {
					switch (options.keyFormat) {
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

	switch (options.keyFormat) {
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

async function exportMarkdown(
	options: ExportOptions,
	userData: UserData
): Promise<ExportResult> {
	const progressBar = document.getElementById(
		"progressBar"
	) as HTMLProgressElement;
	const currentAction = document.getElementById(
		"currentAction"
	) as HTMLDivElement;
	const currentDate = new Date();
	let output = `# litechat Data Export ${currentDate.toISOString()}\n\n`;
	let encryptionKeys: { [id: string]: any } = {};

	const userList = processUsers(userData);
	const chatData = await processChatData(userData, userList.users);

	if (options.hasChatList) {
		output += "## Chat List\n\n";

		for (const chat of userData.chats) {
			output += `- ${chatData.chatNames[chat.id]} (${chat.id})\n`;
		}

		output += "\n\n";
	}

	if (options.hasRelatedPeople) {
		currentAction.innerText = "Processing related people data...";
		progressBar.max = userData.relatedPeople.length;
		progressBar.value = 0;

		output += "## Related People\n\n";

		const users = await Promise.all(
			userData.relatedPeople.map(async (user) => {
				let processed: { [key: string]: any } = {
					avatar: user.avatar,
					id: user.id,
					name: user.name,
					created: user.created.replaceAll(":", "\\:"),
					updated: user.updated.replaceAll(":", "\\:"),
				};

				if (options.simplified) {
					processed.avatar = pb.files.getURL(user, user.avatar);
				}

				if (options.hasEncryptionKeys) {
					switch (options.keyFormat) {
						case "jwk":
							encryptionKeys[`user_${user.id}`] = user.publicKey;
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
							encryptionKeys[`user_${user.id}.pem`] =
								"-----BEGIN PUBLIC KEY-----\n".concat(
									arrayBufferToBase64(
										await crypto.subtle.exportKey(
											"spki",
											userPubKey
										)
									),
									"\n-----END PUBLIC KEY-----"
								);
							break;
					}
				}

				progressBar.value++;

				return `- **Avatar:** ${processed.avatar}
- **ID:** ${processed.id}
- **Name:** ${processed.name}
- **Created:** ${processed.created}
- **Updated:** ${processed.updated}`;
			})
		);

		output += users.join("\n\n");
		output += "\n\n";

		progressBar.removeAttribute("value");
	}

	if (options.hasEncryptionKeys) {
		currentAction.innerText = "Processing encryption keys...";

		const storageLength = localStorage.length;

		for (let i = 0; i < storageLength; i++) {
			const key = localStorage.key(i);
			const value = localStorage.getItem(key ?? "");

			if (
				(!key?.startsWith("chat_") && key !== "privateKey") ||
				value === null
			)
				continue;

			if (key === "privateKey") {
				if (options.keyFormat === "notJwk") {
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
					encryptionKeys["privateKey.pem"] =
						"-----BEGIN PRIVATE KEY-----\n".concat(
							arrayBufferToBase64(
								await crypto.subtle.exportKey(
									"pkcs8",
									importedKey
								)
							),
							"\n-----END PRIVATE KEY-----"
						);
				} else {
					encryptionKeys["privateKey"] = value;
				}

				continue;
			}

			if (options.keyFormat === "notJwk") {
				const importedKey = await crypto.subtle.importKey(
					"jwk",
					JSON.parse(value),
					{ name: SYMMETRIC_KEY_ALG, length: 256 } as AesKeyAlgorithm,
					true,
					["encrypt", "decrypt"]
				);
				encryptionKeys[`${key}.pem`] =
					"-----BEGIN SECRET KEY-----\n".concat(
						arrayBufferToBase64(
							await crypto.subtle.exportKey("raw", importedKey)
						),
						"\n-----END SECRET KEY-----"
					);
			} else {
				encryptionKeys[key] = value;
			}
		}

		output += "## Encryption Keys\n\n";

		for (const key in encryptionKeys) {
			const value = encryptionKeys[key];

			output += `### ${key}\n\n\`\`\`\n`;
			output += value;
			output += "\n```\n\n";
		}
	}

	if (options.hasMessages) {
		currentAction.innerText = "Processing messages...";

		for (const chat of userData.chats) {
			currentAction.innerText = `Processing chat "${chat.name}"`;
			output += `## ${chatData.chatNames[chat.id]} (${chat.id})\n\n`;

			const messages = userData.messages
				.filter((msg) => msg.chat === chat.id)
				.sort(
					(a, b) =>
						new Date(a.created).getTime() -
						new Date(b.created).getTime()
				);
			progressBar.max = messages.length;
			progressBar.value = 0;

			for (const message of messages) {
				progressBar.value++;
				const decryptedMessage = await decryptMessage(
					message.content,
					ivFromJson(message.iv),
					chatData.chatKeys[chat.id]
				);
				let sender = message.sender;
				let editedOn = "";

				if (options.simplified) {
					sender = userList.userNames[message.sender];
				}

				if (message.updated != message.created) {
					editedOn = ` edited on ${message.updated.replaceAll(
						":",
						"\\:"
					)}`;
				}

				output += `**${sender}** (sent on ${message.created.replaceAll(
					":",
					"\\:"
				)}${editedOn}):\n`;
				output += decryptedMessage;
				output += "\n\n";
			}

			progressBar.removeAttribute("value");
		}
	}

	return {
		blob: new Blob([output]),
		fileExt: "md",
	};
}

async function exportPlainText(userData: UserData): Promise<ExportResult> {
	const progressBar = document.getElementById(
		"progressBar"
	) as HTMLProgressElement;
	const currentAction = document.getElementById(
		"currentAction"
	) as HTMLDivElement;
	const currentDate = new Date();
	let output = `litechat Data Export ${currentDate.toISOString()}\n`;

	const userList = processUsers(userData);
	const chatData = await processChatData(userData, userList.users);

	currentAction.innerText = "Processing messages...";

	for (const chat of userData.chats) {
		currentAction.innerText = `Processing chat "${chat.name}"`;
		output += `[chat] ${chatData.chatNames[chat.id]} (${chat.id})\n\n`;

		const messages = userData.messages
			.filter((msg) => msg.chat === chat.id)
			.sort(
				(a, b) =>
					new Date(a.created).getTime() -
					new Date(b.created).getTime()
			);
		progressBar.max = messages.length;
		progressBar.value = 0;

		for (const message of messages) {
			progressBar.value++;
			const decryptedMessage = await decryptMessage(
				message.content,
				ivFromJson(message.iv),
				chatData.chatKeys[chat.id]
			);
			let sender = userList.userNames[message.sender];
			let editedOn = "";

			if (message.updated != message.created) {
				editedOn = ` edited on ${message.updated}`;
			}

			output += `${sender} (sent on ${message.created}${editedOn}):\n`;
			output += "Attachments: ";
			output += message.attachments.map((v) =>
				pb.files.getURL(message, v as string)
			);
			output += decryptedMessage;
			output += "\n";
		}

		progressBar.removeAttribute("value");
	}

	return {
		blob: new Blob([output]),
		fileExt: "txt",
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

		let parsedOptions: ExportOptions = {
			simplified: formData.get("simplified") === "yes",
			decrypted: formData.get("decrypted") === "yes",
			keyFormat: formData.get("keyFormat"),
			hasMessages: formData.get("hasMessages"),
			hasChatList: formData.get("hasChatList"),
			hasRelatedPeople: formData.get("hasRelatedPeople"),
			hasEncryptionKeys: formData.get("hasEncryptionKeys"),
		};

		if (!parsedOptions.hasEncryptionKeys) {
			parsedOptions.keyFormat = "jwk";
		}

		let result: ExportResult | undefined;

		switch (format) {
			case "json":
				result = await exportJson(parsedOptions, userData);
				break;
			case "markdown":
				result = await exportMarkdown(parsedOptions, userData);
				break;
			case "log":
				result = await exportPlainText(userData);
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
					m("span", "Export Data (Beta)"),
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
								"input[type=radio][name=format][value=json]#json",
								{
									checked: exportFormat === "json",
									onchange(e: Event) {
										const target =
											e.target as HTMLInputElement;
										exportFormat = target.value;
									},
								}
							),
							m("label[for=json]", " JSON"),
						]),
						m("div", [
							m(
								"input[type=radio][name=format][value=markdown]#markdown",
								{
									onchange(e: Event) {
										const target =
											e.target as HTMLInputElement;
										exportFormat = target.value;
									},
								}
							),
							m("label[for=markdown]", " Markdown"),
						]),
						m("div", [
							m("input[type=radio][name=format][value=log]#log", {
								onchange(e: Event) {
									const target = e.target as HTMLInputElement;
									exportFormat = target.value;
								},
							}),
							m("label[for=log]", " Plain Text"),
						]),
					]),
					exportFormat !== "log"
						? m("fieldset.flex.flex-col#includes", [
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
						  ])
						: null,
					hasEncryptionKeys && exportFormat !== "log"
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
					exportFormat !== "log"
						? m("fieldset.flex.flex-col#simplified", [
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
						  ])
						: null,
					exportFormat === "json"
						? m("fieldset.flex.flex-col#decrypted", [
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
						  ])
						: null,
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
