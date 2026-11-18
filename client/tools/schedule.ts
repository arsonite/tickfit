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

// Utility
import { addDays } from '@/tools/dates';

// Types
import type { iSession } from '@/types';

// What a change of the schedule comes down to, the caller writes it to the server
interface iDraft {
    date: string;
    plan_day: number; // Position in the plan, -1 when added by hand
    workout: string;
}

interface iChanges {
    create: iDraft[];
    move: { id: string; date: string }[];
    remove: string[];
}

const NOTHING: iChanges = { create: [], move: [], remove: [] };

const byDate = (a: iSession, b: iSession): number => a.date.localeCompare(b.date);

/**
 * New days up to `until`. The plan is a cycle: each day follows the plan position of the last scheduled one, the
 * first day ever is today.
 * @param cycle Workout ids of the active plan in the order of their position
 */
const extend = (sessions: iSession[], cycle: string[], until: string, today: string): iDraft[] => {
    if (!cycle.length) {
        return [];
    }
    const sorted = [...sessions].sort(byDate);
    const last = sorted[sorted.length - 1];
    const lastPlanned = [...sorted].reverse().find((session) => (session.plan_day ?? -1) >= 0);

    let date = last ? addDays(last.date, 1) : today;
    let position = lastPlanned ? ((lastPlanned.plan_day as number) + 1) % cycle.length : 0;
    const drafts: iDraft[] = [];
    while (date <= until) {
        drafts.push({ date, plan_day: position, workout: cycle[position] });
        date = addDays(date, 1);
        position = (position + 1) % cycle.length;
    }
    return drafts;
};

/**
 * Planned days in the past were missed. Missed rest days are dropped, missed workouts are done next, starting
 * today, and everything planned after them moves back only as far as it has to, so a gap stays a gap otherwise.
 */
const realign = (sessions: iSession[], today: string, isRest: (workout: string) => boolean): iChanges => {
    const planned = sessions.filter((session) => session.status === 'planned').sort(byDate);
    const missed = planned.filter((session) => session.date < today);
    if (!missed.length) {
        return NOTHING;
    }

    // A day that is already done (or skipped) stays as it is, nothing moves onto it
    const taken = new Set(sessions.filter((session) => session.status !== 'planned').map((session) => session.date));
    const free = (date: string): string => (taken.has(date) ? free(addDays(date, 1)) : date);

    const remove = missed.filter((session) => isRest(session.workout)).map((session) => session.id);
    const move: iChanges['move'] = [];
    let cursor = today;
    for (const session of missed.filter((session) => !isRest(session.workout))) {
        const date = free(cursor);
        move.push({ id: session.id, date });
        cursor = addDays(date, 1);
    }
    if (move.length) {
        for (const session of planned.filter((session) => session.date >= today)) {
            const date = free(session.date < cursor ? cursor : session.date);
            if (date !== session.date) {
                move.push({ id: session.id, date });
            }
            cursor = addDays(date, 1);
        }
    }
    return { create: [], move, remove };
};

/** Swaps a planned day with the day before or after it. Null if the neighbour is not planned. */
const swap = (sessions: iSession[], id: string, delta: number): iChanges | null => {
    const session = sessions.find((s) => s.id === id);
    if (!session) {
        return null;
    }
    const date = addDays(session.date, delta);
    const other = sessions.find((s) => s.date === date);
    if (other && other.status !== 'planned') {
        return null;
    }
    const move = [{ id, date }];
    if (other) {
        move.push({ id: other.id, date: session.date });
    }
    return { create: [], move, remove: [] };
};

/**
 * Pushes a planned day and every planned day after it one day further (making room for something else), or pulls
 * them one day back. Null if there is no free day before it to pull them into.
 */
const shiftFrom = (sessions: iSession[], id: string, delta: 1 | -1): iChanges | null => {
    const session = sessions.find((s) => s.id === id);
    if (!session) {
        return null;
    }
    if (delta < 0 && sessions.some((s) => s.date === addDays(session.date, -1))) {
        return null;
    }
    const move = sessions
        .filter((s) => s.status === 'planned' && s.date >= session.date)
        .sort(byDate)
        .map((s) => ({ id: s.id, date: addDays(s.date, delta) }));
    return { create: [], move, remove: [] };
};

export type { iChanges, iDraft };
export { extend, realign, shiftFrom, swap };
