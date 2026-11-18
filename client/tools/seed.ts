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
import type { tKind, tUnit } from '@/types';

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
}

interface iSeedWorkout {
    kind: tKind;
    name: string;
    slots: iSeedSlot[];
    focus?: string;
    notes?: string;
    rest_seconds?: number;
    warmup?: string;
}

const WARMUP = 'Rower 5 min, or 15° incline treadmill / Stairmaster 10 min, or bike to the gym / jump rope';

const EXERCISES: { name: string; unit: tUnit; weighted: boolean }[] = [
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
    ['Face Pulls', 'reps', true],
    ['Frontal Cable Lateral Raises', 'reps', true],
    ['Frontal Planks', 'minutes', true],
    ['Forward-Leaning Seated Hamstring Curls', 'reps', true],
    ['Full Hammer Dumbbell Curls', 'reps', true],
    ['Incline Dumbbell Curls', 'reps', true],
    ['Jogging', 'minutes', false],
    ['Jump Rope', 'minutes', false],
    ['Kegel Exercises', 'reps', false],
    ['Mag-Grip Lat Pulldown', 'reps', true],
    ['Overhead Triceps Cable Extension', 'reps', true],
    ['Pec-Deck', 'reps', true],
    ['Push-Ups', 'reps', false],
    ['Standing Calf Raises', 'reps', true],
    ['Swimming', 'meters', false],
    ['V-Grip Cable Row', 'reps', true],
].map(([name, unit, weighted]) => ({ name, unit, weighted }) as { name: string; unit: tUnit; weighted: boolean });

const upper = (name: string): iSeedWorkout => ({
    focus: 'Upper body',
    kind: 'strength',
    name,
    rest_seconds: 90,
    warmup: WARMUP,
    slots: [
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
        warmup: WARMUP,
        slots: [
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
