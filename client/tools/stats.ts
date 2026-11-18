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

// Utility
import { addDays, calendarWeek, mondayOf, today as todayISO } from '@/tools/dates';
import { familyOf, mainUnit } from '@/tools/training';

// Types
import type { iEntry, iExercise, iPlan, iPlanDay, iSession, iSet, iSlot, iWorkout, tSetKind } from '@/types';

/*
 * What counts, in short:
 * - Only sets that are done and not disabled, of sessions that are done, in the date range.
 * - The exercise of a set is the one that was chosen (entry.chosen), so an alternative counts for itself.
 * - Sets, reps and training volume (kg x reps, only exercises counted in reps with a weight) include normal sets, drop
 *   sets and partials. Assisted sets (A) are left out of volume: their weight is help, not load.
 * - Records (PRs) only come from normal sets and drop sets. Partials are a shorter range, assisted sets are eased.
 *   A drop set is a full set at its own weight, so it may set a record (it can never be the heaviest of its session).
 * - The estimated 1RM (Epley) is only taken from sets up to 12 reps, the formula is not meant for more.
 * - A "PR" needs something to beat: what is done in the first session of an exercise is its start, not a record.
 */

const RECENT_DAYS = 30;
const EPLEY_MAX_REPS = 12;

interface iStatsInput {
    entries: iEntry[];
    exercises: iExercise[];
    planDays: iPlanDay[];
    plans: iPlan[];
    sessions: iSession[];
    sets: iSet[];
    slots: iSlot[];
    workouts: iWorkout[];
}

/** Dates are YYYY-MM-DD, a missing side is open */
interface iRange {
    from?: string;
    to?: string;
}

type tRangeKind = 'all' | 'custom' | 'weeks12' | 'year';

// A set of a done session with its exercise (the chosen one) resolved
interface iLog {
    alternative: boolean; // Done in place of the main exercise of its line
    date: string;
    entry: string;
    exercise: iExercise;
    kind: tSetKind;
    replaced?: string; // The exercise that the line is for, when it differs
    session: string;
    set: iSet;
    value: number; // Reps, minutes or meters
    volume: number;
    weight: number;
}

interface iStatsContext {
    input: iStatsInput;
    logs: iLog[];
    sessions: iSession[]; // Done, in range
}

interface iWeek {
    key: string; // The Monday
    label: string; // 2026 KW47
    minutes: number | null; // null: none of the sessions has times
    reps: number;
    sessions: number;
    sets: number;
    timed: number; // Sessions that have times
    volume: number;
}

type tRecordKind = 'e1rm' | 'value' | 'volume' | 'weight';

interface iRecord {
    date: string;
    kind: tRecordKind;
    recent: boolean;
    reps?: number; // Value of the set
    value: number;
    weight?: number;
}

interface iPRBoard {
    exercise: iExercise;
    last: string;
    records: iRecord[];
    repsAtWeight: { date: string; recent: boolean; reps: number; weight: number }[]; // Heaviest first
}

interface iPREvent {
    date: string;
    exercise: iExercise;
    kind: tRecordKind;
    previous: number;
    reps?: number;
    value: number;
    weight?: number;
}

interface iExerciseTotals {
    alternatives: number; // Sessions in which it was done in place of another exercise
    exercise: iExercise;
    first: string;
    last: string;
    reps: number; // Reps, for exercises counted in minutes or meters the sum of those
    sessions: number;
    sets: number;
    volume: number;
}

interface iExerciseSession {
    alternative: boolean;
    date: string;
    entryNotes: string[];
    label: string; // 9 × 75, 7 × 75 DS
    session: string;
    sets: iLog[];
}

interface iPoint {
    date: string;
    e1rm: number | null;
    top: number | null; // Best weight, for exercises without weight the best value
    volume: number; // Volume, for exercises that are not weighted reps the sum of the values
}

interface iExerciseDetail {
    comments: { date: string; text: string }[]; // The notes of the latest sessions
    points: iPoint[];
    replacedBy: { exercise: iExercise; sessions: number }[];
    sessions: iExerciseSession[]; // Latest first
    totals?: iExerciseTotals;
}

