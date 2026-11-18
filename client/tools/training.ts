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
import type { iEntry, iExercise, iPlan, iPlanDay, iSession, iSet, iWorkout } from '@/types';

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

type tTimeUnit = 'minutes' | 'seconds';
type tDistanceUnit = 'km' | 'meters';

const timeUnit = (exercise: Pick<iExercise, 'time_unit'>): tTimeUnit => (exercise.time_unit === 'seconds' ? 'seconds' : 'minutes');
const distanceUnit = (exercise: Pick<iExercise, 'distance_unit'>): tDistanceUnit => (exercise.distance_unit === 'meters' ? 'meters' : 'km');

const rounded = (value: number): number => Math.round(value * 100) / 100;

/** Time is kept in seconds and distance in km, they are shown and entered in the unit of the exercise */
const timeShown = (seconds: number | undefined, exercise: iExercise): number => rounded((seconds ?? 0) / (timeUnit(exercise) === 'minutes' ? 60 : 1));
const timeStored = (shown: number, exercise: iExercise): number => Math.round(shown * (timeUnit(exercise) === 'minutes' ? 60 : 1));
const distanceShown = (km: number | undefined, exercise: iExercise): number => rounded((km ?? 0) * (distanceUnit(exercise) === 'meters' ? 1000 : 1));
const distanceStored = (shown: number, exercise: iExercise): number => Math.round((shown / (distanceUnit(exercise) === 'meters' ? 1000 : 1)) * 1e6) / 1e6;

/** The unit the stats count an exercise in: reps, else the time, else the distance */
const mainUnit = (exercise: iExercise): 'km' | 'meters' | 'minutes' | 'reps' | 'seconds' =>
    exercise.unit === 'reps' ? 'reps' : exercise.timed ? timeUnit(exercise) : distanceUnit(exercise);

/** What a set counts in the main unit of its exercise */
const valueOf = (set: Pick<iSet, 'distance' | 'seconds' | 'value'>, exercise: iExercise): number => {
    const unit = mainUnit(exercise);
    return unit === 'reps' ? (set.value ?? 0) : exercise.timed ? (set.seconds ?? 0) / (unit === 'minutes' ? 60 : 1) : (set.distance ?? 0) * (unit === 'meters' ? 1000 : 1);
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
        if (set.done && !set.disabled && (set.value || set.weight || set.seconds || set.distance) && done.has(set.session)) {
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

/**
 * What a week is made of: the name of the plan if the week is that plan (day by day from Monday, other days only
 * rest days), "custom" if days were added, changed or moved by hand, null if the week is empty. Workouts count by
 * family, so a version that was made later still matches.
 */
const weekPlan = (days: (iSession | undefined)[], plans: iPlan[], planDays: iPlanDay[], workoutOf: (id: string) => iWorkout | undefined): string | null => {
    if (!days.some(Boolean)) {
        return null;
    }
    const family = (id: string) => {
        const workout = workoutOf(id);
        return workout ? familyOf(workout) : id;
    };
    const match = [...plans]
        .sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)) || a.name.localeCompare(b.name))
        .find((plan) => {
            const own = planDays.filter((day) => day.plan === plan.id).sort((a, b) => a.position - b.position);
            return (
                own.length > 0 &&
                own.length <= days.length &&
                days.every((session, index) => (index < own.length ? session && family(session.workout) === family(own[index].workout) : !session || workoutOf(session.workout)?.kind === 'rest'))
            );
        });
    return match?.name ?? 'Custom';
};

export { clock, distanceShown, distanceStored, distanceUnit, familyOf, hasOpenRest, interleave, isOpen, isRunning, isTrained, mainUnit, suggestNext, timeShown, timeStored, timeUnit, trainedHistory, valueOf, weekPlan };
export type { iTrained };
