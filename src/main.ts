import { users } from "./auth";
import { generateKey } from "./crypto";
import pb from "./pocketbase";
import "./style.css";
import "./index.css";
import type { UserModel } from "./collections/users";
import m from "mithril";

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
		"/newchat": NewChat,
		"/manageAccount": LazyView("manageAccount"),
		"/about": LazyView("about"),
		"/importPrivateKey": LazyView("importPrivateKey"),
	});
}
