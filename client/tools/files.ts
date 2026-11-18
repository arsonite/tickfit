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
import type { iExercise, iRow } from '@/types';

type tTables = Record<string, iRow[]>;

// Same origin as the HSDB api, the vite proxy and the nginx of homepie forward /hsdb to the server
const ROOT = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/hsdb`;

/**
 * Where the picture of an exercise is loaded from: the path the server keeps in the exercise (rawfiles/image/<hash>.<ext>),
 * or the data URL it still is on this device. The server turns the data URL into a file when the exercise is synced.
 */
const fileUrl = (image: string): string => (image.startsWith('rawfiles/') ? `${ROOT}/${image}` : image);

const toDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });

/** The tables with the pictures inside the rows again, for files that are meant to be restored somewhere else */
const embedImages = async (tables: tTables): Promise<tTables> => {
    const exercises = await Promise.all(
        (tables.exercises as iExercise[]).map(async (exercise) => {
            if (!exercise.image?.startsWith('rawfiles/')) {
                return exercise;
            }
            try {
                const response = await fetch(fileUrl(exercise.image));
                return response.ok ? { ...exercise, image: await toDataUrl(await response.blob()) } : exercise;
            } catch {
                return exercise; // Offline: the path stays, it works again on this server
            }
        }),
    );
    return { ...tables, exercises };
};

export { embedImages, fileUrl };
