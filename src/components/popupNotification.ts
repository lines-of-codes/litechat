import type { Component } from "mithril";
import m from "mithril";

const notifications: string[] = [];

export function addNotification(text: string, duration?: number) {
	console.log("New notification.");
	const newLength = notifications.push(text);
	setInterval(() => {
		notifications.splice(newLength - 1, 1);
		m.redraw();
	}, duration ?? 5000);
	m.redraw();
}

export const NotificationContainer = {
	view() {
		return m(
			".notification-container",
			notifications.map((text) => {
				return m(".notification", text);
			})
		);
	},
} as Component;
