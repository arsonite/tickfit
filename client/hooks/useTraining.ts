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
import { useCallback } from 'react';

// Hooks
import type { iTable } from '@/hooks/useTable';

// Utility
import { hasOpenRest, isRunning } from '@/tools/training';

// Types
import type { iSession, iSet } from '@/types';

/**
 * The clock of a training. Everything is a time stamp on the session or on a set (Unix ms), so the clocks are
 * computed from them and a reload or another device carries on where it was. Sets of every kind (drop sets,
 * partials ...) are rows of their own and are timed alike, the rest after a set is started by hand.
 */
const useTraining = (sessions: iTable<iSession>, sets: iTable<iSet>) => {
    const inSession = useCallback((session: string) => sets.current().filter((set) => set.session === session), [sets]);

    const closeRest = useCallback(
        (session: string, now: number) => inSession(session).filter(hasOpenRest).forEach((set) => sets.patch(set.id, { rest_ended_at: now })),
        [inSession, sets],
    );

    const startSession = useCallback(
        (id: string) => {
            if (!sessions.current().find((session) => session.id === id)?.started_at) {
                sessions.patch(id, { finished_at: 0, started_at: Date.now() });
            }
        },
        [sessions],
    );

    const startSet = useCallback(
        (id: string) => {
            const set = sets.current().find((row) => row.id === id);
            // A set that is going on is not started again (a second tap would reset its clock)
            if (!set || isRunning(set)) {
                return;
            }
            const now = Date.now();
            startSession(set.session);
            closeRest(set.session, now);
            // A set that was not finished by hand ends where the next one starts
            inSession(set.session).filter(isRunning).forEach((running) => sets.patch(running.id, { done: true, ended_at: now }));
            sets.patch(id, { done: false, ended_at: 0, rest_ended_at: 0, rest_started_at: 0, started_at: now });
        },
        [closeRest, inSession, sets, startSession],
    );

    const finishSet = useCallback((id: string) => sets.patch(id, { done: true, ended_at: Date.now() }), [sets]);

    const undoSet = useCallback((id: string) => sets.patch(id, { done: false, ended_at: 0, rest_ended_at: 0, rest_started_at: 0, started_at: 0 }), [sets]);

    const startRest = useCallback((id: string) => sets.patch(id, { rest_ended_at: 0, rest_started_at: Date.now() }), [sets]);

    const endRest = useCallback((session: string) => closeRest(session, Date.now()), [closeRest]);

    const finishSession = useCallback(
        (id: string) => {
            const now = Date.now();
            closeRest(id, now);
            sessions.patch(id, { finished_at: now, status: 'done' });
        },
        [closeRest, sessions],
    );

    // Back to training, the clock keeps running from the first start
    const reopenSession = useCallback((id: string) => sessions.patch(id, { finished_at: 0, status: 'planned' }), [sessions]);

    return { endRest, finishSession, finishSet, reopenSession, startRest, startSession, startSet, undoSet };
};

export { useTraining };
