import { authWithGoogle, authWithPassword, users } from "./auth";
import { generateKey } from "./crypto";
import { UserModel } from "./collections/users";
import { ClientResponseError } from "pocketbase";

const loginBtn = document.getElementById("loginBtn");
const signUpBtn = document.getElementById("signUpBtn");
const googleBtn = document.getElementById("googleBtn");
const email = document.getElementById("email") as HTMLInputElement;
const password = document.getElementById("password") as HTMLInputElement;

function handleError(e: any) {
	if (!(e instanceof ClientResponseError)) {
		return;
	}

	if (Object.keys(e.data.data).length === 0) {
		alert(e.message);
		return;
	}

	let errorData = e.data.data as Record<string, Record<string, string>>;
	let msg = "";
	for (const k of Object.keys(errorData)) {
		const entry = errorData[k];
		msg += `${k}: ${entry.message}\n`;
	}
	alert(msg);
}

loginBtn?.addEventListener("click", async () => {
	try {
		await authWithPassword(email.value, password.value);
		window.location.href = "/";
	} catch (e) {
		handleError(e);
	}
});

signUpBtn?.addEventListener("click", async () => {
	const keyPair = await generateKey();

	try {
		await users.create<UserModel>({
			password: password.value,
			passwordConfirm: password.value,
			email: email.value,
			publicKey: keyPair.publicKeyString,
		});

		await authWithPassword(email.value, password.value);

		window.location.href = "/";
	} catch (e) {
		handleError(e);
	}
});

googleBtn?.addEventListener("click", async () => {
	const response = await authWithGoogle();

	const authRecord = response.record as UserModel;

	if (authRecord.publicKey === "") {
		const keyPair = await generateKey();

		users.update<UserModel>(authRecord.id, {
			publicKey: keyPair.publicKeyString,
		});
	}

	window.location.href = "/";
});
