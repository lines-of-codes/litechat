import type { Component } from "mithril";
import m from "mithril";
import { ListResult } from "pocketbase";
import { users } from "../auth";
import { UserModel } from "../collections/users";
import pb, { thisUserId } from "../pocketbase";
import { pbMithrilFetch } from "../utils/pbMithril";

export type SingleUserComponentAttributes = {
	onUserSelected: (user: UserModel) => any;
};

const SingleUserSelector = {
	userResults: [],
	oninit() {},
	view(vnode) {
		return m(".flex.flex-col.gap-2", [
			m("input#idInput[type=text]", {
				placeholder: "Enter your friend's ID or name",
				oninput: async (event: Event) => {
					let value = (event.target as HTMLInputElement).value;
					vnode.state.userResults = (await users.getList(1, 15, {
						fetch: pbMithrilFetch,
						filter: `id = "${value}" || name ~ "${value}"`,
					})) as ListResult<UserModel>;
				},
			}),
			this.userResults === null || this.userResults.items === undefined
				? null
				: vnode.state.userResults.items.map((user) => {
						if (user.id === thisUserId) return null;
						return m(
							"button.list-tile.button.flex.gap-2.items-center",
							{
								onclick: async () => {
									vnode.attrs.onUserSelected(user);
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
	},
} as Component<
	SingleUserComponentAttributes,
	{
		userResults: ListResult<UserModel>;
	}
>;

export default SingleUserSelector;
