import type { Component } from "mithril";
import m from "mithril";
import { ChatModel, chats } from "../collections/chats";
import { pbMithrilFetch } from "../utils/pbMithril";
import pb from "../pocketbase";
import { generateChatName } from "../utils/chatUtils";
import { UserModel } from "../collections/users";
import { fetchAndApplyTheme } from "../themes/colorTheme";

let chatId: string = "";
let chat: ChatModel;
let thisUserId: string;
let recipients: UserModel[];
let chatPhoto: string;
let chatName: string;
let newChatName: string = "";
let theme: string = "slate";
let formData = new FormData();

const ChatSettings = {
	oninit() {
		chatId = m.route.param("id");

		const authRecord = pb.authStore.record;

		if (authRecord === null) return;

		thisUserId = authRecord.id;

		chats
			.getOne(chatId, {
				fetch: pbMithrilFetch,
				expand: "members",
			})
			.then((v) => {
				chat = v as ChatModel;
				recipients = v.expand?.members as UserModel[];

				chatPhoto = pb.files.getURL(chat, chat.photo);
				chatName = generateChatName(recipients, thisUserId);
				newChatName = chat.name;
				theme = chat.theme;

				if (theme === "") {
					theme = "slate";
				}

				fetchAndApplyTheme(theme);
			});
	},
	view() {
		return m("#pagecontainer.grid.gap-2.wide-content.h-90vh", [
			m("div.flex.gap-2", [
				m(
					"a.cleanlink.iconbutton.md",
					{
						href: `#!/chat/${chatId}`,
					},
					m.trust(`<i class="bi bi-chevron-left"></i>`)
				),
				m("header.flex.gap-2.items-center#chatHeader", [
					m("span", "Chat Settings"),
				]),
			]),
			m("div.flex.flex-col.gap-4", [
				m("div", [
					m("h2", "Chat photo"),
					chatPhoto === ""
						? m(
								"p",
								"This group doesn't have a picture yet. It'll use one of the members' picture."
						  )
						: m("img.rounded", {
								src: chatPhoto,
								alt: `${chatName}'s chat photo`,
								height: 100,
						  }),
				]),
				m("div.flex#photo", [
					m(
						"label.button",
						{
							for: "chatPictureUpload",
						},
						"Upload new picture"
					),
					m("input#chatPictureUpload", {
						type: "file",
						accept: "image/jpeg,image/png,image/svg+xml,image/gif,image/webp",

						onchange(e: Event) {
							const target = e.target as HTMLInputElement;

							if (target.files === null) return;

							chatPhoto = URL.createObjectURL(target.files[0]);
							formData.set("photo", target.files[0]);
						},
					}),
				]),
				m("div.flex.flex-col.gap-2#name", [
					m("h2", "Chat name"),
					m("div", [
						m("input", {
							type: "text",
							placeholder: "Leave blank to autogenerate",
							value: newChatName,
							maxlength: 100,
							oninput(e: InputEvent) {
								if (!e.target) return;

								newChatName = (e.target as HTMLInputElement)
									.value;
								formData.set("name", newChatName);
							},
						}),
					]),
				]),
				m("div.flex.flex-col.gap-2#theme", [
					m("h2", "Theme"),
					m("div", [
						m(
							"select.button",
							{
								value: theme,
								oninput(e: InputEvent) {
									const value = (e.target as HTMLInputElement)
										.value;

									fetchAndApplyTheme(value);
									formData.set("theme", value);
									theme = value;
								},
							},
							[
								m("option", { value: "slate" }, "Slate"),
								m("option", { value: "blue" }, "Blue"),
								m("option", { value: "indigo" }, "Indigo"),
								m("option", { value: "violet" }, "Violet"),
								m("option", { value: "purple" }, "Purple"),
								m("option", { value: "fuchsia" }, "Fuchsia"),
								m("option", { value: "pink" }, "Pink"),
								m("option", { value: "rose" }, "Rose"),
							]
						),
					]),
				]),
			]),
			m("div.flex", [
				m(
					"button.button",
					{
						async onclick() {
							await chats.update(chatId, formData);
							window.location.href = `#!/chat/${chatId}`;
						},
					},
					"Save changes"
				),
			]),
		]);
	},
} as Component;

export default ChatSettings;
