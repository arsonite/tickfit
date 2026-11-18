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

// Types
import type { iEntry, iSession, iSet, iWorkout } from '@/types';

/** All versions of a workout share the id of the first one */
const familyOf = (workout: iWorkout): string => workout.family || workout.id;

/** 83 s -> 1:23, an hour or more -> 1:01:23 */
const clock = (ms: number): string => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const seconds = String(total % 60).padStart(2, '0');
    const minutes = Math.floor(total / 60) % 60;
    const hours = Math.floor(total / 3600);
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
};

const isRunning = (set: iSet): boolean => Boolean(set.started_at) && !set.ended_at;
const hasOpenRest = (set: iSet): boolean => Boolean(set.rest_started_at) && !set.rest_ended_at;
/** Not done, not running and not skipped: still to do */
const isOpen = (set: iSet): boolean => !set.disabled && !set.done && !set.started_at;

/** A day that was trained (or is being) is history: it stays where it is and what was logged stays with it */
const isTrained = (session?: iSession): boolean => Boolean(session && (session.status === 'done' || session.started_at));

/** The sets of the lines of a superset in turns (A1, B1, A2, B2), the sets of a single line one after the other */
const interleave = (lines: iSet[][]): iSet[] => {
    const rounds = Math.max(0, ...lines.map((line) => line.length));
    return Array.from({ length: rounds }, (_, round) => lines.map((line) => line[round]).filter(Boolean)).flat();
};

/**
 * The set that most likely comes next: the first one that is open after the set that was finished last, and if
 * there is none after it the first open one before. Only a suggestion, any set can be started.
 */
const suggestNext = (order: iSet[]): iSet | undefined => {
    const lastDone = order.reduce((best, set, index) => (set.ended_at && set.ended_at >= (order[best]?.ended_at ?? 0) ? index : best), -1);
    return order.slice(lastDone + 1).find(isOpen) ?? order.find(isOpen);
};

/** A time an exercise was trained: the sets that were done, in the order of the sets */
interface iTrained {
    date: string;
    sets: iSet[];
}

/**
 * Every time an exercise was trained, newest first, whatever workout, plan or version it was part of (an alternative counts
 * for the exercise that was chosen). Only days that are done count and only the sets that were done.
 */
const trainedHistory = (sessions: iSession[], entries: iEntry[], sets: iSet[], exerciseOf: (slot: string) => string | undefined): Map<string, iTrained[]> => {
    const done = new Map(sessions.filter((session) => session.status === 'done').map((session) => [session.id, session]));
    const setsOf = new Map<string, iSet[]>();
    sets.forEach((set) => {
        if (set.done && !set.disabled && (set.value || set.weight) && done.has(set.session)) {
            setsOf.set(set.session_exercise, [...(setsOf.get(set.session_exercise) ?? []), set]);
        }
    });
    const history = new Map<string, iTrained[]>();
    entries.forEach((entry) => {
        const session = done.get(entry.session);
        const rows = setsOf.get(entry.id);
        const exercise = exerciseOf(entry.chosen);
        if (session && rows && exercise) {
            history.set(exercise, [...(history.get(exercise) ?? []), { date: session.date, sets: rows.sort((a, b) => a.position - b.position) }]);
        }
    });
    history.forEach((runs) => runs.sort((a, b) => b.date.localeCompare(a.date)));
    return history;
};

/** The time between the end of the set before and the start of this set: picking the next exercise, the rest included */
const transitionBefore = (set: iSet, all: iSet[], sessionStart: number): number => {
    if (!set.started_at) {
        return 0;
    }
    const start = set.started_at;
    const previous = Math.max(sessionStart, ...all.filter((other) => other.id !== set.id && other.ended_at && other.ended_at <= start).map((other) => other.ended_at ?? 0));
    return Math.max(0, start - previous);
};

export { clock, familyOf, hasOpenRest, interleave, isOpen, isRunning, isTrained, suggestNext, trainedHistory, transitionBefore };
export type { iTrained };
