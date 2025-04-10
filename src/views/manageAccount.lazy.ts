import type { Component } from "mithril";
import m from "mithril";
import pb from "../pocketbase";
import { UserModel } from "../collections/users";
import { users } from "../auth";

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
						"a.cleanlink.button",
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
					m(".flex.flex-col.gap-2.items-start#export", [
						m("h2", "Export Data"),
						m("p", "Save all your data into a file."),
						m(
							"a.cleanlink.button#exportAllData",
							{
								href: "#!/exportData",
							},
							"Export all data"
						),
					]),
					m(".flex.flex-col.gap-2.items-start#dangerous", [
						m("h2", "Dangerous Actions"),
						m(
							"button.button.danger#deleteAccount",
							{
								async onclick() {
									const answer = confirm(
										`Are you sure you want to delete your account? 
This action is irreversible and all of your data will be erased. 
If you haven't done it already, you might want to backup your data first.`
									);

									if (!answer) return;

									await users.delete(authRecord.id);
								},
							},
							"Delete Account"
						),
					]),
				]),
				m("#right.flex.flex-col.gap-4.items-start", [
					m(".flex.flex-col.gap-2.items-start#avatar", [
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
					m(".flex.flex-col.gap-2.items-start#privateKey", [
						m("h2", "Your private key"),
						m(
							"p",
							"Private keys are used to decrypt the chats sent to you."
						),
						m(
							"a.cleanlink.button#importPrivateKey",
							{
								href: "#!/importPrivateKey",
							},
							"Import Private Key"
						),
						m(
							"a.cleanlink.button#exportPrivateKey",
							{
								href: "#!/exportPrivateKey",
							},
							"Export Private Key"
						),
					]),
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
