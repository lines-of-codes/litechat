import type { Component } from "mithril";
import m from "mithril";
import { ChatModel, chats } from "../collections/chats";
import { pbMithrilFetch } from "../utils/pbMithril";
import pb, { thisUserId } from "../pocketbase";
import { generateChatName, getSymmetricKey } from "../utils/chatUtils";
import { UserModel } from "../collections/users";
import { fetchAndApplyTheme } from "../themes/colorTheme";
import SingleUserSelector from "../components/singleUserSelect";
import { KeyExchangeModel, keyExchanges } from "../collections/keyexchanges";
import { arrayBufferToBase64 } from "../utils/base64";
import { ASYMMETRIC_KEY_ALG, ASYMMETRIC_KEY_HASH_ALG } from "../crypto";

let chatId: string = "";
let chat: ChatModel;
let recipients: UserModel[] = [];
let chatPhoto: string;
let chatName: string;
let newChatName: string = "";
let theme: string = "slate";
const formData = new FormData();

const ChatSettings = {
	oninit() {
		chatId = m.route.param("id");

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
					m.trust(`<i class="bi bi-chevron-left"></i>`),
				),
				m("header.flex.gap-2.items-center#chatHeader", [
					m("span", "Chat Settings"),
				]),
			]),
			m("div.flex.flex-wrap.gap-4", [
				m(".flex.flex-col.items-start.gap-2#photo", [
					m("h2", "Chat photo"),
					chatPhoto === ""
						? m("p", [
								"This group doesn't have a picture yet.",
								m("br"),
								"It'll use one of the members' picture.",
							])
						: m("img.rounded.w-45", {
								src: chatPhoto,
								alt: `${chatName}'s chat photo`,
							}),
					m(
						"label.button",
						{
							for: "chatPictureUpload",
						},
						"Upload new picture",
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
				m(".flex.flex-col.gap-2#theme", [
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
							],
						),
					]),
				]),
				m(".flex.flex-col.gap-2#members", [
					m("h2", "Members"),
					recipients.map((user) => {
						return m(
							"button.button.list-tile.flex.items-center.gap-2",
							[
								user.avatar === ""
									? null
									: m("img.rounded", {
											src: pb.files.getURL(
												user,
												user.avatar,
											),
											alt: `${user.name}'s profile picture`,
											width: 30,
										}),
								user.name,
							],
						);
					}),
					m(
						"button.button",
						{
							onclick() {
								const dialog = document.getElementById(
									"addMemberDialog",
								) as HTMLDialogElement;
								dialog.showModal();
							},
						},
						"Add another member",
					),
					m("dialog.rounded#addMemberDialog", [
						m(SingleUserSelector, {
							async onUserSelected(user) {
								const symKey = await getSymmetricKey(
									thisUserId,
									chatId,
								);

								if (symKey === null) {
									alert(
										"Failed to get the symmetric key for this chat.",
									);
									return;
								}

								const jwkKey = JSON.stringify(
									await crypto.subtle.exportKey(
										"jwk",
										symKey,
									),
								);

								const receiverKey =
									await crypto.subtle.importKey(
										"jwk",
										JSON.parse(user.publicKey),
										{
											name: ASYMMETRIC_KEY_ALG,
											hash: ASYMMETRIC_KEY_HASH_ALG,
										} as RsaHashedImportParams,
										true,
										["encrypt"],
									);

								const encryptedKey =
									await crypto.subtle.encrypt(
										{
											name: ASYMMETRIC_KEY_ALG,
										} as RsaOaepParams,
										receiverKey,
										new TextEncoder().encode(jwkKey),
									);

								await keyExchanges.create({
									chat: chatId,
									sender: thisUserId,
									receiver: user.id,
									key: arrayBufferToBase64(encryptedKey),
								} as KeyExchangeModel);

								await chats.update(chatId, {
									"members+": user.id,
								});

								const dialog = document.getElementById(
									"addMemberDialog",
								) as HTMLDialogElement;
								dialog.close();

								recipients.push(user);
								m.redraw();
							},
						}),
					]),
				]),
				m(".flex.flex-col.gap-2.items-start#actions", [
					m("h2", "Actions"),
					m(
						"button.button.danger",
						{
							async onclick() {
								const answer = confirm(
									"Are you sure? You won't be able to access this chat again unless someone invited you back.",
								);

								if (!answer) return;

								await chats.update(chatId, {
									"members-": thisUserId,
								});
								window.location.href = "#!/chat";
							},
						},
						"Leave Chat",
					),
					m(
						"button.button.danger",
						{
							disabled: recipients.length > 1,
							title: "You cannot delete the chat before the other member(s) leave.",
							async onclick() {
								const answer = confirm(
									"This action is irreversible. Are you really sure you want to delete the chat?",
								);

								if (!answer) return;

								await chats.delete(chatId);
								window.location.href = "#!/chat";
							},
						},
						"Delete chat",
					),
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
					"Save changes",
				),
			]),
		]);
	},
} as Component;

export default ChatSettings;
