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
import type { iExercise, tKind } from '@/types';

// A start for the empty app: the plan of the spreadsheet this app replaces. Slots name their exercise, alternatives
// hang below the line they replace.

interface iSeedSlot {
    exercise: string;
    sets: number;
    alternatives?: { exercise: string; rep_max?: number; rep_min?: number }[];
    notes?: string;
    rep_max?: number;
    rep_min?: number;
    superset?: boolean;
    warmup?: boolean;
}

interface iSeedWorkout {
    kind: tKind;
    name: string;
    slots: iSeedSlot[];
    focus?: string;
    notes?: string;
    rest_seconds?: number;
}

// Rower, or one of the others instead
const WARMUP: iSeedSlot = {
    exercise: 'Rower',
    sets: 1,
    rep_min: 5,
    rep_max: 10,
    warmup: true,
    alternatives: [
        { exercise: 'Incline Treadmill (15°)', rep_min: 10, rep_max: 10 },
        { exercise: 'Stairmaster', rep_min: 10, rep_max: 10 },
        { exercise: 'Cycling', rep_min: 10, rep_max: 15 },
        { exercise: 'Jump Rope', rep_min: 5, rep_max: 10 },
    ],
};

const COUNTED: [string, 'reps' | 'minutes' | 'meters', boolean][] = [
    ['45° Leg Press', 'reps', true],
    ['Abductor Machine', 'reps', true],
    ['Adductor Machine', 'reps', true],
    ['Barbell Back Squat', 'reps', true],
    ['Barbell Row (Overhand)', 'reps', true],
    ['Cable Triceps Pushdown', 'reps', true],
    ['Dumbbell Chest Press', 'reps', true],
    ['Dumbbell Lateral Raises', 'reps', true],
    ['Dumbbell Preacher Curl', 'reps', true],
    ['Dumbbell Shoulder Press', 'reps', true],
    ['Dumbbell Shrugs', 'reps', true],
    ['Cycling', 'minutes', false],
    ['Face Pulls', 'reps', true],
    ['Frontal Cable Lateral Raises', 'reps', true],
    ['Frontal Planks', 'minutes', true],
    ['Forward-Leaning Seated Hamstring Curls', 'reps', true],
    ['Full Hammer Dumbbell Curls', 'reps', true],
    ['Incline Dumbbell Curls', 'reps', true],
    ['Incline Treadmill (15°)', 'minutes', false],
    ['Jogging', 'minutes', false],
    ['Jump Rope', 'minutes', false],
    ['Kegel Exercises', 'reps', false],
    ['Mag-Grip Lat Pulldown', 'reps', true],
    ['Overhead Triceps Cable Extension', 'reps', true],
    ['Pec-Deck', 'reps', true],
    ['Push-Ups', 'reps', false],
    ['Rower', 'minutes', false],
    ['Stairmaster', 'minutes', false],
    ['Standing Calf Raises', 'reps', true],
    ['Swimming', 'meters', false],
    ['V-Grip Cable Row', 'reps', true],
];

const EXERCISES: Omit<iExercise, 'id'>[] = COUNTED.map(([name, counted, weighted]) => ({
    name,
    weighted,
    ...(counted === 'minutes'
        ? { distance_unit: 'km', time_unit: 'minutes', timed: true, unit: 'none' }
        : counted === 'meters'
          ? { distance_unit: 'meters', distanced: true, unit: 'none' }
          : { unit: 'reps' }),
})) as Omit<iExercise, 'id'>[];

