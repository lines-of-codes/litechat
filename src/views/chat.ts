import m from "mithril";
import type { Component } from "mithril";
import NavBar from "../components/navbar";
import { ChatModel, chats } from "../collections/chats";
import { pbMithrilFetch } from "../utils/pbMithril";
import type { UserModel } from "../collections/users";
import pb, { thisUserId } from "../pocketbase";
import { base64ToArrayBuffer } from "../utils/base64";
import { SYMMETRIC_KEY_ALG } from "../crypto";
import { MessageModel, messages } from "../collections/messages";
import {
	ClientResponseError,
	ListResult,
	RecordSubscription,
} from "pocketbase";
import {
	encryptMessage,
	generateChatName,
	getChatOrUserAvatar,
	getSymmetricKey,
} from "../utils/chatUtils";
import { marked, Token } from "marked";
import Message, {
	MessageComponentAttrs,
	MessageComponentState,
} from "../components/message";
import { ChatMessage } from "../interfaces/chatMessage";
import DOMPurify from "dompurify";
import { fetchAndApplyTheme } from "../themes/colorTheme";
import {
	addNotification,
	NotificationContainer,
} from "../components/popupNotification";

const notificationSound = new Audio("/notification.flac");

let chatId: string = "";
let thisUser: UserModel | null = pb.authStore.record as UserModel | null;
let chatInfo: ChatModel;
let recipients: { [key: string]: UserModel } = {};
let symmetricKey: CryptoKey | undefined = undefined;
let messageList: ChatMessage[] = [];
let message: string = "";
let chatPhoto: string = "";
let chatName: string = "";
let processedTypingMessage: string = "";
let selectedFiles: Array<File> = [];
let selectedFileNames: Set<String> = new Set();
let isEncryptingFiles: boolean = false;
let encryptionPromises: { [key: string]: Promise<FileEncryptionResult> } = {};

function updateSelectedFileNames() {
	selectedFileNames = new Set(selectedFiles.map((f) => f.name));
}

async function decryptMessage(str: string, iv: Uint8Array, key: CryptoKey) {
	const decoder = new TextDecoder();
	return decoder.decode(
		await crypto.subtle.decrypt(
			{ name: SYMMETRIC_KEY_ALG, iv },
			key,
			base64ToArrayBuffer(str)
		)
	);
}

/** Parse the encryption IV for message decryption.
 * Also checks if the IV string passed in used the old format
 * (of directly converting Uint8Array into JSON string)
 * or the new format (capable of storing multiple IVs and use JSON
 * arrays instead of objects to store the IV itself)
 */
function ivFromJson(str: string) {
	let obj = JSON.parse(str);

	if (obj["message"] !== undefined) {
		obj = obj["message"];
	}

	if (obj instanceof Array) {
		return new Uint8Array(obj);
	}

	let arr = Object.keys(obj).map((k) => obj[k]);
	return new Uint8Array(arr);
}

/// Parse Markdown and sanitize output
async function processMessage(input: string) {
	return DOMPurify.sanitize(await marked.parse(input));
}

function processMessageSync(input: string) {
	return DOMPurify.sanitize(marked.parse(input, { async: false }));
}

async function initChatInfo() {
	try {
		chatInfo = (await chats.getOne(chatId, {
			fetch: pbMithrilFetch,
			expand: "members",
		})) as ChatModel;
	} catch (ex) {
		if (ex instanceof ClientResponseError) {
			if (ex.response.status == 404) {
				alert(
					"The chat with this ID is not found. We'll be redirecting you back to home."
				);
				m.route.set("/chat");
				return;
			}
		}
		throw ex;
	}

	const members = chatInfo.expand?.members as UserModel[];
	recipients = Object.fromEntries(members.map((value) => [value.id, value]));

	const keyFetchResult = await getSymmetricKey(thisUserId, chatId);

	if (keyFetchResult === null) {
		return;
	}

	symmetricKey = keyFetchResult;

	const result = (await messages.getList(1, 25, {
		sort: "created",
		filter: `chat = "${chatId}"`,
	})) as ListResult<MessageModel>;

	messageList = await Promise.all(
		result.items.map(async (msg) => {
			let rawContent = await decryptMessage(
				msg.content,
				ivFromJson(msg.iv),
				keyFetchResult
			);
			const processedMessage = await processMessage(rawContent);

			rawContent = rawContent
				.replaceAll("<", "&lt;")
				.replaceAll(">", "&gt;")
				// Needs to be done because Mithril.js is weird with contentEditable
				.replaceAll("\n", "<br>");

			return {
				id: msg.id,
				chatId: msg.chat,
				senderId: msg.sender,
				sender: recipients[msg.sender]?.name ?? "Unknown Account",
				rawContent,
				iv: msg.iv,
				content: processedMessage,
				attachments: msg.attachments,
				created: msg.created,
			};
		})
	);

	chatPhoto = getChatOrUserAvatar(chatInfo, Object.values(recipients));
	chatName =
		chatInfo.name.trim() === ""
			? generateChatName(recipients, thisUserId)
			: chatInfo.name;

	let theme = chatInfo.theme;

	if (chatInfo.theme === "") {
		theme = "slate";
	}

	fetchAndApplyTheme(theme);

	m.redraw();
}

