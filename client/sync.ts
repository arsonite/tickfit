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


// TeaType
import type { HSDBBaseAPI } from '@teatype/api';
import { createLocalStore } from '@teatype/sync';
import type { iCollection, tRow } from '@teatype/sync';

// API
import { EntryAPI, ExerciseAPI, PlanAPI, PlanDayAPI, SessionAPI, SetAPI, SlotAPI, WorkoutAPI } from '@/api';

// Types
import type { iEntry, iExercise, iPlan, iPlanDay, iRow, iSession, iSet, iSlot, iWorkout } from '@/types';

// What is on the device: one entry per table and the sync meta, all written together (see usePersist of @teatype/sync)
const localStore = createLocalStore('tickfit');

/** Bump when the rows change: an older meta would make unchanged-looking rows count as deleted on the server */
const META_VERSION = 1;

/** Ids are made here, the server only gets to know them through the sync. Not randomUUID alone: it needs https. */
const newId = (): string => {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * `defaults` are the plain fields of the model in the order they are sent, a missing one is sent as its default.
 * `relations` point to the collection of the related rows, an unset one is left out.
 */
const define = <L extends iRow>(api: typeof HSDBBaseAPI, name: string, defaults: tRow, relations: Record<string, string> = {}): iCollection<L> => ({
    api,
    name,
    relations,
    key: (item) => item.id,
    fromRow: (row, key) => {
        const item: Record<string, unknown> = { id: key };
        for (const field of Object.keys(defaults)) {
            item[field] = row[field] ?? defaults[field];
        }
        for (const field of Object.keys(relations)) {
            if (typeof row[field] === 'string') {
                item[field] = row[field];
            }
        }
        return item as unknown as L;
    },
    toRow: (item) => {
        const source = item as unknown as Record<string, string | number | boolean | null | undefined>;
        const row: tRow = {};
        for (const field of Object.keys(defaults)) {
            row[field] = source[field] ?? defaults[field];
        }
        for (const field of Object.keys(relations)) {
            if (source[field]) {
                row[field] = source[field] as string;
            }
        }
        return row;
    },
});

// A row points to rows of the collections before it, so this is also the order of saving
const exerciseCollection = define<iExercise>(ExerciseAPI, 'exercises', { image: '', name: '', notes: '', unit: 'reps', weighted: false });
const workoutCollection = define<iWorkout>(WorkoutAPI, 'workouts', { archived: false, family: '', focus: '', kind: 'strength', name: '', notes: '', rest_seconds: 0, version: 1, warmup: '' });
const planCollection = define<iPlan>(PlanAPI, 'plans', { active: false, name: '', notes: '' });
const slotCollection = define<iSlot>(
    SlotAPI,
    'slots',
    { notes: '', position: 0, rep_max: 0, rep_min: 0, sets: 1, superset: false },
    { alternative_of: 'slots', exercise: 'exercises', workout: 'workouts' },
);
const planDayCollection = define<iPlanDay>(PlanDayAPI, 'planDays', { position: 0 }, { plan: 'plans', workout: 'workouts' });
const sessionCollection = define<iSession>(SessionAPI, 'sessions', { date: '', finished_at: 0, notes: '', plan_day: -1, started_at: 0, status: 'planned' }, { workout: 'workouts' });
const entryCollection = define<iEntry>(EntryAPI, 'entries', { notes: '' }, { chosen: 'slots', session: 'sessions', slot: 'slots' });
const setCollection = define<iSet>(
    SetAPI,
    'sets',
    { disabled: false, done: false, ended_at: 0, kind: '', position: 0, rest_ended_at: 0, rest_started_at: 0, started_at: 0, value: 0, weight: 0 },
    { session: 'sessions', session_exercise: 'entries' },
);

const COLLECTIONS = [
    exerciseCollection,
    workoutCollection,
    planCollection,
    slotCollection,
    planDayCollection,
    sessionCollection,
    entryCollection,
    setCollection,
];

export {
    COLLECTIONS,
    META_VERSION,
    entryCollection,
    exerciseCollection,
    localStore,
    newId,
    planCollection,
    planDayCollection,
    sessionCollection,
    setCollection,
    slotCollection,
    workoutCollection,
};
