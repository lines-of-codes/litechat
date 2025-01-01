import m from "mithril";
import type { Component } from "mithril";
import NavBar from "../components/navbar";
import { ChatModel, chats } from "../collections/chats";
import { pbMithrilFetch } from "../utils/pbMithril";
import type { UserModel } from "../collections/users";
import pb from "../pocketbase";
import { base64ToArrayBuffer } from "../utils/base64";
import { SYMMETRIC_KEY_ALG } from "../crypto";
import { MessageModel, messages } from "../collections/messages";
import { ListResult, RecordSubscription } from "pocketbase";
import {
	encryptMessage,
	generateChatName,
	getChatOrUserAvatar,
	getSymmetricKey,
} from "../utils/chatUtils";
import { marked } from "marked";
import Message, {
	MessageComponentAttrs,
	MessageComponentState,
} from "../components/message";
import { ChatMessage } from "../interfaces/chatMessage";
import DOMPurify from "dompurify";
import { fetchAndApplyTheme } from "../themes/colorTheme";

const notificationSound = new Audio("/notification.flac");

let chatId: string = "";
let thisUser: UserModel | null = pb.authStore.record as UserModel | null;
let thisUserId: string = "";
let chatInfo: ChatModel;
let recipients: { [key: string]: UserModel } = {};
let symmetricKey: CryptoKey | undefined = undefined;
let messageList: ChatMessage[] = [];
let message: string = "";
let chatPhoto: string = "";
let chatName: string = "";

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

function ivFromJson(str: string) {
	let obj = JSON.parse(str);
	let arr = Object.keys(obj).map((k) => obj[k]);
	return new Uint8Array(arr);
}

/// Parse Markdown and sanitize output
async function processMessage(input: string) {
	return DOMPurify.sanitize(await marked.parse(input));
}

async function initChatInfo() {
	chatInfo = (await chats.getOne(chatId, {
		fetch: pbMithrilFetch,
		expand: "members",
	})) as ChatModel;

	const members = chatInfo.expand?.members as UserModel[];
	recipients = Object.fromEntries(members.map((value) => [value.id, value]));

	const otherMembers = members.filter((value) => {
		return value.id != thisUserId;
	});

	if (otherMembers.length == 0) {
		window.location.href = "#!/chat";
	}

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

			// Needs to be done because Mithril.js and contentEditable is weird
			rawContent = rawContent.replaceAll("\n", "<br>");

			return {
				id: msg.id,
				senderId: msg.sender,
				sender: recipients[msg.sender].name,
				rawContent,
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

async function sendMessage() {
	if (thisUser === null || symmetricKey === undefined) return;

	const encrypted = await encryptMessage(message, symmetricKey);

	messages.create({
		sender: thisUserId,
		chat: chatId,
		content: encrypted.result,
		iv: JSON.stringify(encrypted.iv),
	} as MessageModel);

	(document.getElementById("messageEntry") as HTMLElement).innerText = "";
}

async function updateMessage(id: string, newContent: string) {
	if (thisUser === null || symmetricKey === undefined) return;

	const encrypted = await encryptMessage(newContent, symmetricKey);

	await messages.update(id, {
		content: encrypted.result,
		iv: JSON.stringify(encrypted.iv),
	});
}

const Chat = {
	oninit: async () => {
		chatId = m.route.param("id");

		const authRecord = pb.authStore.record;

		if (authRecord === null) return;

		thisUserId = authRecord.id;

		initChatInfo();

		marked.use({
			breaks: true,
		});
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

							// Needs to be done because Mithril.js and contentEditable is weird
							rawContent = rawContent.replaceAll("\n", "<br>");

							messageList.push({
								id: data.record.id,
								senderId: data.record.sender,
								sender: recipients[data.record.sender].name,
								rawContent,
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
		return m("#pagecontainer.chat", [
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
				m(".flex.gap-2#messageForm", [
					m("#messageEntry[contenteditable=true]", {
						placeholder: "Enter your message...",
						oninput: (event: Event) => {
							const target = event.target as HTMLElement;
							message = target.innerText;
						},
						onkeydown(event: KeyboardEvent) {
							if (event.code === "Enter" && !event.shiftKey) {
								if (DOMPurify.sanitize(message.trim()) === "")
									return;
								sendMessage();
							}
						},
					}),
					m(
						"button.button#sendButton",
						{
							disabled: DOMPurify.sanitize(message.trim()) === "",
							onclick: sendMessage,
						},
						[m.trust(`<i class="bi bi-send-fill"></i>`)]
					),
				]),
			]),
		]);
	},
} as Component;

window.addEventListener("beforeunload", () => {
	messages.unsubscribe();
});

export default Chat;
