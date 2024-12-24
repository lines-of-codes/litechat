export const ASYMMETRIC_KEY_ALG = "RSA-OAEP";
export const ASYMMETRIC_KEY_HASH_ALG = "SHA-256";
export const SYMMETRIC_KEY_ALG = "AES-GCM";

export async function generateKey() {
	const { publicKey, privateKey } = await crypto.subtle.generateKey(
		{
			name: ASYMMETRIC_KEY_ALG,
			modulusLength: 4096,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: ASYMMETRIC_KEY_HASH_ALG,
		} as RsaHashedKeyGenParams,
		true,
		["encrypt", "decrypt"]
	);

	const privateKeyString = JSON.stringify(
		await crypto.subtle.exportKey("jwk", privateKey)
	);

	localStorage.setItem("privateKey", privateKeyString);
	localStorage.setItem("privateKeyEncryption", "false");

	const publicKeyString = JSON.stringify(
		await crypto.subtle.exportKey("jwk", publicKey)
	);

	return {
		publicKeyString,
		privateKeyString,
	};
}

export async function generateSymmetricKey() {
	return await crypto.subtle.generateKey(
		{ name: SYMMETRIC_KEY_ALG, length: 256 },
		true,
		["encrypt", "decrypt"]
	);
}

export async function getKey(): Promise<CryptoKey | null> {
	const localPrivateKey = localStorage.getItem("privateKey");

	if (localPrivateKey === null) return null;

	return await crypto.subtle.importKey(
		"jwk",
		JSON.parse(localPrivateKey),
		{
			name: ASYMMETRIC_KEY_ALG,
			hash: ASYMMETRIC_KEY_HASH_ALG,
		} as RsaHashedImportParams,
		true,
		["decrypt"]
	);
}
