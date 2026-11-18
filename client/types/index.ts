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

// The rows as the HSDB server delivers them (server/models), relations are the ids of the related rows

type tUnit = 'reps' | 'minutes' | 'meters';
type tKind = 'strength' | 'cardio' | 'rest';
type tStatus = 'planned' | 'done' | 'skipped';
type tSetKind = '' | 'DS' | 'P' | 'A'; // Drop set, partial, assisted

interface iRow {
    id: string;
}

interface iExercise extends iRow {
    image?: string;
    name: string;
    notes?: string;
    unit: tUnit;
    weighted?: boolean;
}

interface iWorkout extends iRow {
    focus?: string;
    kind: tKind;
    name: string;
    notes?: string;
    rest_seconds?: number;
    warmup?: string;
}

// A line of a workout, an alternative has the main line in alternative_of
interface iSlot extends iRow {
    alternative_of?: string | null;
    exercise: string;
    notes?: string;
    position: number;
    rep_max?: number;
    rep_min?: number;
    sets: number;
    superset?: boolean;
    workout: string;
}

interface iPlan extends iRow {
    active?: boolean;
    name: string;
    notes?: string;
}

interface iPlanDay extends iRow {
    plan: string;
    position: number;
    workout: string;
}

interface iSession extends iRow {
    date: string; // YYYY-MM-DD
    notes?: string;
    plan_day?: number;
    status: tStatus;
    workout: string;
}

interface iEntry extends iRow {
    chosen: string;
    notes?: string;
    session: string;
    slot: string;
}

interface iSet extends iRow {
    disabled?: boolean;
    done?: boolean;
    kind?: tSetKind;
    position: number;
    session: string;
    session_exercise: string;
    value?: number;
    weight?: number;
}

export type { iEntry, iExercise, iPlan, iPlanDay, iRow, iSession, iSet, iSlot, iWorkout, tKind, tSetKind, tStatus, tUnit };
