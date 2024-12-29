import m from "mithril";
import type { Component } from "mithril";
import NavBar from "../components/navbar";
import { ChatModel, chats } from "../collections/chats";
import { pbMithrilFetch } from "../utils/pbMithril";
import { UserModel } from "../collections/users";
import pb from "../pocketbase";
import { KeyExchangeModel, keyExchanges } from "../collections/keyexchanges";
import { arrayBufferToBase64, base64ToArrayBuffer } from "../utils/base64";
import { ASYMMETRIC_KEY_ALG, getKey, SYMMETRIC_KEY_ALG } from "../crypto";
import { MessageModel, messages } from "../collections/messages";
import { ListResult, RecordSubscription } from "pocketbase";

interface ChatMessage {
	id: string;
	sender: string;
	senderId: string;
	content: string;
	attachments: string[];
	created: string;
}

const notificationSound = new Audio("/notification.flac");

let chatId: string = "";
let thisUser: UserModel | null = pb.authStore.record as UserModel | null;
let thisUserId: string = "";
let chatInfo: ChatModel;
let recipient: UserModel;
let recipients: { [key: string]: UserModel };
let symmetricKey: CryptoKey;
let messageList: ChatMessage[] = [];
let message: string = "";

/// Returns true if succeed. false if failed.
async function getSymmetricKey(
	sender: string,
	receiver: string
): Promise<boolean> {
	let keyText = localStorage.getItem(`chat_${chatId}`);

	if (keyText === null) {
		const privateKey = await getKey();

		if (privateKey === null) {
			window.location.href = "#!/importPrivateKey";
			return false;
		}

		const keyExchange = (await keyExchanges.getFirstListItem(
			`chat.id='${chatId}' && sender.id='${sender}' && receiver='${receiver}'`
		)) as KeyExchangeModel;
		const key = await crypto.subtle.decrypt(
			{ name: ASYMMETRIC_KEY_ALG },
			privateKey,
			base64ToArrayBuffer(keyExchange.key)
		);
		const decoder = new TextDecoder();

		keyText = decoder.decode(key);

		localStorage.setItem(`chat_${chatId}`, keyText);
	}

	symmetricKey = await crypto.subtle.importKey(
		"jwk",
		JSON.parse(keyText),
		{
			name: SYMMETRIC_KEY_ALG,
		},
		true,
		["encrypt", "decrypt"]
	);
	return true;
}

async function decryptMessage(str: string, iv: Uint8Array) {
	const decoder = new TextDecoder();
	return decoder.decode(
		await crypto.subtle.decrypt(
			{ name: SYMMETRIC_KEY_ALG, iv },
			symmetricKey,
			base64ToArrayBuffer(str)
		)
	);
}

async function encryptMessage(str: string) {
	const encoder = new TextEncoder();
	const iv = crypto.getRandomValues(new Uint8Array(12));
	return {
		result: arrayBufferToBase64(
			await crypto.subtle.encrypt(
				{
					name: SYMMETRIC_KEY_ALG,
					iv,
				},
				symmetricKey,
				encoder.encode(str)
			)
		),
		iv,
	};
}

function ivFromJson(str: string) {
	let obj = JSON.parse(str);
	let arr = Object.keys(obj).map((k) => obj[k]);
	return new Uint8Array(arr);
}

function formatDate(str: string) {
	const date = new Date(str);
	return `Sent on ${date.toLocaleString()}`;
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

	recipient = otherMembers[0];

	const keyFetchResult = await getSymmetricKey(recipient.id, thisUserId);

	if (!keyFetchResult) {
		return;
	}

	const result = (await messages.getList(1, 25, {
		sort: "created",
		filter: `chat = "${chatId}"`,
	})) as ListResult<MessageModel>;

	messageList = await Promise.all(
		result.items.map(async (msg) => {
			return {
				id: msg.id,
				senderId: msg.sender,
				sender: recipients[msg.sender].name,
				content: await decryptMessage(msg.content, ivFromJson(msg.iv)),
				attachments: msg.attachments,
				created: msg.created,
			};
		})
	);

	m.redraw();
}

async function sendMessage() {
	if (thisUser === undefined) return;

	const encrypted = await encryptMessage(message);

	messages.create({
		sender: thisUserId,
		chat: chatId,
		content: encrypted.result,
		iv: JSON.stringify(encrypted.iv),
	} as MessageModel);

	(document.getElementById("messageEntry") as HTMLInputElement).value = "";
}

const Chat = {
	oninit: async () => {
		chatId = m.route.param("id");

		const authRecord = pb.authStore.record;

		if (authRecord === null) return;

		thisUserId = authRecord.id;

		initChatInfo();
	},
	oncreate: async () => {
		messages.subscribe(
			"*",
			async (data: RecordSubscription<MessageModel>) => {
				switch (data.action) {
					case "create":
						if (data.record.chat === chatId) {
							messageList.push({
								id: data.record.id,
								senderId: data.record.sender,
								sender: recipients[data.record.sender].name,
								content: await decryptMessage(
									data.record.content,
									ivFromJson(data.record.iv)
								),
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
						if (targetMsgIndex === -1) return;
						messageList[targetMsgIndex].content =
							await decryptMessage(
								data.record.content,
								ivFromJson(data.record.iv)
							);
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
		let newId = m.route.param("id");
		if (newId === chatId) return;

		chatId = newId;
		initChatInfo();
	},
	onremove() {
		messages.unsubscribe();
	},
	view: () => {
		return m("#pagecontainer.grid.chat-split.gap-2.h-90vh", [
			m(NavBar),
			recipient === undefined
				? null
				: m("main#chatarea", [
						m("header.flex.gap-2.items-center#chatHeader", [
							recipient.avatar === ""
								? null
								: m("img.rounded", {
										src: pb.files.getURL(
											recipient,
											recipient.avatar
										),
										height: 29.5,
										alt: `${recipient.name}'s avatar`,
								  }),
							m("span", recipient.name),
						]),
						m(
							"div#messageList",
							messageList.map((msg) => {
								return m("div.message", [
									m(".content", [
										m("div.senderName.gap-2", [
											msg.sender,
											m(
												"span.secondary",
												formatDate(msg.created)
											),
										]),
										m("div.content", msg.content),
									]),
									m(".actions", [
										msg.senderId === thisUserId
											? m(
													"button.iconbutton.md",
													{
														onclick() {
															messages.delete(
																msg.id
															);
														},
													},
													[
														m.trust(
															`<i class="bi bi-trash"></i>`
														),
													]
											  )
											: null,
									]),
								]);
							})
						),
						m(".flex.gap-2#messageForm", [
							m("input[type=text]#messageEntry", {
								placeholder: "Enter your message...",
								onchange: (event: Event) => {
									const target =
										event.target as HTMLInputElement;
									message = target.value;
								},
								onkeydown(event: KeyboardEvent) {
									if (event.code === "Enter") {
										message = (
											document.getElementById(
												"messageEntry"
											) as HTMLInputElement
										).value;
										sendMessage();
									}
								},
							}),
							m(
								"button.button#sendButton",
								{
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
