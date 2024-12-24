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

type Tab = "single" | "group";

let currentTab: Tab = "single";
let userResult: UserModel | null = null;

const NewChat = {
    view: () => {
        const singleChat = m(".flex.flex-col.gap-2", [
            m("input#idInput[type=text]", {
                placeholder: "Enter your friend's ID",
                onchange: async (event: Event) => {
                    let value = (event.target as HTMLInputElement).value;
                    userResult = (await users.getOne(value, {
                        fetch: pbMithrilFetch,
                    })) as UserModel;
                }
            }),
            userResult == null ?
                null :
                m("button.list-tile.button.flex.gap-2.items-center", {
                    onclick: async () => {
                        if (pb.authStore.record === null || userResult === null) {
                            return;
                        }

                        const newChat = await chats.create({
                            members: [pb.authStore.record.id, userResult.id]
                        });
                        const newKey = await generateSymmetricKey();
                        const jwkKey = JSON.stringify(await crypto.subtle.exportKey("jwk", newKey));
                        const receiverKey = await crypto.subtle.importKey("jwk", JSON.parse(userResult.publicKey), {
                            name: "RSA-OAEP",
                            hash: "SHA-256"
                        } as RsaHashedImportParams, true, ["encrypt"]);

                        const encryptedKey = await crypto.subtle.encrypt({
                            name: "RSA-OAEP"
                        } as RsaOaepParams, receiverKey, new TextEncoder().encode(jwkKey));

                        await keyExchanges.create({
                            chat: newChat.id,
                            sender: pb.authStore.record.id,
                            receiver: userResult.id,
                            key: arrayBufferToBase64(encryptedKey)
                        } as KeyExchangeModel);

                        localStorage.setItem(`chat_${newChat.id}`, jwkKey);

                        window.location.href = `#!/chat/${newChat.id}`;
                    }
                }, [
                    m("img.rounded", {
                        src: userResult != null ? pb.files.getURL(userResult, userResult?.avatar) : null,
                        width: 32,
                    }),
                    m("div", userResult?.name)
                ])
        ]);

        return m("#pagecontainer.flex-center.flex-col.gap-4", [
            m(".flex.flex-col.gap-2", [
                m(".grid.equal-split.gap-2", [
                    m("button.button#singleChat", {
                        onclick: () => currentTab = "single"
                    }, "Single Recipient"),
                    m("button.button#groupChat", {
                        onclick: () => currentTab = "group"
                    }, "Group chat")
                ]),
                currentTab === "single" ?
                    singleChat : null,
            ])
        ]);
    }
} as Component;

export default NewChat;