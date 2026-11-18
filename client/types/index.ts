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

// What the value of a set counts; 'none': no reps, only the time, the distance or the weight
type tUnit = 'reps' | 'none';
type tKind = 'strength' | 'cardio' | 'rest';
type tStatus = 'planned' | 'done' | 'skipped';
type tSetKind = '' | 'DS' | 'P' | 'A'; // Drop set, partial, assisted

interface iRow {
    id: string;
}

interface iExercise extends iRow {
    archived?: boolean; // Put away, kept for what was logged with it
    category?: string; // Free text to filter by, e.g. "pull"
    distance_unit?: 'km' | 'meters'; // Distance is entered in this, it is kept in km
    distanced?: boolean; // A set also has a distance
    image?: string;
    name: string;
    notes?: string;
    time_unit?: 'minutes' | 'seconds'; // Time is entered in this, it is kept in seconds
    timed?: boolean; // A set also has a time
    unit: tUnit;
    weighted?: boolean;
}

interface iWorkout extends iRow {
    archived?: boolean; // An older version, kept for what was logged with it
    family?: string; // Id of the first version, shared by all versions
    focus?: string;
    kind: tKind;
    name: string;
    notes?: string;
    rest_seconds?: number;
    version?: number;
    warmup?: string; // Old free text, replaced by lines that have warmup set
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
    superset?: boolean; // Done in turns with the line above
    warmup?: boolean; // A line of the warm-up, shown before the others
    workout: string;
}

interface iPlan extends iRow {
    active?: boolean; // Can be put on a week
    archived?: boolean; // Put away, never active
    default?: boolean; // The active plan that is offered first
    name: string;
    notes?: string;
}

interface iPlanDay extends iRow {
    plan: string;
    position: number;
    workout: string;
}

// started_at and the times of the sets are Unix ms, 0 = did not happen
interface iSession extends iRow {
    date: string; // YYYY-MM-DD
    finished_at?: number;
    notes?: string;
    plan_day?: number;
    started_at?: number;
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
    distance?: number; // km
    done?: boolean;
    ended_at?: number;
    kind?: tSetKind;
    position: number;
    rest_ended_at?: number;
    rest_started_at?: number;
    seconds?: number; // Time of the set, for an exercise that is timed
    session: string;
    session_exercise: string;
    started_at?: number;
    value?: number;
    weight?: number;
}

export type { iEntry, iExercise, iPlan, iPlanDay, iRow, iSession, iSet, iSlot, iWorkout, tKind, tSetKind, tStatus, tUnit };
