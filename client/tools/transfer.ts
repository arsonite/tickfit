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

// Backup, export and import of the tables. Files carry the rows as they are in the app, with their ids.

// Utility
import { COLLECTIONS } from '@/sync';

// Types
import type { iEntry, iExercise, iRow, iSession, iSet, iSlot, iWorkout } from '@/types';

type tTables = Record<string, iRow[]>;
type tExportKind = 'exercises' | 'log' | 'plans';

const BACKUP_TYPE = 'tickfit-backup';
const EXPORT_TYPE = 'tickfit-export';
const NAMES = COLLECTIONS.map(({ name }) => name);

// A kind of export carries the rows its rows point to
const KINDS: Record<tExportKind, string[]> = {
    exercises: ['exercises'],
    log: ['exercises', 'workouts', 'slots', 'sessions', 'entries', 'sets'],
    plans: ['exercises', 'workouts', 'slots', 'plans', 'planDays'],
};

// What a row of a table cannot do without, the app does not cope with a row that lacks it
const REQUIRED: Record<string, string> = { exercises: 'name', plans: 'name', sessions: 'date', workouts: 'name' };

const relationsOf = (name: string) => COLLECTIONS.find((collection) => collection.name === name)?.relations ?? {};

const fileOf = (type: string, tables: tTables, extra: object = {}): string => JSON.stringify({ type, version: 1, exportedAt: Date.now(), ...extra, tables }, null, 2);

const backupFile = (tables: tTables, settings: object): string => fileOf(BACKUP_TYPE, tables, { settings });

const exportFile = (kind: tExportKind, tables: tTables): string => fileOf(EXPORT_TYPE, Object.fromEntries(KINDS[kind].map((name) => [name, tables[name] ?? []])));

/** Rows that point to a row that is not there are dropped, and so are the rows that pointed to those */
const withValidReferences = (tables: tTables): tTables => {
    let current = tables;
    for (;;) {
        const ids = Object.fromEntries(NAMES.map((name) => [name, new Set(current[name].map(({ id }) => id))]));
        const next = Object.fromEntries(
            NAMES.map((name) => {
                const relations = Object.entries(relationsOf(name));
                const keep = current[name].filter((row) => relations.every(([field, target]) => !(row as unknown as Record<string, string>)[field] || ids[target].has((row as unknown as Record<string, string>)[field])));
                return [name, keep];
            }),
        );
        if (NAMES.every((name) => next[name].length === current[name].length)) {
            return current;
        }
        current = next;
    }
};

/** Files from before time and distance were counted on their own: minutes and meters were the value of a set */
const withCounts = (tables: tTables): tTables => {
    const legacy = new Map<string, string>();
    const exercises = (tables.exercises as iExercise[]).map((exercise) => {
        const unit: string = exercise.unit;
        if (unit === 'minutes') {
            legacy.set(exercise.id, unit);
            return { ...exercise, unit: 'none', timed: true, time_unit: 'minutes' } as iExercise;
        }
        if (unit === 'meters') {
            legacy.set(exercise.id, unit);
            return { ...exercise, unit: 'none', distanced: true, distance_unit: exercise.distanced ? 'km' : 'meters' } as iExercise;
        }
        return exercise.timed && !exercise.time_unit ? { ...exercise, time_unit: 'seconds' as const } : exercise;
    });
    if (!legacy.size) {
        return { ...tables, exercises };
    }
    const lines = new Map((tables.slots as iSlot[]).map((slot) => [slot.id, slot.exercise]));
    const entries = new Map((tables.entries as iEntry[]).map((entry) => [entry.id, entry.chosen || entry.slot]));
    const sets = (tables.sets as iSet[]).map((set) => {
        const unit = legacy.get(lines.get(entries.get(set.session_exercise) ?? '') ?? '');
        if (!unit || !set.value) {
            return set;
        }
        return unit === 'minutes'
            ? { ...set, seconds: Math.round(((set.seconds ?? 0) + set.value * 60) * 1000) / 1000, value: 0 }
            : { ...set, distance: Math.round(((set.distance ?? 0) + set.value / 1000) * 1e6) / 1e6, value: 0 };
    });
    return { ...tables, exercises, sets };
};

