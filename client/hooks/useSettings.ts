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
import { useCallback, useEffect, useState } from 'react';

// TeaType
import { accentVars, sanitizeAccent } from '@teatype/toolkit/accent';

const STORAGE_KEY = 'tickfit-settings';
const DEFAULT_ACCENT = '#30d158';

interface iSettings {
    accentColor: string;
    /** Pause between sets (s) of a workout that has none of its own */
    defaultRest: number;
    /** The screen stays on while training */
    keepAwake: boolean;
    lightMode: boolean;
    /** What was on the same weekday last week, in the cards of the week */
    showLastWeek: boolean;
    /** A short buzz when the rest is over */
    vibrate: boolean;
}

const DEFAULTS: iSettings = { accentColor: DEFAULT_ACCENT, defaultRest: 90, keepAwake: true, lightMode: false, showLastWeek: true, vibrate: true };

const read = (): iSettings => {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<iSettings>;
        return {
            accentColor: sanitizeAccent(stored.accentColor, DEFAULT_ACCENT),
            defaultRest: Number.isFinite(stored.defaultRest) ? Math.min(600, Math.max(0, stored.defaultRest as number)) : DEFAULTS.defaultRest,
            keepAwake: stored.keepAwake ?? DEFAULTS.keepAwake,
            lightMode: stored.lightMode ?? DEFAULTS.lightMode,
            showLastWeek: stored.showLastWeek ?? DEFAULTS.showLastWeek,
            vibrate: stored.vibrate ?? DEFAULTS.vibrate,
        };
    } catch {
        return DEFAULTS;
    }
};

/** The settings of this device (not synced: a phone and a laptop may want different ones) and the look they set on the page */
const useSettings = () => {
    const [settings, setSettings] = useState<iSettings>(read);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        // On the body, so the toast and the modals that are portaled there get it too
        document.body.classList.toggle('light-mode', settings.lightMode);
        Object.entries(accentVars(settings.accentColor, settings.lightMode)).forEach(([name, value]) => document.documentElement.style.setProperty(name, value));
    }, [settings]);

    const change = useCallback(<K extends keyof iSettings>(key: K, value: iSettings[K]) => setSettings((previous) => ({ ...previous, [key]: value })), []);

    return { change, settings };
};

export type { iSettings };
export { DEFAULT_ACCENT, useSettings };