type FileEncryptionResult = { file: File; iv: Uint8Array };

function encryptFile(file: File) {
	return new Promise<FileEncryptionResult>((resolve, _reject) => {
		const reader = new FileReader();
		reader.readAsArrayBuffer(file);

		reader.onload = async (_) => {
			if (symmetricKey === undefined) return;

			const iv = crypto.getRandomValues(new Uint8Array(12));
			const encryptedContent = await crypto.subtle.encrypt(
				{
					name: SYMMETRIC_KEY_ALG,
					iv,
				},
				symmetricKey,
				reader.result as ArrayBuffer
			);
			resolve({
				file: new File([encryptedContent], file.name.concat(".aes"), {
					type: "application/octet-stream",
				}),
				iv: iv,
			});
		};
	});
}

async function sendMessage() {
	if (thisUser === null || symmetricKey === undefined) return;

	const encrypted = await encryptMessage(message, symmetricKey);

	let attachments = await Promise.all(Object.values(encryptionPromises));
	let files = [];
	let ivContainer: { [key: string]: Array<number> } = {
		message: Array.from(encrypted.iv),
	};

	for (const attachment of attachments) {
		ivContainer[attachment.file.name] = Array.from(attachment.iv);
		files.push(attachment.file);
	}

	messages.create({
		sender: thisUserId,
		chat: chatId,
		content: encrypted.result,
		iv: JSON.stringify(ivContainer),
		attachments: files,
	} as MessageModel);

	message = "";
	selectedFiles = [];
	selectedFileNames.clear();
	encryptionPromises = {};
	(document.getElementById("messageEntry") as HTMLElement).innerText = "";
}

async function updateMessage(id: string, newContent: string) {
	if (thisUser === null || symmetricKey === undefined) return;

	const encrypted = await encryptMessage(newContent, symmetricKey);

	await messages.update(id, {
		content: encrypted.result,
		iv: JSON.stringify({
			message: Array.from(encrypted.iv),
		}),
	});
}

function processToken(token: Token): Token {
	if (token.type !== "code" && "text" in token) {
		token.raw = token.raw.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
		token.text = token.text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");

		if ("tokens" in token) {
			token.tokens = processAllTokens(token.tokens!);
		}
	}
	return token;
}

function processAllTokens(tokens: Token[]): Token[] {
	return tokens.map((token) => processToken(token));
}

