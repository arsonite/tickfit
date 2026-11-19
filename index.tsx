/**
 * @license
 * Copyright (C) 2024-2026 Burak Günaydin
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

// Components
import { TickfitApp } from './client/TickfitApp';

// Utility
import { fillScreen, lockGestures, pinViewport } from '@teatype/toolkit/gestures';

// Style
import '@teatype/style/globstyle.scss';
import '@teatype/style/globvars.scss';
import '@/style/index.scss';

// A phone page is an app: no zoom, no swipe back
lockGestures();
// Safari shifts the page up after the keyboard, which hides the top and leaves a white strip at the bottom
pinViewport();
// With the page under the status bar, the body is as high as the screen
fillScreen();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <TickfitApp />
    </React.StrictMode>,
);

// Lets the browser start the app without a connection, only in a build: a dev server is not meant to be cached
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`));
}