interface iPlanStats {
    first: string;
    id: string;
    last: string;
    name: string;
    plan?: iPlan; // Missing for the sessions of workouts that no plan has
    shared: number; // Workouts that are in another plan as well
    sessions: number;
    volume: number;
    weeks: number;
}

const isWeightedReps = (exercise: iExercise): boolean => Boolean(exercise.weighted) && mainUnit(exercise) === 'reps';

const isRecordSet = (log: iLog): boolean => !log.kind || log.kind === 'DS';

const sum = (list: number[]): number => list.reduce((total, value) => total + value, 0);

const epley = (weight: number, reps: number): number => (reps === 1 ? weight : weight * (1 + reps / 30));

const byDate = (a: { date: string }, b: { date: string }): number => a.date.localeCompare(b.date);

const inRange = (date: string, range: iRange): boolean => (!range.from || date >= range.from) && (!range.to || date <= range.to);

/** The range of a choice, custom comes with its own dates */
const rangeOf = (kind: tRangeKind, now: string = todayISO(), custom: iRange = {}): iRange => {
    if (kind === 'weeks12') {
        return { from: addDays(mondayOf(now), -11 * 7) };
    }
    if (kind === 'year') {
        return { from: `${now.slice(0, 4)}-01-01`, to: `${now.slice(0, 4)}-12-31` };
    }
    return kind === 'custom' ? custom : {};
};

/** 1.234,5 -> "1,234.5", one decimal at most */
const formatNumber = (value: number): string => value.toLocaleString('en-GB', { maximumFractionDigits: 1 });

/** 75 -> "1 h 15 min", 45 -> "45 min" */
const formatMinutes = (minutes: number): string => {
    const total = Math.round(minutes);
    return total >= 60 ? `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')} min` : `${total} min`;
};

const UNIT_LABEL = { km: 'km', meters: 'm', minutes: 'min', reps: 'reps' };

const unitOf = (exercise: iExercise): string => UNIT_LABEL[mainUnit(exercise)];

/** "9 × 75kg", "9", "12min", "45s", "5.2km · 45s", "400m × 20kg" and DS / P / A behind a set that is not a normal one */
const formatSet = (exercise: iExercise, log: Pick<iLog, 'kind' | 'value' | 'weight'> & { distance?: number; seconds?: number }): string => {
    const parts: string[] = [];
    if (exercise.unit === 'reps') {
        parts.push(formatNumber(log.value));
    } else if (exercise.unit === 'minutes') {
        parts.push(`${formatNumber(log.value)}min`);
    } else if (exercise.unit === 'meters') {
        parts.push(`${formatNumber(log.value)}m`);
    }
    if (exercise.timed && exercise.unit !== 'minutes' && log.seconds) {
        parts.push(`${formatNumber(log.seconds)}s`);
    }
    if (exercise.distanced && log.distance) {
        parts.push(`${formatNumber(log.distance)}km`);
    }
    const amount = parts.join(' · ');
    const weight = exercise.weighted && log.weight > 0 ? `${formatNumber(log.weight)}kg` : '';
    const text = weight ? (amount ? (exercise.unit === 'reps' ? `${amount} × ${weight}` : `${amount} · ${weight}`) : weight) : amount;
    return log.kind ? `${text} ${log.kind}` : text;
};

/** The sets that count, each with its exercise resolved through the chosen line of its entry */
const buildStats = (input: iStatsInput, range: iRange = {}): iStatsContext => {
    const sessions = input.sessions.filter((session) => session.status === 'done' && inRange(session.date, range));
    const sessionById = new Map(sessions.map((session) => [session.id, session]));
    const exerciseById = new Map(input.exercises.map((exercise) => [exercise.id, exercise]));
    const slotById = new Map(input.slots.map((slot) => [slot.id, slot]));
    const entryById = new Map(input.entries.map((entry) => [entry.id, entry]));

    const logs: iLog[] = [];
    for (const set of input.sets) {
        const session = sessionById.get(set.session);
        const entry = entryById.get(set.session_exercise);
        if (!session || !entry || !set.done || set.disabled) {
            continue;
        }
        const chosen = slotById.get(entry.chosen || entry.slot);
        const exercise = chosen && exerciseById.get(chosen.exercise);
        if (!chosen || !exercise) {
            continue;
        }
        const main = slotById.get(entry.slot);
        const kind = set.kind ?? '';
        const value = exercise.unit === 'none' ? (exercise.timed ? (set.seconds ?? 0) / 60 : (set.distance ?? 0)) : (set.value ?? 0);
        const weight = set.weight ?? 0;
        const alternative = Boolean(chosen.alternative_of) || (Boolean(main) && main?.id !== chosen.id);
        logs.push({
            alternative,
            date: session.date,
            entry: entry.id,
            exercise,
            kind,
            replaced: alternative && main && main.exercise !== chosen.exercise ? main.exercise : undefined,
            session: session.id,
            set,
            value,
            volume: isWeightedReps(exercise) && kind !== 'A' ? value * weight : 0,
            weight,
        });
    }
    logs.sort((a, b) => a.date.localeCompare(b.date) || a.session.localeCompare(b.session) || a.set.position - b.set.position);
    return { input, logs, sessions };
};

