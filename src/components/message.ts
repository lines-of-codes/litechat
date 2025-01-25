import type { Component } from "mithril";
import m from "mithril";
import { messages } from "../collections/messages";
import pb, { thisUserId } from "../pocketbase";
import { ChatMessage } from "../interfaces/chatMessage";
import { SYMMETRIC_KEY_ALG } from "../crypto";
import { getSymmetricKey } from "../utils/chatUtils";
import { addNotification } from "./popupNotification";

function formatDate(str: string) {
	const date = new Date(str);
	const now = new Date(Date.now());
	const time = date.toLocaleTimeString(undefined, {
		hour: "numeric",
		minute: "numeric",
	});

	if (date.getDate() === now.getDate()) {
		return `Today, ${time}`;
	}

	if (date.getDate() === now.getDate() - 1) {
		return `Yesterday, ${time}`;
	}

	return date.toLocaleString(undefined, {
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
	});
}

function getOriginalFileName(pbFileName: string) {
	const sections = pbFileName.split(".");

	// File name without extension
	const fileName = sections[0];

	sections[0] = fileName.substring(0, fileName.length - 11);

	return sections.join(".");
}

/**
 * Fetch, decrypt, and save an attachment of a message.
 */
async function downloadAttachment(msg: ChatMessage, fileName: string) {
	const symKey = await getSymmetricKey(thisUserId, msg.chatId);

	if (symKey === null) {
		addNotification("The symmetric key to decrypt the file is not found!");
		return;
	}

	const originalFileName = getOriginalFileName(fileName);
	const fileIv: number[] = JSON.parse(msg.iv)[originalFileName];

	const fileUrl = pb.files.getURL(
		{
			id: msg.id,
			collectionName: "messages",
		},
		fileName
	);

	const res = await fetch(fileUrl);

	const decryptedData = await crypto.subtle.decrypt(
		{
			name: SYMMETRIC_KEY_ALG,
			iv: new Uint8Array(fileIv),
		},
		symKey,
		await res.arrayBuffer()
	);

	// Removes the .aes extension
	const decryptedFileName = originalFileName.substring(
		0,
		originalFileName.length - 4
	);
	const file = new File([decryptedData], decryptedFileName);
	const dataUrl = URL.createObjectURL(file);
	const downloadEl = document.createElement("a");
	downloadEl.href = dataUrl;
	downloadEl.download = decryptedFileName;
	document.body.appendChild(downloadEl);
	downloadEl.click();
	downloadEl.remove();
	URL.revokeObjectURL(dataUrl);
}

/**
 * Decrypt and preview image attachments.
 */
// function decryptImageAttachments() {}

export type MessageComponentAttrs = {
	msg: ChatMessage;
	updateFunc: (newContent: string) => Promise<void>;
};

export type MessageComponentState = {
	currentlyEditing: boolean;
	decryptionPromises: Promise<File>;
};

export type MessageComponentType = Component<
	MessageComponentAttrs,
	MessageComponentState
>;

const Message = {
	currentlyEditing: false,
	view(vnode) {
		let msg = vnode.attrs.msg;
		let currentlyEditing = vnode.state.currentlyEditing;

		return m("div.message", [
			m(".main", [
				m("div.senderName.gap-2", [
					msg.sender,
					m("span.secondary", formatDate(msg.created)),
				]),
				m(
					`div.content#msg-${msg.id}`,
					{
						contentEditable: currentlyEditing.toString(),
						onupdate() {
							if (currentlyEditing) {
								document
									.getElementById(`msg-${msg.id}`)
									?.focus();
							}
						},
						onblur: (e: FocusEvent) => {
							if (!currentlyEditing) {
								// @ts-ignore
								e.redraw = false;
								return;
							}
							vnode.state.currentlyEditing = false;
						},
						onkeydown: async (e: KeyboardEvent) => {
							if (!currentlyEditing) {
								// @ts-ignore
								e.redraw = false;
								return;
							}
							const target = e.target as HTMLElement;
							if (e.key === "Enter" && !e.shiftKey) {
								vnode.state.currentlyEditing = false;
								vnode.attrs.updateFunc(target.innerText);
								return;
							} else if (e.key === "Escape") {
								target.blur();
							} else {
								// @ts-ignore
								e.redraw = false;
							}
						},
					},
					currentlyEditing
						? m.trust(msg.rawContent)
						: m.trust(msg.content)
				),
				m(
					".attachmentList",
					msg.attachments.map((v) => {
						if (typeof v !== "string") return;

						const originalFileName = getOriginalFileName(v);

						return m(".attachment", [
							originalFileName.substring(
								0,
								originalFileName.length - 4
							),
							m(
								"button.download-btn",
								{
									onclick() {
										downloadAttachment(msg, v);
									},
								},
								m.trust(`<i class="bi bi-download"></i>`)
							),
						]);
					})
				),
			]),
			msg.senderId !== thisUserId
				? null
				: m(".actions", [
						m(
							"button.iconbutton.md",
							{
								onclick() {
									const content = document.getElementById(
										`msg-${msg.id}`
									);

									if (content === null) return;

									vnode.state.currentlyEditing = true;
									content.focus();
								},
							},
							[m.trust(`<i class="bi bi-pencil-square"></i>`)]
						),
						m(
							"button.iconbutton.md",
							{
								onclick() {
									messages.delete(msg.id);
								},
							},
							[m.trust(`<i class="bi bi-trash"></i>`)]
						),
				  ]),
		]);
	},
} as MessageComponentType;

export default Message;
