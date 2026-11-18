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
import type { iExercise } from '@/types';

interface iThumbProps {
    exercise?: iExercise;
    size?: 'large';
}

/** The picture of an exercise, its initials while it has none */
export const Thumb = ({ exercise, size }: iThumbProps) => (
    <span className={`thumb ${size ? `thumb--${size}` : ''}`}>
        {exercise?.image ? <img src={exercise.image} alt={exercise.name} /> : <span>{(exercise?.name ?? '?').slice(0, 2).toUpperCase()}</span>}
    </span>
);