// ---- Weeks

const minutesOf = (session: iSession): number | null => {
    const start = session.started_at ?? 0;
    const end = session.finished_at ?? 0;
    return start > 0 && end > start ? (end - start) / 60000 : null;
};

const weekLabel = (monday: string): string => {
    const { week, year } = calendarWeek(monday);
    return `${year} KW${String(week).padStart(2, '0')}`;
};

/** Every calendar week from the first to the last session, oldest first, weeks without a session are zeros */
const weeklyStats = ({ logs, sessions }: iStatsContext): iWeek[] => {
    if (!sessions.length) {
        return [];
    }
    const weeks = new Map<string, iWeek>();
    const week = (date: string): iWeek => {
        const key = mondayOf(date);
        if (!weeks.has(key)) {
            weeks.set(key, { key, label: weekLabel(key), minutes: null, reps: 0, sessions: 0, sets: 0, timed: 0, volume: 0 });
        }
        return weeks.get(key) as iWeek;
    };

    const dates = sessions.map((session) => session.date).sort();
    for (let monday = mondayOf(dates[0]); monday <= mondayOf(dates[dates.length - 1]); monday = addDays(monday, 7)) {
        week(monday);
    }
    for (const session of sessions) {
        const row = week(session.date);
        const minutes = minutesOf(session);
        row.sessions += 1;
        if (minutes !== null) {
            row.minutes = (row.minutes ?? 0) + minutes;
            row.timed += 1;
        }
    }
    for (const log of logs) {
        const row = week(log.date);
        row.sets += 1;
        row.reps += mainUnit(log.exercise) === 'reps' ? log.value : 0;
        row.volume += log.volume;
    }
    return [...weeks.values()].sort((a, b) => a.key.localeCompare(b.key));
};

/** The change to the week before, null where one of the two is unknown */
const delta = (current: number | null, previous: number | null | undefined): number | null =>
    current === null || previous === null || previous === undefined ? null : current - previous;

// ---- Records

const groupBy = <T>(list: T[], key: (item: T) => string): Map<string, T[]> => {
    const groups = new Map<string, T[]>();
    for (const item of list) {
        const key_ = key(item);
        groups.set(key_, [...(groups.get(key_) ?? []), item]);
    }
    return groups;
};

// The sets of one session that set a record, per kind: the best one of the session
const candidates = (exercise: iExercise, logs: iLog[]): Map<tRecordKind, { reps?: number; value: number; weight?: number }> => {
    const best = new Map<tRecordKind, { reps?: number; value: number; weight?: number }>();
    const offer = (kind: tRecordKind, value: number, log: iLog) => {
        if (value > 0 && value > (best.get(kind)?.value ?? 0)) {
            best.set(kind, { reps: log.value, value, weight: log.weight || undefined });
        }
    };
    for (const log of logs.filter(isRecordSet)) {
        if (exercise.weighted && log.weight > 0) {
            // A heavier set wins, with the same weight the one with more reps
            const heavier = !best.has('weight') || log.weight > (best.get('weight')?.value ?? 0) || (log.weight === best.get('weight')?.value && log.value > (best.get('weight')?.reps ?? 0));
            if (heavier) {
                best.set('weight', { reps: log.value, value: log.weight, weight: log.weight });
            }
        }
        if (isWeightedReps(exercise)) {
            offer('volume', log.weight * log.value, log);
            if (log.value <= EPLEY_MAX_REPS) {
                offer('e1rm', epley(log.weight, log.value), log);
            }
        } else {
            offer('value', log.value, log);
        }
    }
    return best;
};

