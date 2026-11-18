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
import type { iSet, iWorkout } from '@/types';

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

export { clock, familyOf, hasOpenRest, isRunning };
