import m from "mithril";
import type { Component } from "mithril";
import NavBar from "../components/navbar";

/*
<div id="pagecontainer" class="gap-2">
    <NavBar/>
    <main id="chatarea">
        <div id="noChat">No chat selected.</div>
    </main>
</div>
*/

const NoChat = {
	view: () => {
		return m("#pagecontainer.grid.chat-split.gap-2.h-90vh", [
			m(NavBar),
			m("main#chatarea", [m("#noChat", "No chat selected.")]),
		]);
	},
} as Component;

export default NoChat;
