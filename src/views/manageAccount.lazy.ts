import type { Component } from "mithril";
import m from "mithril";
import pb from "../pocketbase";
import { UserModel } from "../collections/users";
import { users } from "../auth";

/*
<header id="pageheader">
    <h1>Manage Account</h1>
</header>
<main x-data="profile" class="equal-split" id="pagecontainer">
    <div id="left" class="flex flex-col gap-4 items-start">
        <div class="flex flex-col gap-2 items-start" id="displayName">
            <h2>Name</h2>
            <input type="text" name="displayName" id="displayName" x-model="name"
                placeholder="Enter your display name...">
        </div>
        <div class="flex flex-col gap-2 items-start" id="email">
            <h2>Email</h2>
            <input type="text" name="email" id="email" placeholder="Enter your email..." x-model="email">
        </div>
        <button class="button" @click="update">Save changes</button>
    </div>
    <div id="right">
        <div id="avatar" class="flex flex-col gap-2 items-start">
            <h2>Avatar</h2>
            <img :src="avatar" alt="Your profile picture" id="avatarDisplay" x-cloak x-show="avatar != ''">
            <label for="avatarFile" class="button">Pick File</label>
            <input type="file" name="avatarFile" id="avatarFile">
        </div>
    </div>
</main>
*/

const authRecord = pb.authStore.record as UserModel;
let avatar: string = "";
let formData = new FormData();
let displayName = "";
let email = "";

const ManageAccount = {
	oninit() {
		if (authRecord === null) return;

		if (authRecord.avatar !== undefined && authRecord.avatar !== "") {
			avatar = pb.files.getURL(authRecord, authRecord.avatar);
		}

		displayName = authRecord.name;
		email = authRecord.email;
	},
	view() {
		return m(".grid.wide-content", [
			m("header#pageheader", [m("h1", "Manage Account")]),
			m("main.grid.gap-4.equal-split#pagecontainer", [
				m("#left.flex.flex-col.gap-4.items-start", [
					m(
						"a.button",
						{
							href: "#!/chat",
						},
						"← Back to home"
					),
					m(".flex.flex-col.gap-2.items-start#displayName", [
						m("h2", "Name"),
						m("input#displayName", {
							type: "text",
							name: "displayName",
							placeholder: "Enter your display name...",
							value: displayName,
							onchange(event: InputEvent) {
								let name = (event.target as HTMLInputElement)
									.value;
								displayName = name;
								formData.set("name", name);
							},
						}),
					]),
					m(".flex.flex-col.gap-2.items-start#email", [
						m("h2", "Email"),
						m("input#email", {
							type: "text",
							name: "email",
							placeholder: "Enter your email...",
							value: email,
							onchange(event: InputEvent) {
								let newEmail = (
									event.target as HTMLInputElement
								).value;
								email = newEmail;
								formData.set("email", newEmail);
							},
						}),
					]),
				]),
				m("#right.flex.flex-col.gap-4.items-start", [
					m("#avatar.flex.flex-col.gap-2.items-start", [
						m("h2", "Avatar"),
						avatar === ""
							? null
							: m("img#avatarDisplay.rounded", {
									src: avatar,
									alt: "Your profile picture",
									width: 128,
							  }),
						m(
							"label.button",
							{
								for: "avatarFile",
							},
							"Pick File"
						),
						m("input#avatarFile", {
							type: "file",
							name: "avatarFile",
							accept: "image/jpeg,image/png,image/svg+xml,image/gif,image/webp",
							onchange(event: InputEvent) {
								let newAvatar = (
									event.target as HTMLInputElement
								).files?.[0];

								if (newAvatar === undefined) return;

								avatar = URL.createObjectURL(newAvatar);
								formData.set("avatar", newAvatar);
							},
						}),
					]),
					m(
						"a.cleanlink.button#importPrivateKey",
						{
							href: "#!/importPrivateKey",
						},
						"Import Private Key"
					),
					m(
						"button.button#exportPrivateKey",
						{
							async onclick() {
								window.location.href = "#!/exportPrivateKey";
							},
						},
						"Export Private Key"
					),
				]),
			]),
			m("div.container", [
				m(
					"button.button",
					{
						async onclick() {
							await users.update(authRecord.id, formData);
							window.location.href = "#!/";
						},
					},
					"Save changes"
				),
			]),
		]);
	},
} as Component;

export default ManageAccount;
