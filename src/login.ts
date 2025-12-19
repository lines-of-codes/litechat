import { authWithGoogle, authWithPassword, users } from "./auth";
import { generateKey } from "./crypto";
import { UserModel } from "./collections/users";

const loginBtn = document.getElementById("loginBtn");
const signUpBtn = document.getElementById("signUpBtn");
const googleBtn = document.getElementById("googleBtn");
const email = document.getElementById("email") as HTMLInputElement;
const password = document.getElementById("password") as HTMLInputElement;

loginBtn?.addEventListener("click", async () => {
    await authWithPassword(email.value, password.value);
    window.location.href = "/";
});

signUpBtn?.addEventListener("click", async () => {
    const keyPair = await generateKey();

    await users.create<UserModel>({
        "password": password.value,
        "passwordConfirm": password.value,
        "email": email.value,
        "publicKey": keyPair.publicKeyString,
    });

    await authWithPassword(
        email.value,
        password.value
    );

    window.location.href = "/";
});

googleBtn?.addEventListener("click", async () => {
    const response = await authWithGoogle();

    const authRecord = response.record as UserModel;

    if (authRecord.publicKey === "") {
        const keyPair = await generateKey();

        users.update<UserModel>(authRecord.id, {
            "publicKey": keyPair.publicKeyString
        });
    }

    window.location.href = "/";
});