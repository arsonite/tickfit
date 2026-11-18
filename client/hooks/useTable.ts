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

// React imports
import { useCallback, useMemo, useRef, useState } from 'react';

// TeaType
import { mergeItems } from '@teatype/sync';

// Utility
import { newId } from '@/sync';

// Types
import type { iRow } from '@/types';

interface iTable<T extends iRow> {
    rows: T[];
    add: (data: Omit<T, 'id'>) => T;
    addMany: (list: Omit<T, 'id'>[]) => T[];
    /** Rows that are always the latest, also inside a function that started before the last render */
    current: () => T[];
    /** Takes what a sync ended with, rows that were changed meanwhile stay as they are */
    merge: (snapshot: T[], result: T[]) => void;
    patch: (id: string, data: Partial<T>) => void;
    remove: (ids: string[]) => void;
}

/**
 * The rows of one table. They live here and on the device, the sync (see useTickfit) takes care of the server.
 * Rows are replaced when they change, never mutated, which is how the sync tells what changed.
 */
const useTable = <T extends iRow>(initial: T[]): iTable<T> => {
    const [rows, setRows] = useState<T[]>(initial);
    const latest = useRef<T[]>(initial);

    const update = useCallback((change: (rows: T[]) => T[]) => {
        latest.current = change(latest.current);
        setRows(latest.current);
    }, []);

    const addMany = useCallback(
        (list: Omit<T, 'id'>[]) => {
            const added = list.map((data) => ({ ...data, id: newId() }) as T);
            update((rows) => [...rows, ...added]);
            return added;
        },
        [update],
    );

    const add = useCallback((data: Omit<T, 'id'>) => addMany([data])[0], [addMany]);

    const patch = useCallback(
        (id: string, data: Partial<T>) => update((rows) => rows.map((row) => (row.id === id ? { ...row, ...data } : row))),
        [update],
    );

    const remove = useCallback((ids: string[]) => update((rows) => rows.filter((row) => !ids.includes(row.id))), [update]);

    const merge = useCallback(
        (snapshot: T[], result: T[]) => update((rows) => mergeItems((row) => row.id, rows, snapshot, result)),
        [update],
    );

    const current = useCallback(() => latest.current, []);

    return useMemo(() => ({ rows, add, addMany, current, merge, patch, remove }), [rows, add, addMany, current, merge, patch, remove]);
};

export type { iTable };
export { useTable };
