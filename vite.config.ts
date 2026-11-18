import { defineConfig, loadEnv, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import eslint from 'vite-plugin-eslint';
import { resolve } from 'path';

// Ports come from .env (see .env.template), the defaults match the app registry of homepie
// (homepie/src/nginx/conf.d/00-homepie-apps.conf)
export const getBaseViteConfig = (): UserConfig => {
    const env = loadEnv(process.env.NODE_ENV ?? 'development', __dirname, '');
    const clientHost = env.TICKFIT_HOST ?? '127.0.0.1';
    const clientPort = Number(env.TICKFIT_CLIENT_PORT ?? 8104);
    const serverPort = Number(env.TICKFIT_PORT ?? 8767);
    // Standalone the app runs on /, set TICKFIT_BASE_PATH=/tickfit/ when homepie publishes it under that path
    const basePath = `/${(env.TICKFIT_BASE_PATH ?? '/').replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');

    return {
        base: basePath,
        plugins: [react(), eslint()],
        resolve: {
            alias: {
                '@': resolve(__dirname, 'client'),
                '@teatype': resolve(__dirname, '../teatype/ts'),
            },
        },
        css: {
            preprocessorOptions: {
                scss: {
                    // Shared components' SCSS relies on globvars being available everywhere
                    additionalData: (source: string, filename: string) =>
                        filename.includes('globvars')
                            ? source
                            : `@use "${resolve(__dirname, '../teatype/ts/style/globvars').replace(/\\/g, '/')}" as *;\n${source}`,
                },
            },
        },
        server: {
            // Loopback only by default: behind homepie the app is only reachable through its nginx, which handles the login
            host: clientHost,
            port: clientPort,
            strictPort: true,
            open: false,
            allowedHosts: ['localhost', '.homepie.net'],
            // The browser talks to this origin only, the HSDB server (127.0.0.1:<TICKFIT_PORT>) is not exposed
            proxy: {
                [`${basePath}hsdb`]: {
                    target: `http://127.0.0.1:${serverPort}`,
                    changeOrigin: true,
                    rewrite: (path) => `/${path.slice(basePath.length)}`,
                },
            },
        },
    };
};

export default defineConfig(getBaseViteConfig());