/** The tables of a file of one of the `types`, rows without an id or a required field left out. null if it is not such a file. */
const parseTables = (json: string, types: string[], complete = false): tTables | null => {
    try {
        const data = JSON.parse(json);
        if (!types.includes(data?.type) || typeof data.tables !== 'object' || data.tables === null) {
            return null;
        }
        if (complete && NAMES.some((name) => !Array.isArray(data.tables[name]))) {
            return null;
        }
        return withValidReferences(
            withCounts(Object.fromEntries(
                NAMES.map((name) => {
                    const rows: unknown[] = Array.isArray(data.tables[name]) ? data.tables[name] : [];
                    const required = REQUIRED[name];
                    const valid = rows.filter((row): row is iRow => {
                        const item = row as Record<string, unknown> | null;
                        return typeof item?.id === 'string' && item.id !== '' && (!required || typeof item[required] === 'string');
                    });
                    return [name, valid];
                }),
            )),
        );
    } catch {
        return null;
    }
};

const norm = (name: string) => name.trim().toLowerCase();

/**
 * What an import adds to `existing`: rows whose id is not there yet. An exercise with the name of one that is there is
 * not added twice, the rows of the file that use it use the existing one.
 */
const planImport = (existing: tTables, file: tTables): { added: tTables; count: number } => {
    const known = Object.fromEntries(NAMES.map((name) => [name, new Set(existing[name].map(({ id }) => id))]));
    const byName = new Map((existing.exercises as iExercise[]).map((exercise) => [norm(exercise.name), exercise.id]));
    const same = new Map<string, string>();
    for (const exercise of file.exercises as iExercise[]) {
        const match = byName.get(norm(exercise.name));
        if (!known.exercises.has(exercise.id) && match) {
            same.set(exercise.id, match);
        }
    }

    const candidates = Object.fromEntries(
        NAMES.map((name) => {
            const relations = Object.keys(relationsOf(name));
            const rows = file[name]
                .filter((row) => !known[name].has(row.id) && !(name === 'exercises' && same.has(row.id)))
                .map((row) => {
                    const copy = { ...row } as unknown as Record<string, unknown>;
                    relations.forEach((field) => same.has(copy[field] as string) && (copy[field] = same.get(copy[field] as string)));
                    return copy as unknown as iRow;
                });
            return [name, rows];
        }),
    );
    const valid = withValidReferences(Object.fromEntries(NAMES.map((name) => [name, [...existing[name], ...candidates[name]]])));
    const added = Object.fromEntries(
        NAMES.map((name) => {
            const ids = new Set(valid[name].map(({ id }) => id));
            return [name, candidates[name].filter(({ id }) => ids.has(id))];
        }),
    );
    return { added, count: NAMES.reduce((sum, name) => sum + added[name].length, 0) };
};

const cell = (value: string | number): string => (/[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value));

/** Every finished set as one line, to look at in a spreadsheet */
const logCsv = (tables: tTables): string => {
    const byId = <T extends iRow>(name: string) => new Map((tables[name] as T[]).map((row) => [row.id, row]));
    const [exercises, workouts, slots, sessions, entries] = [byId<iExercise>('exercises'), byId<iWorkout>('workouts'), byId<iSlot>('slots'), byId<iSession>('sessions'), byId<iEntry>('entries')];
    const lines = (tables.sets as iSet[])
        .filter((set) => set.done)
        .map((set) => {
            const entry = entries.get(set.session_exercise);
            const slot = slots.get(entry?.chosen || entry?.slot || '');
            const session = sessions.get(set.session);
            return { exercise: exercises.get(slot?.exercise ?? ''), order: [slot?.position ?? 0, set.position], session, set, workout: workouts.get(session?.workout ?? '') };
        })
        .sort((a, b) => (a.session?.date ?? '').localeCompare(b.session?.date ?? '') || (a.session?.id ?? '').localeCompare(b.session?.id ?? '') || a.order[0] - b.order[0] || a.order[1] - b.order[1]);
    const header = ['date', 'workout', 'exercise', 'set', 'type', 'unit', 'reps_or_minutes', 'kg', 'time_s', 'km', 'seconds'];
    const rows = lines.map(({ exercise, order, session, set, workout }) => [
        session?.date ?? '',
        workout?.name ?? '',
        exercise?.name ?? '',
        order[1] + 1,
        set.kind ?? '',
        exercise?.unit ?? '',
        set.value ?? 0,
        set.weight ?? 0,
        exercise?.timed ? (set.seconds ?? 0) : '',
        set.distance ?? '',
        set.started_at && set.ended_at ? Math.round((set.ended_at - set.started_at) / 1000) : '',
    ]);
    return [header, ...rows].map((row) => row.map(cell).join(',')).join('\n');
};

export type { tExportKind, tTables };
export { BACKUP_TYPE, EXPORT_TYPE, backupFile, exportFile, logCsv, parseTables, planImport };
