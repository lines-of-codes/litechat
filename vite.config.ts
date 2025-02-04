import { resolve } from "path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	build: {
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
				login: resolve(__dirname, "login.html"),
				terms: resolve(__dirname, "terms.html"),
			},
		},
	},
	plugins: [tailwindcss()],
});
