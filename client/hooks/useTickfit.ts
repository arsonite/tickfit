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
import { useTraining } from '@/hooks/useTraining';

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
import { today, weekDays } from '@/tools/dates';
import { EXERCISES, PLAN, WORKOUTS } from '@/tools/seed';
import { familyOf, isTrained } from '@/tools/training';

// Types
import type { iEntry, iExercise, iPlan, iPlanDay, iRow, iSession, iSet, iSlot, iWorkout } from '@/types';

/** What the device had saved: one list per table and the sync meta, nothing on a first start */
type tStored = Record<string, unknown>;

const describe = (error: unknown): string => {
    const failure = error as { message?: string };
    return failure?.message ?? 'Unknown error';
};

const STORED_KEYS = [...COLLECTIONS.map((collection) => collection.name), 'sync'];

const listOf = <T,>(stored: tStored, name: string): T[] => (stored[name] as T[] | undefined) ?? [];

/**
 * Everything the app shows: the tables of the plan and the log, and the changes the views make. All of it is on the
 * device and changes are made there at once. The sync (auto mode of @teatype/sync) sends them to the server whenever
 * it can be reached, no matter if that is right away or hours later, and brings in what other devices did.
 * Nothing is scheduled by itself: a day is on the calendar because it was put there, by hand or with a plan.
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

    // Older versions of a workout are only kept for what was logged with them
    const workoutList = useMemo(() => workouts.rows.filter((workout) => !workout.archived), [workouts.rows]);
    const training = useTraining(sessions, sets);
    // The day that is being trained: started and not finished
    const trainingSession = sessions.rows.find((session) => session.status === 'planned' && session.started_at && !session.finished_at);

    const activePlan = plans.rows.find((plan) => plan.active);

    /** The main lines of a workout, the warm-up first, each with the alternatives to it */
    const linesOf = useCallback(
        (workout: string) => {
            const own = slots.rows.filter((slot) => slot.workout === workout);
            return own
                .filter((slot) => !slot.alternative_of)
                .sort((a, b) => Number(Boolean(b.warmup)) - Number(Boolean(a.warmup)) || a.position - b.position)
                .map((main) => ({
                    main,
                    alternatives: own.filter((slot) => slot.alternative_of === main.id).sort((a, b) => a.position - b.position),
                }));
        },
        [slots.rows],
    );

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

    /** A workout with all its versions */
    const removeWorkout = useCallback(
        (id: string) => {
            const target = workouts.current().find((workout) => workout.id === id);
            const ids = workouts.current().filter((workout) => workout.id === id || (target && familyOf(workout) === familyOf(target))).map((workout) => workout.id);
            removeSessions(sessions.current().filter((session) => ids.includes(session.workout)).map((session) => session.id));
            removeSlots(slots.current().filter((slot) => ids.includes(slot.workout) && !slot.alternative_of).map((slot) => slot.id));
            planDays.remove(planDays.current().filter((day) => ids.includes(day.workout)).map((day) => day.id));
            workouts.remove(ids);
        },
        [planDays, removeSessions, removeSlots, sessions, slots, workouts],
    );

    // ---- Versions of a workout

    /** A workout that was trained (or is being) is history: its logs refer to its lines, so it must not change */
    const isLocked = useCallback((id: string) => sessions.current().some((session) => session.workout === id && (session.status === 'done' || session.started_at)), [sessions]);

    /**
     * What to edit when a workout is to be changed. One that was never trained is changed in place. Otherwise it becomes
     * an older version, kept as it was for the logs and the stats, and the changes go to a copy that takes over the
     * plan and the days that are still to come. The map says which line of the copy is which of the old one.
     */
    const editable = useCallback(
        (id: string): { id: string; slots: Map<string, string> } => {
            const lines = new Map<string, string>();
            const old = workouts.current().find((workout) => workout.id === id);
            if (!old || !isLocked(id)) {
                return { id, slots: lines };
            }
            const { id: _id, ...fields } = old; // eslint-disable-line @typescript-eslint/no-unused-vars
            const copy = workouts.add({ ...fields, archived: false, family: familyOf(old), version: (old.version || 1) + 1 });
            workouts.patch(old.id, { archived: true, family: familyOf(old) });

            const own = slots.current().filter((slot) => slot.workout === id);
            const mains = own.filter((slot) => !slot.alternative_of);
            const alternatives = own.filter((slot) => slot.alternative_of);
            const copies = slots.addMany(mains.map(({ id: _slot, ...slot }) => ({ ...slot, workout: copy.id }))); // eslint-disable-line @typescript-eslint/no-unused-vars
            mains.forEach((slot, index) => lines.set(slot.id, copies[index].id));
            const copiesOfAlternatives = slots.addMany(
                alternatives.map(({ id: _slot, ...slot }) => ({ ...slot, alternative_of: lines.get(slot.alternative_of as string), workout: copy.id })), // eslint-disable-line @typescript-eslint/no-unused-vars
            );
            alternatives.forEach((slot, index) => lines.set(slot.id, copiesOfAlternatives[index].id));

            planDays.current().filter((day) => day.workout === id).forEach((day) => planDays.patch(day.id, { workout: copy.id }));
            // Days that were not trained move on, their prepared lines belong to the old version and are made again when opened
            const ahead = sessions.current().filter((session) => session.workout === id && session.status === 'planned' && !session.started_at);
            purgeEntries((entry) => ahead.some((session) => session.id === entry.session));
            ahead.forEach((session) => sessions.patch(session.id, { workout: copy.id }));
            return { id: copy.id, slots: lines };
        },
        [isLocked, planDays, purgeEntries, sessions, slots, workouts],
    );

    const removeExercise = useCallback(
        (id: string) => {
            // Lines of it, and alternatives of other lines that use it
            removeSlots(slots.current().filter((slot) => slot.exercise === id).map((slot) => slot.id));
            exercises.remove([id]);
        },
        [exercises, removeSlots, slots],
    );

    // ---- The calendar: days are put there by hand, nothing is scheduled by itself

    const activate = useCallback(
        (id: string) => plans.current().forEach((plan) => plan.active !== (plan.id === id) && plans.patch(plan.id, { active: plan.id === id })),
        [plans],
    );

    const removePlan = useCallback(
        (id: string) => {
            planDays.remove(planDays.current().filter((day) => day.plan === id).map((day) => day.id));
            plans.remove([id]);
        },
        [planDays, plans],
    );

    /** Moves a day to another date, the day that is there changes places with it. Days that were trained stay. */
    const moveDay = useCallback(
        (id: string, date: string) => {
            const mine = sessions.current().find((session) => session.id === id);
            if (!mine || mine.date === date) {
                return;
            }
            const other = sessions.current().find((session) => session.date === date);
            if (isTrained(mine) || isTrained(other)) {
                info('A day that was trained stays where it is');
                return;
            }
            sessions.patch(id, { date });
            if (other) {
                sessions.patch(other.id, { date: mine.date });
            }
        },
        [info, sessions],
    );

    /** Puts the days of a plan on the free days of a week, in their order from Monday. Days that are there are left alone. */
    const applyPlan = useCallback(
        (plan: string, monday: string) => {
            const days = planDays.current().filter((day) => day.plan === plan).sort((a, b) => a.position - b.position);
            const taken = new Set(sessions.current().map((session) => session.date));
            const drafts = weekDays(monday)
                .map((date, index) => ({ date, day: days[index] }))
                .filter(({ date, day }) => day && !taken.has(date))
                .map(({ date, day }) => ({ date, plan_day: -1, status: 'planned' as const, workout: day.workout }));
            sessions.addMany(drafts);
            if (drafts.length) {
                success(`${drafts.length} day${drafts.length > 1 ? 's' : ''} added`);
            } else {
                info('Every day of the week has something already');
            }
        },
        [info, planDays, sessions, success],
    );

    // What an older version of the app wrote ahead: days of a plan that nobody put there, from today on
    const isAutoPlanned = (session: iSession): boolean => session.status === 'planned' && !session.started_at && (session.plan_day ?? -1) >= 0 && session.date >= today();
    const autoPlanned = sessions.rows.filter(isAutoPlanned).length;

    const clearAutoPlanned = useCallback(() => {
        const ids = sessions.current().filter(isAutoPlanned).map((session) => session.id);
        removeSessions(ids);
        success(`${ids.length} day${ids.length === 1 ? '' : 's'} removed`);
    }, [removeSessions, sessions, success]);

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
        workoutList,
        workouts,
        exercises,
        training: { ...training, session: trainingSession },

        sync: { save: sync.save, status: sync.status, unsavedCount: sync.unsavedCount },

        activate,
        addDay,
        applyPlan,
        autoPlanned,
        clearAutoPlanned,
        editable,
        isLocked,
        linesOf,
        moveDay,
        onError,
        removeExercise,
        removePlan,
        removeSessions,
        removeSlots,
        removeWorkout,
        seed,
    };
};

type tData = ReturnType<typeof useTickfit>;

export type { tData, tStored };
export { STORED_KEYS, useTickfit };
