import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@taulwindcss/vite'

export default defineConfig({
	plugins:[
	 vue(),
	 tailwindcss(),
	],
})