const Chat = {
	oninit: async () => {
		chatId = m.route.param("id");

		marked.use({
			breaks: true,
			hooks: {
				processAllTokens,
			},
		});

		initChatInfo();
	},
	oncreate: async () => {
		messages.subscribe(
			"*",
			async (data: RecordSubscription<MessageModel>) => {
				switch (data.action) {
					case "create":
						if (
							data.record.chat === chatId &&
							symmetricKey !== undefined
						) {
							let rawContent = await decryptMessage(
								data.record.content,
								ivFromJson(data.record.iv),
								symmetricKey
							);
							const processedMessage = await processMessage(
								rawContent
							);

							rawContent = rawContent
								.replaceAll("<", "&lt;")
								.replaceAll(">", "&gt;")
								// Needs to be done because Mithril.js is weird with contentEditable
								.replaceAll("\n", "<br>");

							messageList.push({
								id: data.record.id,
								chatId: data.record.chat,
								senderId: data.record.sender,
								sender: recipients[data.record.sender].name,
								rawContent,
								iv: data.record.iv,
								content: processedMessage,
								attachments: data.record.attachments,
								created: data.record.created,
							});
						}

						if (data.record.sender != thisUser?.id) {
							notificationSound.play();
						}
						break;
					case "update":
						const targetMsgIndex = messageList.findIndex(
							(v) => v.id === data.record.id
						);
						if (targetMsgIndex === -1 || symmetricKey === undefined)
							return;
						let rawContent = await decryptMessage(
							data.record.content,
							ivFromJson(data.record.iv),
							symmetricKey
						);
						const processedMessage = await processMessage(
							rawContent
						);

						// Needs to be done because Mithril.js and contentEditable is weird
						rawContent = rawContent.replaceAll("\n", "<br>");

						messageList[targetMsgIndex].rawContent = rawContent;
						messageList[targetMsgIndex].content = processedMessage;
						break;
					case "delete":
						messageList = messageList.filter(
							(v) => v.id != data.record.id
						);
						break;
				}

				m.redraw();
			}
		);
	},
	onupdate() {
		let messageList = document.getElementById("messageList");
		if (messageList !== null) {
			messageList.scrollTo(0, messageList.scrollHeight);
		}

		let newId = m.route.param("id");
		if (newId === chatId) return;

		chatId = newId;
		initChatInfo();
	},
	onremove() {
		messages.unsubscribe();
	},
	view: () => {
		let messageNotSendable =
			(processedTypingMessage == "" && selectedFiles.length === 0) ||
			isEncryptingFiles;

		return m("#pagecontainer.chat", [
			m(NotificationContainer),
			m(NavBar),
			m("main#chatarea", [
				m("div.flex.gap-2", [
					m(
						"a.cleanlink.iconbutton.md#chatBackBtn",
						{
							href: "#!/chat",
						},
						m.trust(`<i class="bi bi-chevron-left"></i>`)
					),
					m("header.flex.gap-2.items-center#chatHeader", [
						chatPhoto === ""
							? null
							: m("img.rounded", {
									src: chatPhoto,
									alt: `${chatName}'s chat photo`,
									height: 29.5,
							  }),
						m("span", chatName),
					]),
					m(
						"a.cleanlink.iconbutton.md#chatSettings",
						{
							href: `#!/chat/${chatId}/settings`,
							ariaLabel: "Chat Settings",
						},
						m.trust(`<i class="bi bi-info-circle-fill"></i>`)
					),
				]),
				m(
					"div#messageList",
					messageList.map((msg) => {
						return m<MessageComponentAttrs, MessageComponentState>(
							Message,
							{
								msg: msg,
								updateFunc(newContent) {
									return updateMessage(msg.id, newContent);
								},
							}
						);
					})
				),
				m(".flex.flex-col.gap-2#messageForm", [
					selectedFiles.length > 0
						? m("#attachmentBox", [
								m("span.flex.gap-1.items-end", [
									m("strong", "Attachments (Beta)"),
									m(
										"span.secondary",
										"Max 15MB per file. Encrypted files ready to sent will be highlighted in green."
									),
								]),
								m(
									".attachmentList",
									selectedFiles.map((file, index) => {
										return m(
											".attachment",
											{
												id: `attachment-${index}`,
											},
											[
												file.name,
												m(
													"button.close-btn",
													{
														ariaLabel:
															"Remove attachment",
														onclick() {
															let thisFileIndex =
																selectedFiles.findIndex(
																	(f) =>
																		f.name ===
																		file.name
																);
															selectedFiles.splice(
																thisFileIndex,
																1
															);
															updateSelectedFileNames();
														},
													},
													[
														m.trust(
															`<i class="bi bi-x"></i>`
														),
													]
												),
											]
										);
									})
								),
						  ])
						: null,
					m("#messageInputRow.flex.gap-2", [
						m("label.button#attachFileBtn[for=attachFileInput]", [
							m.trust(`<i class="bi bi-paperclip"></i>`),
						]),
						m("input[type=file][multiple]#attachFileInput", {
							async onchange(event: Event) {
								const fileInput =
									event.target as HTMLInputElement;
								const files = fileInput.files;

								if (files == null) return;

								const fileSet = new Set(
									Array.from(files).map((f) => f.name)
								);
								const newFileNames =
									fileSet.difference(selectedFileNames);

								if (newFileNames.size === 0) return;

								const newFiles = Array.from(files).filter((f) =>
									newFileNames.has(f.name)
								);

								selectedFiles = selectedFiles.concat(newFiles);
								updateSelectedFileNames();

								isEncryptingFiles = true;

								for (let file of newFiles) {
									encryptionPromises[file.name] = encryptFile(
										file
									).then((result) => {
										document
											.getElementById(
												`attachment-${selectedFiles.findIndex(
													(f) =>
														f.name ===
														result.file.name.slice(
															0,
															result.file.name
																.length - 4
														)
												)}`
											)
											?.classList.add("ready");
										return result;
									});
								}

								Promise.all(
									Object.values(encryptionPromises)
								).then(() => {
									isEncryptingFiles = false;
									m.redraw();
								});

								fileInput.value = "";
							},
						}),
						m("#messageEntry[contenteditable=true]", {
							oninput: (event: Event) => {
								const target = event.target as HTMLElement;
								message = target.innerText;
								processedTypingMessage =
									processMessageSync(message).trim();
							},
							onkeydown(event: KeyboardEvent) {
								if (event.code === "Enter" && !event.shiftKey) {
									if (isEncryptingFiles) {
										addNotification(
											"Please wait until all files are encrypted and ready to be sent!"
										);
									}
									if (messageNotSendable) return;
									sendMessage();
								}
							},
						}),
						m(
							"button.button#sendButton",
							{
								disabled: messageNotSendable,
								onclick: sendMessage,
								ariaLabel: "Send Message",
							},
							[m.trust(`<i class="bi bi-send-fill"></i>`)]
						),
					]),
				]),
			]),
		]);
	},
} as Component;

window.addEventListener("beforeunload", () => {
	messages.unsubscribe();
});

export default Chat;
