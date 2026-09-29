import { resolve } from "path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	build: {
		rollupOptions: {
			input: {
				main: resolve(import.meta.dirname, "index.html"),
				login: resolve(import.meta.dirname, "login.html"),
				terms: resolve(import.meta.dirname, "terms.html"),
			},
		},
	},
	plugins: [tailwindcss()],
});