/** The records of every exercise and the records that were broken (newest first), "recent" is within the last 30 days */
const personalRecords = ({ logs }: iStatsContext, now: string = todayISO()): { boards: iPRBoard[]; recent: iPREvent[] } => {
    const cutoff = addDays(now, -RECENT_DAYS);
    const boards: iPRBoard[] = [];
    const events: iPREvent[] = [];

    for (const list of groupBy(logs, (log) => log.exercise.id).values()) {
        const exercise = list[0].exercise;
        const days = [...groupBy(list, (log) => log.session).values()]; // Oldest first, the logs are sorted
        const start = days[0][0].date;
        const best = new Map<tRecordKind, iRecord>();
        const atWeight = new Map<number, { date: string; reps: number }>();

        for (const day of days) {
            const date = day[0].date;
            for (const [kind, found] of candidates(exercise, day)) {
                const record = best.get(kind);
                if (!record || found.value > record.value) {
                    best.set(kind, { ...found, date, kind, recent: false });
                    if (record && kind !== 'volume') {
                        events.push({ ...found, date, exercise, kind, previous: record.value });
                    }
                }
            }
            if (isWeightedReps(exercise)) {
                for (const log of day.filter((item) => isRecordSet(item) && item.weight > 0)) {
                    if (log.value > (atWeight.get(log.weight)?.reps ?? 0)) {
                        atWeight.set(log.weight, { date, reps: log.value });
                    }
                }
            }
        }

        const recent = (date: string) => date >= cutoff && date > start;
        const records = [...best.values()].map((record) => ({ ...record, recent: recent(record.date) }));
        if (records.length) {
            boards.push({
                exercise,
                last: days[days.length - 1][0].date,
                records,
                repsAtWeight: [...atWeight].map(([weight, { date, reps }]) => ({ date, recent: recent(date), reps, weight })).sort((a, b) => b.weight - a.weight),
            });
        }
    }
    boards.sort((a, b) => a.exercise.name.localeCompare(b.exercise.name));
    return { boards, recent: events.filter((event) => event.date >= cutoff).sort((a, b) => b.date.localeCompare(a.date) || a.exercise.name.localeCompare(b.exercise.name)) };
};

// ---- Exercises

const totalsOf = (list: iLog[]): iExerciseTotals => {
    const dates = list.map((log) => log.date).sort();
    const own = list[0].exercise;
    return {
        alternatives: new Set(list.filter((log) => log.alternative).map((log) => log.session)).size,
        exercise: own,
        first: dates[0],
        last: dates[dates.length - 1],
        reps: sum(list.map((log) => log.value)),
        sessions: new Set(list.map((log) => log.session)).size,
        sets: list.length,
        volume: sum(list.map((log) => log.volume)),
    };
};

const exerciseTotals = ({ logs }: iStatsContext): iExerciseTotals[] => [...groupBy(logs, (log) => log.exercise.id).values()].map(totalsOf);

