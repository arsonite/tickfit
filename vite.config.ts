import { defineConfig, loadEnv, type Plugin, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import eslint from 'vite-plugin-eslint';
import { resolve } from 'path';

/**
 * Keeps a phone on the page it is on. Behind a proxy (homepie's nginx) or when Safari puts the page to sleep the HMR
 * socket drops now and then, and the vite client answers that by reloading the whole page once the server is back:
 * a white flash, and the workout that was open is gone. Here the socket is kept busy so it is not dropped for being
 * idle, and when it drops anyway the client connects again instead of reloading.
 */
const steadyHmr = (): Plugin => ({
    name: 'tickfit-steady-hmr',
    apply: 'serve',
    configureServer(server) {
        const beat = setInterval(() => server.ws.send({ type: 'custom', event: 'tickfit:keepalive', data: {} }), 25_000);
        server.httpServer?.on('close', () => clearInterval(beat));
    },
    transform(code, id) {
        if (!id.endsWith('vite/dist/client/client.mjs')) {
            return;
        }
        const reload = 'await waitForSuccessfulPing(protocol, hostAndPath);\n      location.reload();';
        return code.includes(reload) ? code.replace(reload, 'await waitForSuccessfulPing(protocol, hostAndPath);\n      setupWebSocket(protocol, hostAndPath);') : undefined;
    },
});

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
        plugins: [react(), eslint(), steadyHmr()],
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
