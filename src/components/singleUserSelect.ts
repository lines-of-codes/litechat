import type { Component } from "mithril";
import m from "mithril";
import { users } from "../auth";
import { UserModel } from "../collections/users";
import pb, { thisUserId } from "../pocketbase";
import { pbMithrilFetch } from "../utils/pbMithril";

export type SingleUserComponentAttributes = {
    onUserSelected: (user: UserModel) => void;
};

interface SingleUserComponentState {
    userResult: UserModel;
}

function displayUser(
    vnode: m.Vnode<SingleUserComponentAttributes, SingleUserComponentState>
) {
    const user = vnode.state.userResult;
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
                    src: pb.files.getURL(user, user.avatar),
                    width: 32,
                }),
            m("div", [m("div", user?.name), m("div.secondary", user?.id)]),
        ]
    );
}

const SingleUserSelector = {
    userResult: null,
    oninit() { },
    view(vnode) {
        return m(".flex.flex-col.gap-2", [
            m("input#idInput[type=text]", {
                placeholder: "Enter your friend's ID",
                oninput: async (event: Event) => {
                    const value = (event.target as HTMLInputElement).value;
                    if (value.length !== 15) return;
                    vnode.state.userResult = await users.getOne(value, {
                        fetch: pbMithrilFetch,
                    });
                },
            }),
            this.userResult === null ? null : displayUser(vnode),
        ]);
    },
} as Component<SingleUserComponentAttributes, SingleUserComponentState>;

export default SingleUserSelector;
