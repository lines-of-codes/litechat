import m from "mithril";
import type { Component } from "mithril";
import pb from "../pocketbase";
import { UserModel } from "../collections/users";
import { ChatModel, chats } from "../collections/chats";
import { pbMithrilFetch } from "../utils/pbMithril";
import { generateChatName, getChatOrUserAvatar } from "../utils/chatUtils";

let profileButtonHover = false;
let chatRecipients: Array<{
	chat: ChatModel;
	recipients: UserModel[];
}>;

async function discoveredNewChat(chat: ChatModel) {
	// Empty by default, fetch additional user only when necessary
	let recipients: UserModel[] = [];

	if (chat.name === "" || chat.photo === "") {
		const members = (
			await chats.getOne(chat.id, {
				expand: "members",
				fields: "expand.members.id,expand.members.name,expand.members.avatar,expand.members.collectionName",
			})
		).expand?.members;

		if (members !== undefined) {
			recipients = members;
		}
	}

	chatRecipients.push({
		chat,
		recipients,
	});
}

const NavBar = {
	oninit: async () => {
		chatRecipients = (
			await chats.getList(1, 50, {
				expand: "members",
				fields: "*,expand.members.id,expand.members.name,expand.members.avatar,expand.members.collectionName",
				fetch: pbMithrilFetch,
			})
		).items.map((value) => {
			return {
				chat: value as ChatModel,
				recipients: value.expand?.members,
			};
		});

		chats.subscribe("*", async (data) => {
			let chat = data.record as ChatModel;

			switch (data.action) {
				case "create":
					await discoveredNewChat(chat);
					break;
				case "update":
					const updateTargetIndex = chatRecipients.findIndex(
						(v) => v.chat.id === chat.id
					);

					if (updateTargetIndex === -1) {
						await discoveredNewChat(chat);
					} else {
						chatRecipients[updateTargetIndex].chat = chat;
					}
					break;
				case "delete":
					const deleteTarget = chatRecipients.findIndex(
						(v) => v.chat.id === chat.id
					);

					if (deleteTarget !== -1) {
						chatRecipients.splice(deleteTarget, 1);
					}
					break;
			}
			m.redraw();
		});
	},
	onremove() {
		chats.unsubscribe("*");
	},
	view: () => {
		const authRecord = pb.authStore.record as UserModel;

		return m("nav.flex.flex-col.space-between", [
			m("#sidebarStart.flex.flex-col.gap-2", [
				m("#navheader", [
					m("h1", "litechat"),
					m(
						"button.iconbutton[popovertarget='headerMenuPopover'][aria-label='Menu Toggle']",
						m.trust(`<i class="bi bi-three-dots"></i>`)
					),
				]),
				m("nav#headerMenuPopover[popover='']", [
					m("div", [
						m(
							"a.cleanlink.button#manageAccBtn",
							{
								href: "#!/manageAccount",
							},
							"Manage Account"
						),
						m(
							"button.button#logoutBtn",
							{
								onclick() {
									pb.authStore.clear();
									window.location.href = "/login.html";
								},
							},
							"Logout"
						),
						m(
							"a.cleanlink.button#manageAccBtn",
							{
								href: "#!/about",
							},
							"About"
						),
					]),
				]),
				m(
					"button.list-tile.button.flex.gap-2",
					{
						onclick: () => {
							window.location.href = "#!/newchat";
						},
					},
					[
						m.trust(`<i class="bi bi-plus"></i>`),
						m("span", "New chat"),
					]
				),
				m(
					"#chats.flex.flex-col.gap-2",
					chatRecipients === undefined
						? null
						: chatRecipients.map((value) => {
								let chatName =
									value.chat.name === ""
										? generateChatName(
												value.recipients,
												authRecord.id
										  )
										: value.chat.name;
								let avatarUrl: string = getChatOrUserAvatar(
									value.chat,
									value.recipients
								);

								return m(
									m.route.Link,
									{
										href: "/chat/:id",
										params: {
											id: value.chat.id,
										},
										selector:
											"a.cleanlink.list-tile.button.flex.gap-2.items-center",
									},
									[
										avatarUrl === ""
											? null
											: m("img.rounded", {
													src: avatarUrl,
													alt: `${chatName}'s chat picture`,
													height: "24",
											  }),
										m("span.chatName", chatName),
										,
									]
								);
						  })
				),
			]),
			m("#sidebarEnd", [
				m(
					"button.button.list-tile.flex.gap-2.items-center",
					{
						onmouseover: () => {
							profileButtonHover = true;
						},
						onmouseout: () => {
							profileButtonHover = false;
						},
						onclick: () => {
							navigator.clipboard.writeText(authRecord.id);
						},
					},
					[
						authRecord.avatar === ""
							? null
							: m("img.rounded", {
									src: pb.files.getURL(
										authRecord,
										authRecord.avatar
									),
									alt: "Your profile picture",
									width: "32px",
							  }),
						m("div", [
							m("strong", authRecord.name),
							m(
								"div.secondary#accountId",
								profileButtonHover
									? "Click to copy ID"
									: authRecord.id
							),
						]),
					]
				),
			]),
		]);
	},
} as Component;

export default NavBar;
