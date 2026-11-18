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
import { useCallback, useMemo, useState } from 'react';

// TeaType
import type { iUseTeaToastReturn } from '@teatype/components/TeaToast';
import { useSync, usePersist } from '@teatype/sync';
import type { iSyncReport } from '@teatype/sync';

// Hooks
import { useTable } from '@/hooks/useTable';
import type { iTable } from '@/hooks/useTable';

// Utility
import {
    COLLECTIONS,
    META_VERSION,
    entryCollection,
    exerciseCollection,
    localStore,
    planCollection,
    planDayCollection,
    sessionCollection,
    setCollection,
    slotCollection,
    workoutCollection,
} from '@/sync';
import { addDays, mondayOf, today } from '@/tools/dates';
import { extend, realign, shiftFrom, swap } from '@/tools/schedule';
import { EXERCISES, PLAN, WORKOUTS } from '@/tools/seed';

// Types
import type { iChanges } from '@/tools/schedule';
import type { iEntry, iExercise, iPlan, iPlanDay, iRow, iSession, iSet, iSlot, iWorkout } from '@/types';

const HORIZON_WEEKS = 26; // How far ahead the schedule is written

/** What the device had saved: one list per table and the sync meta, nothing on a first start */
type tStored = Record<string, unknown>;

const describe = (error: unknown): string => {
    const failure = error as { message?: string };
    return failure?.message ?? 'Unknown error';
};

const STORED_KEYS = [...COLLECTIONS.map((collection) => collection.name), 'sync'];

const listOf = <T,>(stored: tStored, name: string): T[] => (stored[name] as T[] | undefined) ?? [];

/**
 * Everything the app shows: the tables of the plan and the log, the schedule that is kept up to date on top of
 * them, and the changes the views make. All of it is on the device and changes are made there at once. The sync
 * (auto mode of @teatype/sync) sends them to the server whenever it can be reached, no matter if that is right away
 * or hours later, and brings in what other devices did.
 */