/** Everything about one exercise: totals, progression, every session with its sets, the comments of the latest ones */
const exerciseDetail = ({ input, logs, sessions }: iStatsContext, id: string): iExerciseDetail => {
    const own = logs.filter((log) => log.exercise.id === id);
    if (!own.length) {
        return { comments: [], points: [], replacedBy: [], sessions: [] };
    }
    const exercise = own[0].exercise;
    const dateOf = new Map(sessions.map((session) => [session.id, session.date]));
    const notes = groupBy(
        input.entries.filter((entry) => entry.notes?.trim() && dateOf.has(entry.session)),
        (entry) => entry.session,
    );

    const days = [...groupBy(own, (log) => log.session).entries()].map(([session, list]) => ({
        alternative: list.some((log) => log.alternative),
        date: list[0].date,
        entryNotes: (notes.get(session) ?? []).filter((entry) => list.some((log) => log.entry === entry.id)).map((entry) => (entry.notes as string).trim()),
        label: list.map((log) => formatSet(exercise, { ...log, distance: log.set.distance, seconds: log.set.seconds })).join(', '),
        session,
        sets: list,
    }));

    const points = days.map(({ date, sets }): iPoint => {
        const counted = sets.filter(isRecordSet);
        const weights = counted.map((log) => log.weight);
        const values = counted.map((log) => log.value);
        const e1rms = isWeightedReps(exercise) ? counted.filter((log) => log.weight > 0 && log.value <= EPLEY_MAX_REPS).map((log) => epley(log.weight, log.value)) : [];
        const weighted = Boolean(exercise.weighted) && Math.max(0, ...weights) > 0;
        const top = weighted ? Math.max(...weights) : Math.max(0, ...values);
        return {
            date,
            e1rm: e1rms.length ? Math.max(...e1rms) : null,
            top: top > 0 ? top : null,
            volume: isWeightedReps(exercise) ? sum(sets.map((log) => log.volume)) : sum(sets.map((log) => log.value)),
        };
    });

    const replaced = groupBy(
        logs.filter((log) => log.replaced === id),
        (log) => log.exercise.id,
    );
    const comments = days
        .filter((day) => day.entryNotes.length)
        .sort(byDate)
        .reverse()
        .slice(0, 5)
        .flatMap((day) => day.entryNotes.map((text) => ({ date: day.date, text })));

    return {
        comments,
        points,
        replacedBy: [...replaced.values()]
            .map((list) => ({ exercise: list[0].exercise, sessions: new Set(list.map((log) => log.session)).size }))
            .sort((a, b) => b.sessions - a.sessions),
        sessions: [...days].sort(byDate).reverse(),
        totals: totalsOf(own),
    };
};

// ---- Plans

/**
 * A plan owns the workouts it has days of, all versions of one workout (the family) count. A workout can be in several
 * plans, its sessions are then counted for each. Sessions of workouts that no plan has are listed as one more entry.
 */
const planStats = ({ input, logs, sessions }: iStatsContext): iPlanStats[] => {
    const familyByWorkout = new Map(input.workouts.map((workout) => [workout.id, familyOf(workout)]));
    const familiesOf = (plan: string) => new Set(input.planDays.filter((day) => day.plan === plan && familyByWorkout.has(day.workout)).map((day) => familyByWorkout.get(day.workout) as string));
    const owned = new Map(input.plans.map((plan) => [plan.id, familiesOf(plan.id)]));
    const planned = new Set([...owned.values()].flatMap((families) => [...families]));

    const volumeOf = new Map<string, number>();
    for (const log of logs) {
        volumeOf.set(log.session, (volumeOf.get(log.session) ?? 0) + log.volume);
    }

    const stats = (id: string, name: string, belongs: (family: string) => boolean, shared: number, plan?: iPlan): iPlanStats => {
        const mine = sessions.filter((session) => belongs(familyByWorkout.get(session.workout) ?? session.workout));
        const dates = mine.map((session) => session.date).sort();
        return {
            first: dates[0] ?? '',
            id,
            last: dates[dates.length - 1] ?? '',
            name,
            plan,
            sessions: mine.length,
            shared,
            volume: sum(mine.map((session) => volumeOf.get(session.id) ?? 0)),
            weeks: new Set(dates.map(mondayOf)).size,
        };
    };

    const rows = input.plans.map((plan) => {
        const families = owned.get(plan.id) as Set<string>;
        const shared = [...families].filter((family) => input.plans.some((other) => other.id !== plan.id && owned.get(other.id)?.has(family))).length;
        return stats(plan.id, plan.name, (family) => families.has(family), shared, plan);
    });
    const loose = stats('', 'Not in a plan', (family) => !planned.has(family), 0);
    return [...rows.sort((a, b) => b.last.localeCompare(a.last) || a.name.localeCompare(b.name)), ...(loose.sessions ? [loose] : [])];
};

export type { iExerciseDetail, iExerciseSession, iExerciseTotals, iLog, iPlanStats, iPoint, iPREvent, iPRBoard, iRange, iRecord, iStatsContext, iStatsInput, iWeek, tRangeKind, tRecordKind };
export { buildStats, delta, epley, exerciseDetail, exerciseTotals, formatMinutes, formatNumber, formatSet, inRange, personalRecords, planStats, rangeOf, unitOf, weeklyStats };
