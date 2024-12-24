import Alpine from "alpinejs";
import pb from "./pocketbase";
import { UserModel } from "./collections/users";
import { users } from "./auth";

if (!pb.authStore.isValid) {
    window.location.href = "login.html";
}

const authRecord = pb.authStore.record as UserModel;

// @ts-ignore
window.Alpine = Alpine;

const formData = new FormData();

let avatar = authRecord.avatar;

if (avatar != "") {
    avatar = pb.files.getURL(authRecord, authRecord.avatar);
}

Alpine.data("profile", () => ({
    avatar: avatar,
    name: authRecord.name,
    email: authRecord.email,

    async update() {
        if (this.name != authRecord.name) {
            formData.append("name", this.name);
        }
        if (this.email != authRecord.email) {
            formData.append("email", this.email);
        }
        await users.update(authRecord.id, formData);
        window.location.href = "/";
    }
}));

Alpine.start();

const avatarFile = document.getElementById("avatarFile") as HTMLInputElement;

avatarFile?.addEventListener("change", () => {
    formData.set("avatar", avatarFile.files?.[0] ?? "");
});
