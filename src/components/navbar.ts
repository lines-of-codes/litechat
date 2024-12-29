import m from "mithril";
import type { Component } from "mithril";
import pb from "../pocketbase";
import { UserModel } from "../collections/users";
import { ChatModel, chats } from "../collections/chats";
import { pbMithrilFetch } from "../utils/pbMithril";

/*
<nav class="flex flex-col space-between">
    <div id="sidebarStart" class="flex flex-col gap-2">
        <div id="navheader">
            <h1>litechat</h1>
            <button class="iconbutton" style="padding-top: 3px;" popovertarget="headerMenuPopover">
                <img src="/menu-meatballs-1.svg" />
            </button>
        </div>
        <nav id="headerMenuPopover" popover>
            <div>
                <button class="button" id="manageAccBtn">Manage Account</button>
                <button class="button" id="logoutBtn">Logout</button>
            </div>
        </nav>
        <button class="list-tile button">
            New chat
        </button>
        <ul id="chats">
        </ul>
    </div>
    <div id="sidebarEnd">
        <button class="button list-tile">Your profile</button>
    </div>
</nav>
 */

let profileButtonHover = false;
let chatRecipients: Array<{
	chat: ChatModel;
	receiver: UserModel;
}>;

const NavBar = {
	oninit: async () => {
		chatRecipients = (
			await chats.getList(1, 50, {
				expand: "members",
				fields: "*,expand.members.id,expand.members.name,expand.members.avatar,expand.members.collectionName",
				fetch: pbMithrilFetch,
			})
		).items.map((value) => {
			const otherMembers = (value.expand?.members as UserModel[]).filter(
				(value) => {
					return value.id != pb.authStore.record?.id;
				}
			);
			if (otherMembers.length == 0) {
				window.location.href = "#!/chat";
			}
			return {
				chat: value as ChatModel,
				receiver: otherMembers[0],
			};
		});
	},
	view: () => {
		const authRecord = pb.authStore.record as UserModel;

		return m("nav.flex.flex-col.space-between", [
			m("#sidebarStart.flex.flex-col.gap-2", [
				m("#navheader", [
					m("h1", "litechat"),
					m(
						"button.iconbutton[popovertarget='headerMenuPopover']",
						m.trust(`<i class="bi bi-three-dots"></i>`)
					),
				]),
				m("nav#headerMenuPopover[popover='']", [
					m("div", [
						m(
							"button.button#manageAccBtn",
							{
								onclick() {
									window.location.href = "#!/manageAccount";
								},
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
							"button.button#manageAccBtn",
							{
								onclick() {
									window.location.href = "#!/about";
								},
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
								const avatarUrl = pb.files.getURL(
									value.receiver,
									value.receiver.avatar
								);

								return m(
									m.route.Link,
									{
										href: "/chat/:id",
										params: {
											id: value.chat.id,
										},
										selector: "a.cleanlink",
									},
									[
										m(
											"li.list-tile.button.flex.gap-2.items-center",
											[
												avatarUrl === ""
													? null
													: m("img.rounded", {
															src: avatarUrl,
															alt: `${value.receiver.name}'s avatar`,
															height: "24",
													  }),
												m("span", value.receiver.name),
											]
										),
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
									width: "32px",
							  }),
						m("strong", authRecord.name),
						m(
							"div.secondary#accountId",
							profileButtonHover
								? "Click to copy ID"
								: authRecord.id
						),
					]
				),
			]),
		]);
	},
} as Component;

export default NavBar;
