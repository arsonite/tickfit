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
const ROOT = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/hsdb/files`;

const isData = (image?: string): boolean => Boolean(image?.startsWith('data:'));

/** Where the picture of an exercise is loaded from: a path of the server (rawfiles/<name>), or the data URL it still is on this device */
const fileUrl = (image: string): string => (image.startsWith('rawfiles/') ? `${ROOT}/${image.slice('rawfiles/'.length)}` : image);

/** Sends a picture that is still a data URL to the server, returns the path to keep with the exercise instead */
const uploadImage = async (image: string): Promise<string> => {
    const blob = await (await fetch(image)).blob();
    const response = await fetch(ROOT, { method: 'POST', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob });
    if (!response.ok) {
        throw new Error(`The picture was not accepted (${response.status})`);
    }
    return (await response.json()).path as string;
};

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

export { embedImages, fileUrl, isData, uploadImage };
