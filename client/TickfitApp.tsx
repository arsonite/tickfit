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
import { useEffect, useState } from 'react';

// TeaType
import { TeaConfirmProvider, TeaSidebar, TeaSyncStatus, TeaToastContainer, useTeaToast } from '@teatype/components';
import useIsMobile from '@teatype/hooks/useIsMobile';

// Components
import { ExercisesView } from '@/components/ExercisesView';
import { PlansView } from '@/components/PlansView';
import { SessionView } from '@/components/SessionView';
import { WeekView } from '@/components/WeekView';
import { WorkoutsView } from '@/components/WorkoutsView';

// Hooks
import { STORED_KEYS, useTickfit } from '@/hooks/useTickfit';
import type { tStored } from '@/hooks/useTickfit';

// Utility
import { localStore } from '@/sync';

type tView = 'exercises' | 'plans' | 'week' | 'workouts';

const SIDEBAR_KEY = 'tickfit-sidebar';

const NAV: { id: tView; label: string }[] = [
    { id: 'week', label: 'Week' },
    { id: 'workouts', label: 'Workouts' },
    { id: 'exercises', label: 'Exercises' },
    { id: 'plans', label: 'Plans' },
];

const Tickfit = ({ stored }: { stored: tStored }) => {
    const toast = useTeaToast();
    const data = useTickfit(toast, stored);
    const mobile = useIsMobile();
    const [view, setView] = useState<tView>('week');
    const [sessionId, setSessionId] = useState<string | null>(null); // The day that is open, over the week
    const [pinned, setPinned] = useState(() => localStorage.getItem(SIDEBAR_KEY) !== 'closed');
    const [sheet, setSheet] = useState(false);

    // On a phone the sidebar is a sheet over the page, it opens on demand and is not remembered
    const expanded = mobile ? sheet : pinned;
    const toggle = () => {
        if (mobile) {
            setSheet((open) => !open);
        } else {
            localStorage.setItem(SIDEBAR_KEY, pinned ? 'closed' : 'open');
            setPinned(!pinned);
        }
    };

    const go = (next: tView) => {
        setView(next);
        setSessionId(null);
        setSheet(false);
    };

    return (
        <div className={`app ${expanded && !mobile ? '' : 'app--rail'} ${mobile ? 'app--mobile' : ''}`}>
            <TeaSidebar
                expanded={expanded}
                mobile={mobile}
                title='tickfit'
                footer={<TeaSyncStatus status={data.sync.status} unsavedCount={data.sync.unsavedCount} />}
                onToggle={toggle}
            >
                <nav className='nav'>
                    {NAV.map((item) => (
                        <button key={item.id} className={`nav__item ${view === item.id ? 'nav__item--on' : ''}`} onClick={() => go(item.id)}>
                            {item.label}
                        </button>
                    ))}
                </nav>
            </TeaSidebar>

            <main>
                {data.load === 'loading' && <div className='empty'>Loading…</div>}
                {data.load === 'ready' && (
                    <>
                        {view === 'week' && sessionId && <SessionView key={sessionId} data={data} sessionId={sessionId} onBack={() => setSessionId(null)} />}
                        {view === 'week' && !sessionId && <WeekView data={data} onNavigate={go} onOpen={setSessionId} />}
                        {view === 'exercises' && <ExercisesView data={data} />}
                        {view === 'workouts' && <WorkoutsView data={data} />}
                        {view === 'plans' && <PlansView data={data} />}
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
