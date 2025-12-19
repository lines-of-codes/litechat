import type { Component } from "mithril";
import m from "mithril";
import { ASYMMETRIC_KEY_ALG, getKey } from "../crypto";
import pb from "../pocketbase";
import { RecordModel } from "pocketbase";
import { base64ToArrayBuffer } from "../utils/base64";

let key = "";
let password = "";
let activeTab: "text" | "file" | "keystore" = "text";
let chosenFile: File | undefined;
let chosenFileName: string = "";

async function decryptKey(key: RecordModel, decryptionKey: CryptoKey) {
	const decoder = new TextDecoder();
	return decoder.decode(
		await crypto.subtle.decrypt(
			{
				name: "AES-GCM",
				iv: new Uint8Array(key.iv),
			},
			decryptionKey,
			base64ToArrayBuffer(key.key)
		)
	);
}

async function importFromKeystore() {
	const keyList = await pb.collection("keystore").getFullList();
	const enc = new TextEncoder();

	const salt = new Uint8Array(
		await keyList.find((record) => record.type === "PBKDF2")?.iv
	);

	if (salt === undefined) {
		alert(
			"An error has occurred. The salt used on top of the keystore protection is not found."
		);
	}

	const passwordKey = await crypto.subtle.importKey(
		"raw",
		enc.encode(password),
		"PBKDF2",
		false,
		["deriveBits", "deriveKey"]
	);
	const derivedKey = await crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt,
			iterations: 100000,
			hash: "SHA-256",
		} as Pbkdf2Params,
		passwordKey,
		{ name: "AES-GCM", length: 256 } as AesKeyGenParams,
		true,
		["encrypt", "decrypt"]
	);

	const scheduledForDeletion: Set<string> = new Set();

	console.log("Decrypting and storing keys...");

	try {
		for (const key of keyList) {
			if (key.oneTime) {
				scheduledForDeletion.add(key.id);
			}

			if (key.type === "PBKDF2") continue;

			const keyData = await decryptKey(key, derivedKey);

			if (key.type === ASYMMETRIC_KEY_ALG) {
				localStorage.setItem("privateKey", keyData);
				continue;
			}

			localStorage.setItem(`chat_${key.relatedChat}`, keyData);
		}
	} catch (err) {
		console.error(err);
		alert("Keys decryption failed. Incorrect password may be the case.");
		return;
	}

	if (scheduledForDeletion.size !== 0) {
		const batchDelete = pb.createBatch();
		for (const id of scheduledForDeletion) {
			batchDelete.collection("keystore").delete(id);
		}
		await batchDelete.send();
	}

	alert(`${keyList.length - 1} key(s) has been successfully imported.`);
}

const ImportKeyPage = {
	view() {
		const textImport = [
			m("input#privateKey", {
				type: "text",
				placeholder: "Enter private key...",
				onchange(event: InputEvent) {
					const newKey = (event.target as HTMLInputElement).value;
					key = newKey;
				},
			}),
			m(
				"button.button",
				{
					async onclick() {
						localStorage.setItem("privateKey", key);
						try {
							await getKey();
							window.location.href = "#!/chat";
						} catch (e) {
							alert(e);
						}
					},
				},
				"Import from text field"
			),
		];

		const fileImport = [
			m("div.flex.flex-col.gap-1", [
				m("label[for='keyFile'].button.text-center", "Pick File"),
				chosenFileName === "" ? null : m("pre", chosenFileName),
			]),
			m("input#keyFile", {
				type: "file",
				accept: ".json",
				onchange(e: Event) {
					const input = e.target as HTMLInputElement;

					if (input.files === null || input.files[0] === null) return;

					chosenFile = input.files[0];
					chosenFileName = input.files[0].name;
				},
			}),
			m(
				"button.button",
				{
					onclick() {
						if (chosenFile === undefined) return;

						const reader = new FileReader();

						reader.onload = async () => {
							key = reader.result as string;
							localStorage.setItem("privateKey", key);
							try {
								await getKey();
								window.location.href = "#!/chat";
							} catch (e) {
								alert(e);
							}
						};

						reader.readAsText(chosenFile);
					},
				},
				"Import"
			),
		];

		const keystoreImport = [
			m("input#privateKey", {
				type: "password",
				placeholder: "Enter keystore password...",
				onchange(event: InputEvent) {
					const value = (event.target as HTMLInputElement).value;
					password = value;
				},
			}),
			m(
				"button.button",
				{
					onclick: importFromKeystore,
				},
				"Import"
			),
		];

		const tabs = {
			text: textImport,
			file: fileImport,
			keystore: keystoreImport,
		};

		return m("main#pagecontainer.flex-center.flex-col.gap-4", [
			m("div.flex.items-center.flex-col.gap-2", [
				m("div.secondary", "Import from..."),
				m("div.flex.gap-2", [
					m(
						"button.button",
						{
							class: activeTab === "text" ? "active" : undefined,
							onclick() {
								activeTab = "text";
							},
						},
						"Text"
					),
					m(
						"button.button",
						{
							class: activeTab === "file" ? "active" : undefined,
							onclick() {
								activeTab = "file";
							},
						},
						"File"
					),
					m(
						"button.button",
						{
							class:
								activeTab === "keystore" ? "active" : undefined,
							onclick() {
								activeTab = "keystore";
							},
						},
						"Keystore"
					),
				]),
			]),
			tabs[activeTab],
		]);
	},
} as Component;

export default ImportKeyPage;
