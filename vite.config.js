import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                login: resolve(__dirname, 'login.html'),
                terms: resolve(__dirname, 'terms.html'),
            },
        },
    },
    css: {
        preprocessorOptions: {
            less: {}
        }
    }
})
