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

// React imports
import { useEffect } from 'react';

/** Keeps the screen on while `active`, where the browser has the Wake Lock API. The lock is lost when the tab is hidden, so it is taken again. */
const useWakeLock = (active: boolean) => {
    useEffect(() => {
        if (!active || !('wakeLock' in navigator)) {
            return;
        }
        let lock: WakeLockSentinel | null = null;
        let stopped = false;
        const take = () => {
            if (!stopped && document.visibilityState === 'visible') {
                navigator.wakeLock.request('screen').then((granted) => (lock = granted), () => undefined);
            }
        };
        take();
        document.addEventListener('visibilitychange', take);
        return () => {
            stopped = true;
            document.removeEventListener('visibilitychange', take);
            void lock?.release();
        };
    }, [active]);
};

export { useWakeLock };