const upper = (name: string): iSeedWorkout => ({
    focus: 'Upper body',
    kind: 'strength',
    name,
    rest_seconds: 90,
    slots: [
        WARMUP,
        { exercise: 'Barbell Back Squat', sets: 3, rep_min: 8, rep_max: 12 },
        {
            exercise: 'Dumbbell Chest Press',
            sets: 3,
            rep_min: 8,
            rep_max: 12,
            alternatives: [{ exercise: 'Pec-Deck', rep_min: 8, rep_max: 12 }],
        },
        {
            exercise: 'Dumbbell Lateral Raises',
            sets: 3,
            rep_min: 10,
            rep_max: 15,
            superset: true,
            alternatives: [{ exercise: 'Frontal Cable Lateral Raises', rep_min: 10, rep_max: 15 }],
        },
        {
            exercise: 'Mag-Grip Lat Pulldown',
            sets: 3,
            rep_min: 8,
            rep_max: 12,
            alternatives: [{ exercise: 'V-Grip Cable Row', rep_min: 8, rep_max: 12 }],
        },
        {
            exercise: 'Dumbbell Preacher Curl',
            sets: 3,
            rep_min: 8,
            rep_max: 12,
            alternatives: [{ exercise: 'Incline Dumbbell Curls', rep_min: 8, rep_max: 12 }],
        },
        { exercise: 'Cable Triceps Pushdown', sets: 3, rep_min: 8, rep_max: 12 },
        { exercise: 'Standing Calf Raises', sets: 3, rep_min: 10, rep_max: 15, superset: true },
        { exercise: 'Forward-Leaning Seated Hamstring Curls', sets: 3, rep_min: 8, rep_max: 12 },
    ],
});

const WORKOUTS: iSeedWorkout[] = [
    upper('Full Body A1'),
    {
        focus: 'Lower body',
        kind: 'strength',
        name: 'Full Body B',
        rest_seconds: 90,
        slots: [
            WARMUP,
            { exercise: '45° Leg Press', sets: 3, rep_min: 8, rep_max: 12 },
            { exercise: 'Barbell Row (Overhand)', sets: 3, rep_min: 8, rep_max: 12 },
            { exercise: 'Dumbbell Shrugs', sets: 3, rep_min: 10, rep_max: 15, superset: true },
            { exercise: 'Face Pulls', sets: 3, rep_min: 12, rep_max: 15 },
            { exercise: 'Overhead Triceps Cable Extension', sets: 3, rep_min: 8, rep_max: 12 },
            { exercise: 'Full Hammer Dumbbell Curls', sets: 3, rep_min: 8, rep_max: 12 },
            { exercise: 'Dumbbell Shoulder Press', sets: 3, rep_min: 8, rep_max: 12, superset: true },
            { exercise: 'Adductor Machine', sets: 3, rep_min: 10, rep_max: 15 },
            { exercise: 'Abductor Machine', sets: 3, rep_min: 10, rep_max: 15, superset: true },
        ],
    },
    upper('Full Body A2'),
    {
        focus: 'Cardio and core',
        kind: 'cardio',
        name: 'Cardio + Core',
        slots: [
            {
                exercise: 'Jogging',
                sets: 1,
                rep_min: 30,
                rep_max: 60,
                alternatives: [
                    { exercise: 'Swimming', rep_min: 75, rep_max: 90 },
                    { exercise: 'Jump Rope', rep_min: 10, rep_max: 20 },
                ],
            },
            { exercise: 'Kegel Exercises', sets: 3, rep_min: 10, rep_max: 10 },
            { exercise: 'Push-Ups', sets: 3 },
            { exercise: 'Frontal Planks', sets: 3 },
        ],
    },
    {
        kind: 'rest',
        name: 'Rest',
        notes: 'Do nothing and be happy',
        slots: [{ exercise: 'Kegel Exercises', sets: 3, rep_min: 10, rep_max: 10, notes: 'Optional' }],
    },
];

// The days of the week in the order they repeat, by workout name
const PLAN = {
    name: 'Full-Body Week A',
    days: ['Full Body A1', 'Rest', 'Full Body B', 'Rest', 'Full Body A2', 'Cardio + Core', 'Cardio + Core'],
};

export type { iSeedSlot, iSeedWorkout };
export { EXERCISES, PLAN, WORKOUTS };
