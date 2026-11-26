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
import { TeaButton, TeaConfirmProvider, TeaSidebar, TeaSyncStatus, TeaToastContainer, useTeaToast } from '@teatype/components';
import useIsMobile from '@teatype/hooks/useIsMobile';
import { SettingsIcon } from '@teatype/icons';
import { edgeSwipe } from '@teatype/toolkit/gestures';

// Components
import { ExercisesView } from '@/components/ExercisesView';
import { PlansView } from '@/components/PlansView';
import { SessionView } from '@/components/SessionView';
import { SettingsView } from '@/components/SettingsView';
import { StatsView } from '@/components/StatsView';
import { TrainBanner } from '@/components/TrainBar';
import { WeekView } from '@/components/WeekView';
import { WorkoutsView } from '@/components/WorkoutsView';

// Hooks
import { useSettings } from '@/hooks/useSettings';
import { STORED_KEYS, useTickfit } from '@/hooks/useTickfit';
import type { tStored } from '@/hooks/useTickfit';
import { navigate, useRoute } from '@/hooks/useRoute';
import { useWakeLock } from '@/hooks/useWakeLock';

// Utility
import { localStore } from '@/sync';

type tView = 'exercises' | 'plans' | 'stats' | 'week' | 'workouts';

const SIDEBAR_KEY = 'tickfit-sidebar';

const NAV: { id: tView; label: string }[] = [
    { id: 'week', label: 'Week' },
    { id: 'workouts', label: 'Workouts' },
    { id: 'exercises', label: 'Exercises' },
    { id: 'plans', label: 'Plans' },
    { id: 'stats', label: 'Statistics' },
];

const Tickfit = ({ stored }: { stored: tStored }) => {
    const toast = useTeaToast();
    const data = useTickfit(toast, stored);
    const mobile = useIsMobile();
    // Where the app is lives in the address, a reload (or a phone that reloads the page) lands on the same page
    const route = useRoute();
    const head = route.path[0];
    const settingsOpen = head === 'settings';
    const sessionId = head === 'day' ? (route.path[1] ?? null) : null; // The day that is open, over the week
    const view: tView = NAV.find((item) => item.id === head)?.id ?? 'week';
    const week = route.params.get('w') ?? undefined;
    const [pinned, setPinned] = useState(() => localStorage.getItem(SIDEBAR_KEY) !== 'closed');
    const [sheet, setSheet] = useState(false);
    const { apply, change, settings } = useSettings();

    useWakeLock(settings.keepAwake && Boolean(data.training.session));

    // On a phone the sidebar is a sheet over the page, it opens on demand and is not remembered. Hiding it is for phones only.
    const hidden = mobile && settings.hideSidebar;
    const sheeted = mobile;
    const expanded = sheeted ? sheet : pinned;
    const toggle = () => {
        if (sheeted) {
            setSheet((open) => !open);
        } else {
            localStorage.setItem(SIDEBAR_KEY, pinned ? 'closed' : 'open');
            setPinned(!pinned);
        }
    };

    const go = (next: tView) => {
        route.go([next]);
        setSheet(false);
    };

    // The day goes with the week it was opened from, so the way back is the same week
    const openDay = (id: string) => route.go(['day', id], { w: week });
    const closeDay = () => route.go(['week'], { w: week });

    const openSettings = () => {
        route.go(['settings'], { from: route.path.join('/') });
        setSheet(false);
    };
    const closeSettings = useCallback(() => {
        const from = new URLSearchParams(window.location.hash.split('?')[1]).get('from');
        navigate(from ? from.split('/') : ['week']);
    }, []);

    // Hidden, the sidebar comes in by a swipe from the left edge
    useEffect(() => (hidden ? edgeSwipe(() => setSheet(true)) : undefined), [hidden]);

    // Escape closes the settings, like the back button
    useEffect(() => {
        if (!settingsOpen) {
            return;
        }
        const close = (event: KeyboardEvent) => event.key === 'Escape' && closeSettings();
        window.addEventListener('keydown', close);
        return () => window.removeEventListener('keydown', close);
    }, [closeSettings, settingsOpen]);

    return (
        <div className={`app ${expanded && !sheeted ? '' : 'app--rail'} ${sheeted ? 'app--mobile' : ''} ${hidden ? 'app--hidden' : ''}`}>
            <TeaSidebar
                expanded={expanded}
                mobile={sheeted}
                title='tickfit'
                footer={
                    <>
                        <TeaSyncStatus status={data.sync.status} unsavedCount={data.sync.unsavedCount} />
                        <TeaButton variant='borderless' fullWidth align='start' active={settingsOpen} icon={<SettingsIcon />} onClick={openSettings}>
                            Settings
                        </TeaButton>
                    </>
                }
                rail={
                    <>
                        <TeaSyncStatus compact status={data.sync.status} unsavedCount={data.sync.unsavedCount} />
                        <TeaButton variant='borderless' iconOnly active={settingsOpen} title='Settings' onClick={openSettings}>
                            <SettingsIcon />
                        </TeaButton>
                    </>
                }
                onToggle={toggle}
            >
                <nav className='nav'>
                    {NAV.map((item) => (
                        <button key={item.id} className={`nav__item ${view === item.id && !settingsOpen ? 'nav__item--on' : ''}`} onClick={() => go(item.id)}>
                            {item.label}
                        </button>
                    ))}
                </nav>
            </TeaSidebar>

            <main>
                {!settingsOpen && !(view === 'week' && sessionId) && (
                    <TrainBanner data={data} onOpen={openDay} />
                )}
                {data.load === 'loading' && !settingsOpen && <div className='empty'>Loading…</div>}
                {settingsOpen && <SettingsView data={data} settings={settings} toast={toast} onApply={apply} onChange={change} onClose={closeSettings} />}
                {data.load === 'ready' && !settingsOpen && (
                    <>
                        {view === 'week' && sessionId && (
                            <SessionView key={sessionId} data={data} autoStart={settings.autoStart} defaultRest={settings.defaultRest} sessionId={sessionId} vibrate={settings.vibrate} onBack={closeDay} />
                        )}
                        {view === 'week' && !sessionId && <WeekView data={data} showLastWeek={settings.showLastWeek} onNavigate={go} onOpen={openDay} />}
                        {view === 'exercises' && <ExercisesView data={data} />}
                        {view === 'workouts' && <WorkoutsView data={data} />}
                        {view === 'plans' && <PlansView data={data} />}
                        {view === 'stats' && <StatsView data={data} />}
                    </>
                )}
            </main>

            <TeaToastContainer toasts={toast.toasts} onRemove={toast.removeToast} position={toast.position} />
        </div>
    );
};

// Starts with what the device saved, the page does not wait for the server
export const TickfitApp = () => {
    const [stored, setStored] = useState<tStored | null>(null);

    useEffect(() => {
        localStore.readAll(STORED_KEYS).then(setStored);
    }, []);

    return <TeaConfirmProvider>{stored ? <Tickfit stored={stored} /> : null}</TeaConfirmProvider>;
};
