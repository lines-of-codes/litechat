import { users } from "./auth";
import { generateKey } from "./crypto";
import pb from "./pocketbase";
import type { UserModel } from "./collections/users";
import m from "mithril";
import "bootstrap-icons/font/bootstrap-icons.min.css";
import "./styles/style.css";
import "./styles/index.css";

if (!pb.authStore.isValid) {
	window.location.href = "login.html";
}

const authRecord = pb.authStore.record as UserModel;

if (authRecord !== null && authRecord.publicKey === "") {
	(async () => {
		const keyPair = await generateKey();

		await users.update<UserModel>(authRecord.id, {
			publicKey: keyPair.publicKeyString,
		});
	})();
}

import NewChat from "./views/newchat";
import NoChat from "./views/nochat";
import Chat from "./views/chat";
import LazyView from "./views/lazyView";

if (authRecord !== null) {
	m.route(document.body, "/chat", {
		"/chat": NoChat,
		"/chat/:id": Chat,
		"/chat/:id/settings": LazyView("chatSettings"),
		"/newchat": NewChat,
		"/manageAccount": LazyView("manageAccount"),
		"/about": LazyView("about"),
		"/importPrivateKey": LazyView("importPrivateKey"),
		"/exportPrivateKey": LazyView("exportPrivateKey"),
		"/exportData": LazyView("exportData"),
	});

	if (authRecord.name === "") {
		m.route.set("/manageAccount");
	}
}
