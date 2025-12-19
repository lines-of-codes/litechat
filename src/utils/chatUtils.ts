import type { ChatModel } from "../collections/chats";
import { keyExchanges, KeyExchangeModel } from "../collections/keyexchanges";
import type { UserModel } from "../collections/users";
import { ASYMMETRIC_KEY_ALG, getKey, SYMMETRIC_KEY_ALG } from "../crypto";
import pb from "../pocketbase";
import { arrayBufferToBase64, base64ToArrayBuffer } from "./base64";

export function generateChatName(
    recipients:
        | {
            [key: string]: UserModel;
        }
        | Array<UserModel>,
    thisUserId?: string
): string {
    let members = Object.values(recipients);

    if (thisUserId !== undefined) {
        members = members.filter((v) => v.id !== thisUserId);
    }

    if (members.length === 0) {
        return "Unknown Chat";
    }

    return members.map((v) => v.name).join(", ");
}

export function getChatOrUserAvatar(chat: ChatModel, recipients: UserModel[]) {
    let avatarUrl: string = "";

    if (!chat) return "";

    if (chat.photo !== "") {
        avatarUrl = pb.files.getURL(chat, chat.photo);
    } else {
        const chosenUser = recipients.find(
            (v) => v.id !== pb.authStore.record?.id && v.avatar !== ""
        );

        if (chosenUser !== undefined) {
            avatarUrl = pb.files.getURL(chosenUser, chosenUser.avatar);
        }
    }

    return avatarUrl;
}

/// Returns a CryptoKey if succeed, null if failed.
export async function getSymmetricKey(
    receiver: string,
    chatId: string
): Promise<CryptoKey | null> {
    let keyText = localStorage.getItem(`chat_${chatId}`);

    if (keyText === null) {
        const privateKey = await getKey();

        if (privateKey === null) {
            window.location.href = "#!/importPrivateKey";
            return null;
        }

        let keyExchange;

        try {
            keyExchange = (await keyExchanges.getFirstListItem(
                `chat.id='${chatId}' && receiver='${receiver}'`,
                {
                    fields: "key",
                }
            )) as KeyExchangeModel;

            const key = await crypto.subtle.decrypt(
                { name: ASYMMETRIC_KEY_ALG },
                privateKey,
                base64ToArrayBuffer(keyExchange.key)
            );
            const decoder = new TextDecoder();

            keyText = decoder.decode(key);
        } catch (err) {
            console.error("An error occurred while fetching key exchanges.");
            console.error(err);

            const answer = prompt(
                "We do not have the encryption key to this chat. If you do have a backup key, please enter it below."
            );

            if (answer === null || answer.trim() === "") {
                return null;
            }

            keyText = answer;
        }

        localStorage.setItem(`chat_${chatId}`, keyText);
    }

    return await crypto.subtle.importKey(
        "jwk",
        JSON.parse(keyText),
        {
            name: SYMMETRIC_KEY_ALG,
        },
        true,
        ["encrypt", "decrypt"]
    );
}

export async function encryptMessage(str: string, symmetricKey: CryptoKey) {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return {
        result: arrayBufferToBase64(
            await crypto.subtle.encrypt(
                {
                    name: SYMMETRIC_KEY_ALG,
                    iv,
                },
                symmetricKey,
                encoder.encode(str)
            )
        ),
        iv,
    };
}

export async function decryptMessage(
    str: string,
    iv: Uint8Array<ArrayBuffer>,
    key: CryptoKey
) {
    const decoder = new TextDecoder();
    return decoder.decode(
        await crypto.subtle.decrypt(
            { name: SYMMETRIC_KEY_ALG, iv },
            key,
            base64ToArrayBuffer(str)
        )
    );
}

/** Parse the encryption IV for message decryption.
 * Also checks if the IV string passed in used the old format
 * (of directly converting Uint8Array into JSON string)
 * or the new format (capable of storing multiple IVs and use JSON
 * arrays instead of objects to store the IV itself)
 */
export function ivFromJson(str: string) {
    let obj = JSON.parse(str);

    if (obj["message"] !== undefined) {
        obj = obj["message"];
    }

    if (obj instanceof Array) {
        return new Uint8Array(obj);
    }

    const arr = Object.keys(obj).map((k) => obj[k]);
    return new Uint8Array(arr);
}
