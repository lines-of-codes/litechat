import m from "mithril";
import type { Component } from "mithril";
import { users } from "../auth";
import { UserModel } from "../collections/users";
import pb from "../pocketbase";
import { chats } from "../collections/chats";
import { pbMithrilFetch } from "../utils/pbMithril";
import { generateSymmetricKey } from "../crypto";
import { KeyExchangeModel, keyExchanges } from "../collections/keyexchanges";
import { arrayBufferToBase64 } from "../utils/base64";
import { ListResult } from "pocketbase";

type Tab = "single" | "group";

let thisUserId: string | undefined;
let currentTab: Tab = "single";
let userResults: ListResult<UserModel> | null = null;
let selectedUsers: Array<UserModel> = [];

async function createChat(users: UserModel[]) {
	if (pb.authStore.record === null) {
		return;
	}

	const newChat = await chats.create({
		members: [thisUserId, ...users.map((v) => v.id)],
	});
	const newKey = await generateSymmetricKey();
	const jwkKey = JSON.stringify(await crypto.subtle.exportKey("jwk", newKey));

	for (const user of users) {
		const receiverKey = await crypto.subtle.importKey(
			"jwk",
			JSON.parse(user.publicKey),
			{
				name: "RSA-OAEP",
				hash: "SHA-256",
			} as RsaHashedImportParams,
			true,
			["encrypt"]
		);

		const encryptedKey = await crypto.subtle.encrypt(
			{
				name: "RSA-OAEP",
			} as RsaOaepParams,
			receiverKey,
			new TextEncoder().encode(jwkKey)
		);

		await keyExchanges.create({
			chat: newChat.id,
			sender: thisUserId,
			receiver: user.id,
			key: arrayBufferToBase64(encryptedKey),
		} as KeyExchangeModel);
	}

	localStorage.setItem(`chat_${newChat.id}`, jwkKey);

	window.location.href = `#!/chat/${newChat.id}`;
}

const NewChat = {
	oninit() {
		thisUserId = pb.authStore.record?.id;
	},
	view: () => {
		const singleChat = m(".flex.flex-col.gap-2", [
			m("input#idInput[type=text]", {
				placeholder: "Enter your friend's ID or name",
				onchange: async (event: Event) => {
					let value = (event.target as HTMLInputElement).value;
					userResults = (await users.getList(1, 15, {
						fetch: pbMithrilFetch,
						filter: `id = "${value}" || name ~ "${value}"`,
					})) as ListResult<UserModel>;
				},
			}),
			userResults === null
				? null
				: userResults.items.map((user) => {
						if (user.id === thisUserId) return null;
						return m(
							"button.list-tile.button.flex.gap-2.items-center",
							{
								onclick: async () => {
									await createChat([user]);
								},
							},
							[
								user.avatar === ""
									? null
									: m("img.rounded", {
											src: pb.files.getURL(
												user,
												user.avatar
											),
											width: 32,
									  }),
								m("div", [
									m("div", user?.name),
									m("div.secondary", user?.id),
								]),
							]
						);
				  }),
		]);

		const groupChat = m(".flex.flex-col.gap-2", [
			m("input#idInput[type=text]", {
				placeholder: "Enter your friend's ID or name",
				onchange: async (event: Event) => {
					let value = (event.target as HTMLInputElement).value;
					userResults = (await users.getList(1, 15, {
						fetch: pbMithrilFetch,
						filter: `id = "${value}" || name ~ "${value}"`,
					})) as ListResult<UserModel>;
				},
			}),
			m(".resultList.flex.flex-col.gap-2", [
				selectedUsers.map((user, index) => {
					return m(
						"button.list-tile.button.flex.gap-2.items-center.space-between",
						{
							onclick: async () => {
								selectedUsers.splice(index, 1);
							},
						},
						[
							m(".flex.gap-2.items-center", [
								user.avatar === ""
									? null
									: m("img.rounded", {
											src: pb.files.getURL(
												user,
												user.avatar
											),
											width: 32,
									  }),
								m("div", [
									m("div", user?.name),
									m("div.secondary", user?.id),
								]),
							]),
							m.trust(
								`<i class="bi bi-check" style="font-size: 1.8em;"></i>`
							),
						]
					);
				}),
				userResults === null
					? null
					: userResults.items.map((user) => {
							if (
								selectedUsers.findIndex(
									(v) => v.id === user.id
								) !== -1 ||
								user.id === thisUserId
							)
								return null;
							return m(
								"button.list-tile.button.flex.gap-2.items-center",
								{
									onclick: async () => {
										selectedUsers.push(user);
									},
								},
								[
									user.avatar === ""
										? null
										: m("img.rounded", {
												src: pb.files.getURL(
													user,
													user.avatar
												),
												width: 32,
										  }),
									m("div", [
										m("div", user?.name),
										m("div.secondary", user?.id),
									]),
								]
							);
					  }),
			]),
			m(
				"button.button",
				{
					onclick() {
						createChat(selectedUsers);
					},
				},
				"Create group"
			),
		]);

		return m("#pagecontainer.flex-center.flex-col.gap-4", [
			m(".flex.flex-col.gap-2", [
				m(".grid.equal-split.gap-2", [
					m(
						"button.button#singleChat",
						{
							onclick: () => (currentTab = "single"),
							class:
								currentTab === "single" ? "active" : undefined,
						},
						"Single Recipient"
					),
					m(
						"button.button#groupChat",
						{
							onclick: () => (currentTab = "group"),
							class:
								currentTab === "group" ? "active" : undefined,
						},
						"Group chat"
					),
				]),
				currentTab === "single" ? singleChat : groupChat,
			]),
		]);
	},
} as Component;

export default NewChat;
