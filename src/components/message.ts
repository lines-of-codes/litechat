import type { Component } from "mithril";
import m from "mithril";
import { messages } from "../collections/messages";
import pb from "../pocketbase";
import { UserModel } from "../collections/users";
import { ChatMessage } from "../interfaces/chatMessage";

let thisUser: UserModel | null = pb.authStore.record as UserModel | null;

function formatDate(str: string) {
	const date = new Date(str);
	return `Sent on ${date.toLocaleString()}`;
}

export type MessageComponentAttrs = {
	msg: ChatMessage;
	updateFunc: (newContent: string) => Promise<void>;
};

export type MessageComponentState = {
	currentlyEditing: boolean;
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
			]),
			msg.senderId !== thisUser?.id
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