const useTickfit = ({ error: toastError, info, success }: iUseTeaToastReturn, stored: tStored) => {
    const onError = useCallback((error: unknown) => void toastError(describe(error)), [toastError]);

    const exercises = useTable<iExercise>(listOf(stored, 'exercises'));
    const workouts = useTable<iWorkout>(listOf(stored, 'workouts'));
    const plans = useTable<iPlan>(listOf(stored, 'plans'));
    const slots = useTable<iSlot>(listOf(stored, 'slots'));
    const planDays = useTable<iPlanDay>(listOf(stored, 'planDays'));
    const sessions = useTable<iSession>(listOf(stored, 'sessions'));
    const entries = useTable<iEntry>(listOf(stored, 'entries'));
    const sets = useTable<iSet>(listOf(stored, 'sets'));
    // Each table under the name of its collection, the sync and the local store only deal with them as a whole
    const tables = { entries, exercises, planDays, plans, sessions, sets, slots, workouts };
    const views = Object.entries(tables) as unknown as [string, Pick<iTable<iRow>, 'current' | 'merge' | 'rows'>][];

    // Without a sync meta nothing was ever synced from here, the first sync decides what the tables hold
    const [settled, setSettled] = useState(Boolean(stored.sync));

    const onSync = useCallback(
        (report: iSyncReport, { recovered }: { recovered: boolean }) => {
            setSettled(true);
            if (recovered && report.ok) {
                success(report.pushed ? `Back online, ${report.pushed} change${report.pushed > 1 ? 's' : ''} synced` : 'Back online');
            }
        },
        [success],
    );

    const sync = useSync<Record<string, object[]>>({
        mode: 'auto',
        collections: COLLECTIONS,
        version: META_VERSION,
        storedMeta: stored.sync,
        tracked: [
            { collection: exerciseCollection, items: exercises.rows },
            { collection: workoutCollection, items: workouts.rows },
            { collection: planCollection, items: plans.rows },
            { collection: slotCollection, items: slots.rows },
            { collection: planDayCollection, items: planDays.rows },
            { collection: sessionCollection, items: sessions.rows },
            { collection: entryCollection, items: entries.rows },
            { collection: setCollection, items: sets.rows },
        ],
        read: () => {
            const items = Object.fromEntries(views.map(([name, table]) => [name, table.current()]));
            return { items, context: items };
        },
        apply: (results, snapshot) => {
            for (const [name, table] of views) {
                table.merge(snapshot[name] as iRow[], results[name].items as iRow[]);
            }
        },
        onSync,
    });

    // One transaction, so the sync meta never says more than the saved tables
    usePersist(localStore, { ...Object.fromEntries(views.map(([name, table]) => [name, table.rows])), sync: sync.meta });

    // A device that never synced waits for the server before it shows an empty app, one that cannot reach it does not wait
    const load = settled || sync.status === 'offline' ? 'ready' : 'loading';

    const exerciseById = useMemo(() => new Map(exercises.rows.map((row) => [row.id, row])), [exercises.rows]);
    const workoutById = useMemo(() => new Map(workouts.rows.map((row) => [row.id, row])), [workouts.rows]);
    const slotById = useMemo(() => new Map(slots.rows.map((row) => [row.id, row])), [slots.rows]);

    const activePlan = plans.rows.find((plan) => plan.active);
    const cycleOf = useCallback(
        (plan: string) =>
            planDays
                .current()
                .filter((day) => day.plan === plan)
                .sort((a, b) => a.position - b.position)
                .map((day) => day.workout),
        [planDays],
    );

    /** The main lines of a workout in their order, each with the alternatives to it */
    const linesOf = useCallback(
        (workout: string) => {
            const own = slots.rows.filter((slot) => slot.workout === workout);
            return own
                .filter((slot) => !slot.alternative_of)
                .sort((a, b) => a.position - b.position)
                .map((main) => ({
                    main,
                    alternatives: own.filter((slot) => slot.alternative_of === main.id).sort((a, b) => a.position - b.position),
                }));
        },
        [slots.rows],
    );

    const isRest = useCallback((workout: string) => workoutById.get(workout)?.kind === 'rest', [workoutById]);

    // ---- Removing, with what hangs on it

    /** Removes the log entries that match, with their sets */
    const purgeEntries = useCallback(
        (matches: (entry: iEntry) => boolean) => {
            const gone = new Set(entries.current().filter(matches).map((entry) => entry.id));
            if (gone.size) {
                sets.remove(sets.current().filter((set) => gone.has(set.session_exercise)).map((set) => set.id));
                entries.remove([...gone]);
            }
        },
        [entries, sets],
    );

    const removeSessions = useCallback(
        (ids: string[]) => {
            purgeEntries((entry) => ids.includes(entry.session));
            sessions.remove(ids);
        },
        [purgeEntries, sessions],
    );

    const removeSlots = useCallback(
        (ids: string[]) => {
            const all = slots.current().filter((slot) => ids.includes(slot.id) || ids.includes(slot.alternative_of ?? '')).map((slot) => slot.id);
            purgeEntries((entry) => all.includes(entry.slot) || all.includes(entry.chosen));
            slots.remove(all);
        },
        [purgeEntries, slots],
    );

    const removeWorkout = useCallback(
        (id: string) => {
            removeSessions(sessions.current().filter((session) => session.workout === id).map((session) => session.id));
            removeSlots(slots.current().filter((slot) => slot.workout === id && !slot.alternative_of).map((slot) => slot.id));
            planDays.remove(planDays.current().filter((day) => day.workout === id).map((day) => day.id));
            workouts.remove([id]);
        },
        [planDays, removeSessions, removeSlots, sessions, slots, workouts],
    );

    const removeExercise = useCallback(
        (id: string) => {
            // Lines of it, and alternatives of other lines that use it
            removeSlots(slots.current().filter((slot) => slot.exercise === id).map((slot) => slot.id));
            exercises.remove([id]);
        },
        [exercises, removeSlots, slots],
    );

    // ---- The schedule

    const apply = useCallback(
        (changes: iChanges) => {
            if (changes.remove.length) {
                removeSessions(changes.remove);
            }
            changes.move.forEach((move) => sessions.patch(move.id, { date: move.date }));
            if (changes.create.length) {
                sessions.addMany(changes.create.map((draft) => ({ ...draft, status: 'planned' as const })));
            }
        },
        [removeSessions, sessions],
    );

    const upcoming = useCallback((from: string) => sessions.current().filter((session) => session.status === 'planned' && session.date >= from), [sessions]);

    /** Moves missed workouts to today and writes the schedule of the active plan up to a day */
    const ensure = useCallback(
        (until: string) => {
            // Another device may have written the schedule meanwhile, it is looked at after the first sync
            if (!activePlan || load !== 'ready') {
                return;
            }
            const now = today();
            const changes = realign(sessions.current(), now, isRest);
            if (changes.move.length || changes.remove.length) {
                apply(changes);
                const missed = changes.move.filter((move) => move.date >= now).length;
                info(missed ? 'Missed workouts were moved to the next free days' : 'Missed rest days were dropped');
            }
            const cap = addDays(now, HORIZON_WEEKS * 7);
            const drafts = extend(sessions.current(), cycleOf(activePlan.id), until > cap ? cap : until, mondayOf(now));
            if (drafts.length) {
                sessions.addMany(drafts.map((draft) => ({ ...draft, status: 'planned' as const })));
            }
        },
        [activePlan, apply, cycleOf, info, isRest, load, sessions],
    );

    /** Starts the schedule over from today with the first day of a plan */
    const restart = useCallback(
        (plan: string, until: string) => {
            const now = today();
            removeSessions(upcoming(now).map((session) => session.id));
            const kept = sessions.current().filter((session) => session.date >= now).map((session) => session.date).sort();
            const start = kept.length ? addDays(kept[kept.length - 1], 1) : now;
            const drafts = extend([], cycleOf(plan), until, start);
            sessions.addMany(drafts.map((draft) => ({ ...draft, status: 'planned' as const })));
        },
        [cycleOf, removeSessions, sessions, upcoming],
    );

    const activate = useCallback(
        (id: string) => {
            plans.current().forEach((plan) => plan.active !== (plan.id === id) && plans.patch(plan.id, { active: plan.id === id }));
            restart(id, addDays(mondayOf(today()), 13));
        },
        [plans, restart],
    );

    /** The schedule of the active plan is written again, after its days were changed */
    const rebuild = useCallback(() => {
        if (activePlan) {
            activate(activePlan.id);
            success('Upcoming days were rebuilt from the plan');
        }
    }, [activate, activePlan, success]);

    const removePlan = useCallback(
        (id: string) => {
            if (plans.current().find((plan) => plan.id === id)?.active) {
                removeSessions(upcoming(today()).map((session) => session.id));
            }
            planDays.remove(planDays.current().filter((day) => day.plan === id).map((day) => day.id));
            plans.remove([id]);
        },
        [planDays, plans, removeSessions, upcoming],
    );

    const moveDay = useCallback(
        (id: string, delta: number) => {
            const changes = swap(sessions.current(), id, delta);
            if (changes) {
                apply(changes);
            } else {
                info('That day is already done');
            }
        },
        [apply, sessions, info],
    );

    const shiftDay = useCallback(
        (id: string, delta: 1 | -1) => {
            const changes = shiftFrom(sessions.current(), id, delta);
            if (changes) {
                apply(changes);
            } else {
                info('The day before is not free');
            }
        },
        [apply, sessions, info],
    );

    const addDay = useCallback((date: string, workout: string) => sessions.add({ date, plan_day: -1, status: 'planned', workout }), [sessions]);

    const seed = useCallback(() => {
        const exerciseIds = new Map(exercises.addMany(EXERCISES).map((row) => [row.name, row.id]));
        const created = workouts.addMany(WORKOUTS.map(({ slots: _slots, ...workout }) => workout)); // eslint-disable-line @typescript-eslint/no-unused-vars
        const workoutIds = new Map(created.map((row) => [row.name, row.id]));

        const mains = WORKOUTS.flatMap((workout) =>
            workout.slots.map(({ alternatives: _alternatives, exercise, ...slot }, position) => ({ ...slot, exercise: exerciseIds.get(exercise) as string, position, workout: workoutIds.get(workout.name) as string })), // eslint-disable-line @typescript-eslint/no-unused-vars
        );
        const savedMains = slots.addMany(mains);
        const alternatives = WORKOUTS.flatMap((workout, workoutIndex) => {
            const offset = WORKOUTS.slice(0, workoutIndex).reduce((sum, w) => sum + w.slots.length, 0);
            return workout.slots.flatMap((slot, index) =>
                (slot.alternatives ?? []).map((alternative, position) => ({
                    alternative_of: savedMains[offset + index].id,
                    exercise: exerciseIds.get(alternative.exercise) as string,
                    position,
                    rep_max: alternative.rep_max,
                    rep_min: alternative.rep_min,
                    sets: slot.sets,
                    workout: workoutIds.get(workout.name) as string,
                })),
            );
        });
        slots.addMany(alternatives);

        const plan = plans.add({ name: PLAN.name, active: false });
        planDays.addMany(PLAN.days.map((name, position) => ({ plan: plan.id, position, workout: workoutIds.get(name) as string })));
        activate(plan.id);
        success('Example plan added');
    }, [activate, exercises, planDays, plans, slots, success, workouts]);

    return {
        activePlan,
        entries,
        exerciseById,
        load,
        planDays,
        plans,
        sessions,
        sets,
        slotById,
        slots,
        workoutById,
        workouts,
        exercises,

        sync: { save: sync.save, status: sync.status, unsavedCount: sync.unsavedCount },

        activate,
        addDay,
        ensure,
        linesOf,
        moveDay,
        onError,
        rebuild,
        removeExercise,
        removePlan,
        removeSessions,
        removeSlots,
        removeWorkout,
        seed,
        shiftDay,
    };
};

type tData = ReturnType<typeof useTickfit>;

export type { tData, tStored };
export { STORED_KEYS, useTickfit };
