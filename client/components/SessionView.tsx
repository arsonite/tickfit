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
import { useEffect, useMemo, useRef } from 'react';

// TeaType
import { TeaButton, TeaTextarea } from '@teatype/components';

// Components
import { Thumb } from '@/components/Thumb';
import { TrainBar } from '@/components/TrainBar';

// Hooks
import type { tData } from '@/hooks/useTickfit';
import { useNow } from '@/hooks/useNow';

// Utility
import { shortDate, today, weekdayName } from '@/tools/dates';
import { clock, familyOf, interleave, isOpen, isRunning, suggestNext, trainedHistory, transitionBefore } from '@/tools/training';
import type { iTrained } from '@/tools/training';

// Types
import type { iSet, iSlot, tSetKind, tUnit } from '@/types';

interface iSessionViewProps {
    data: tData;
    /** Pause between sets (s) for a workout that has none of its own */
    defaultRest: number;
    sessionId: string;
    vibrate: boolean;

    onBack: () => void;
}

const UNIT_LABEL: Record<tUnit, string> = { meters: 'm', minutes: 'min', reps: 'reps' };
const NEXT_KIND: Record<string, tSetKind> = { '': 'DS', DS: 'P', P: 'A', A: '' };
const KIND_TITLE: Record<string, string> = { '': 'Normal set', A: 'Assisted', DS: 'Drop set', P: 'Partial' };

const LETTERS = 'ABCDEFGH';

const byPosition = (a: iSet, b: iSet) => a.position - b.position;

const number = (text: string): number => Number(text.replace(',', '.')) || 0;

const target = (sets: number, min?: number, max?: number): string => {
    const reps = min && max && min !== max ? `${min}–${max}` : `${min || max || ''}`;
    return reps ? `${sets} × ${reps}` : `${sets} ×`;
};

/** One day of training: the lines of the workout, the sets of each, and what was done the time before */
export const SessionView = ({ data, defaultRest, sessionId, vibrate, onBack }: iSessionViewProps) => {
    const session = data.sessions.rows.find((row) => row.id === sessionId);
    const { entries, sets } = data;
    const started = useRef(false);

    // The day this workout was done the last time, in whatever version it was: the exercise that was chosen and the comments carry on
    const last = useMemo(() => {
        const familyOfWorkout = (id: string) => {
            const workout = data.workoutById.get(id);
            return workout ? familyOf(workout) : id;
        };
        const before = session
            ? data.sessions.rows
                  .filter((row) => row.status === 'done' && row.date < session.date && familyOfWorkout(row.workout) === familyOfWorkout(session.workout))
                  .sort((a, b) => b.date.localeCompare(a.date))[0]
            : undefined;
        return before ? { entries: entries.rows.filter((entry) => entry.session === before.id) } : null;
    }, [data.sessions.rows, data.workoutById, entries.rows, session]);

    // The last time each exercise was trained, in any workout or plan: what the sets are compared to and the weights come from
    const trained = useMemo(() => trainedHistory(data.sessions.rows, entries.rows, sets.rows, (slot) => data.slotById.get(slot)?.exercise), [data.sessions.rows, data.slotById, entries.rows, sets.rows]);
    const lastRunOf = (exercise?: string): iTrained | undefined => (exercise && session ? trained.get(exercise)?.find((run) => run.date < session.date) : undefined);

    // The lines of another version are other rows, so the exercise is what they have in common
    const lastEntryOf = (slot: iSlot) => last?.entries.find((entry) => data.slotById.get(entry.slot)?.exercise === slot.exercise);

    // Opens the day: prepares the lines that are not yet. Only the weights of the last time are filled in, the reps are for the day.
    useEffect(() => {
        if (started.current || !session || session.status === 'skipped') {
            return;
        }
        started.current = true;

        const logged = entries.current().filter((entry) => entry.session === session.id);
        const missing = data.linesOf(session.workout).filter((line) => !logged.some((entry) => entry.slot === line.main.id));
        if (!missing.length) {
            return;
        }
        const created = entries.addMany(
            missing.map(({ main, alternatives }) => {
                const before = lastEntryOf(main);
                const chosenBefore = data.slotById.get(before?.chosen ?? '')?.exercise;
                const kept = [main, ...alternatives].find((slot) => slot.exercise === chosenBefore);
                return { chosen: kept?.id ?? main.id, notes: before?.notes ?? '', session: session.id, slot: main.id };
            }),
        );
        sets.addMany(
            created.flatMap((entry) => {
                const old = lastRunOf(data.slotById.get(entry.chosen)?.exercise)?.sets ?? [];
                const count = Math.max(old.length, data.slotById.get(entry.slot)?.sets ?? 1);
                return Array.from({ length: count }, (_, position) => ({
                    disabled: false,
                    done: false,
                    kind: old[position]?.kind ?? '',
                    position,
                    session: session.id,
                    session_exercise: entry.id,
                    value: 0,
                    weight: old[position]?.weight ?? 0,
                }));
            }),
        );
        // Once per opened day, the page is keyed by the session
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.id]);

    const lines = useMemo(() => {
        if (!session) {
            return [];
        }
        return data
            .linesOf(session.workout)
            .map((line) => ({ ...line, entry: entries.rows.find((entry) => entry.slot === line.main.id) }))
            .filter((line) => line.entry);
    }, [data, entries.rows, session]);

    // Training: started, not finished. Before that the day is in plan mode, values can be filled in by hand
    const training = Boolean(session && session.status === 'planned' && session.started_at && !session.finished_at);
    const now = useNow(training);

    // Consecutive lines marked as superset are one block, done in turns. The warm-up is a block of its own.
    const blocks = useMemo(() => {
        const result: { lines: typeof lines; warmup: boolean }[] = [];
        lines.forEach((line) => {
            const previous = result[result.length - 1];
            if (previous && line.main.superset && previous.warmup === Boolean(line.main.warmup)) {
                previous.lines.push(line);
            } else {
                result.push({ lines: [line], warmup: Boolean(line.main.warmup) });
            }
        });
        return result;
    }, [lines]);

    // The sets in the order they are likely done in, how each is called and which block and line of it each belongs to
    const { blockOf, inBlock, names, next, order } = useMemo(() => {
        const names = new Map<string, string>();
        const blockOf = new Map<string, { block: number; line: number }>();
        const order = blocks.flatMap((block, blockIndex) => {
            const perLine = block.lines.map(({ entry }) => sets.rows.filter((set) => set.session_exercise === entry?.id && !set.disabled).sort(byPosition));
            block.lines.forEach(({ main, entry }, lineIndex) => {
                const exercise = data.exerciseById.get(data.slotById.get(entry?.chosen ?? '')?.exercise ?? main.exercise)?.name ?? '?';
                perLine[lineIndex].forEach((set, position) => {
                    names.set(set.id, `${exercise} · set ${block.lines.length > 1 ? LETTERS[lineIndex] : ''}${position + 1}`);
                    blockOf.set(set.id, { block: blockIndex, line: lineIndex });
                });
            });
            return interleave(perLine);
        });
        const next = suggestNext(order);
        // The next set is of the exercise (or superset) that was just trained: no new exercise to pick, so no transition
        const lastDone = order.reduce<iSet | undefined>((best, set) => (set.ended_at && set.ended_at >= (best?.ended_at ?? 0) ? set : best), undefined);
        const inBlock = Boolean(next && lastDone && blockOf.get(next.id)?.block === blockOf.get(lastDone.id)?.block);
        return { blockOf, inBlock, names, next, order };
    }, [blocks, data.exerciseById, data.slotById, sets.rows]);

    // The next set is where the eyes should be
    const nextId = next?.id;
    useEffect(() => {
        if (training && nextId) {
            document.querySelector(`[data-set="${nextId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [nextId, training]);

    if (!session) {
        return <div className='empty'>This day does not exist anymore.</div>;
    }
    const workout = data.workoutById.get(session.workout);

    // Finishing a set that is followed by a set of the same exercise (or the next round of the superset) starts the rest right away
    const finishSet = (set: iSet) => {
        data.training.finishSet(set.id);
        const here = blockOf.get(set.id);
        const after = order.slice(order.findIndex((row) => row.id === set.id) + 1).find(isOpen);
        const there = after && blockOf.get(after.id);
        if (here && there && here.block === there.block && there.line <= here.line) {
            data.training.startRest(set.id);
        }
    };

    // The weight of a set for all sets below it that are not done. A set without a weight takes the one of the last time.
    const carryWeight = (logged: iSet[], set: iSet, lastSets: iSet[]) => {
        const index = logged.findIndex((row) => row.id === set.id);
        const weight = set.weight || lastSets[logged.slice(0, index).filter((row) => !row.disabled).length]?.weight || 0;
        sets.patch(set.id, { weight });
        logged.slice(index + 1).filter((row) => !row.disabled && !row.done).forEach((row) => sets.patch(row.id, { weight }));
    };

    const toggleDone = () => {
        data.sessions.patch(session.id, { status: session.status === 'done' ? 'planned' : 'done' });
    };

    const timed = Boolean(session.started_at && session.finished_at);
    const startable = session.status === 'planned' && !session.started_at && session.date <= today();

    return (
        <div className='session'>
            <header className='session__head'>
                <button className='link' onClick={onBack}>
                    ‹ Week
                </button>
                <h1>{workout?.name ?? 'Workout'}</h1>
                <p className='muted'>
                    {weekdayName(session.date)}, {shortDate(session.date)}
                    {workout?.focus ? ` · Focus: ${workout.focus}` : ''}
                    {workout?.rest_seconds ? ` · Rest ${workout.rest_seconds} s` : ''}
                </p>
                <p className='session__mode'>
                    <span className={`badge ${training ? 'badge--done' : ''}`}>{training ? 'Training' : session.status === 'done' ? 'Done' : 'Plan mode'}</span>
                    {timed && <span className='muted'>Training time {clock((session.finished_at ?? 0) - (session.started_at ?? 0))}</span>}
                    {startable && (
                        <TeaButton size='small' theme='filled' onClick={() => data.training.startSession(session.id)}>
                            Start workout
                        </TeaButton>
                    )}
                </p>
                {workout?.warmup && <p className='session__warmup'>Old warm-up note: {workout.warmup}</p>}
                {workout?.notes && <p className='muted'>{workout.notes}</p>}
            </header>

            {training && (
                <TrainBar data={data} defaultRest={defaultRest} describe={(set) => names.get(set.id) ?? 'Set'} inBlock={inBlock} next={next} session={session} vibrate={vibrate} onFinish={finishSet} />
            )}

            {blocks.map((block, blockIndex) => (
                <div key={block.lines[0].main.id} className='block'>
                    {block.warmup && blockIndex === 0 && <h2 className='session__section'>Warm-up</h2>}
                    {!block.warmup && blocks[blockIndex - 1]?.warmup && <h2 className='session__section'>Workout</h2>}
                    <div className={block.lines.length > 1 ? 'superset' : undefined}>
                        {block.lines.length > 1 && <span className='superset__tag'>Superset · done in turns</span>}
                        {block.lines.map(({ main, alternatives, entry }, lineIndex) => {
                            if (!entry) {
                                return null;
                            }
                            const choices = [main, ...alternatives];
                            const chosen = data.slotById.get(entry.chosen) ?? main;
                            const exercise = data.exerciseById.get(chosen.exercise);
                            const logged = sets.rows.filter((set) => set.session_exercise === entry.id).sort(byPosition);
                            const previous = lastRunOf(chosen.exercise);
                            const lastSets = previous?.sets ?? [];
                            const weighted = Boolean(exercise?.weighted);
                            const prefix = block.lines.length > 1 ? LETTERS[lineIndex] : '';
                            const current = training && logged.some(isRunning);
                            const upNext = training && !current && next?.session_exercise === entry.id;
                            // Disabled sets do not take a number, so the numbers are those of the order they are done in
                            const numbers = new Map(logged.filter((set) => !set.disabled).map((set, position) => [set.id, position + 1]));

                            return (
                                <section key={entry.id} className={`line ${current ? 'line--current' : ''} ${upNext ? 'line--next' : ''}`}>
                                    <div className='line__head'>
                                        {prefix && <span className='line__letter'>{prefix}</span>}
                                        <Thumb exercise={exercise} />
                                        <div className='line__title'>
                                            <strong>{exercise?.name ?? '?'}</strong>
                                            <span className='muted'>
                                                {target(chosen.sets, chosen.rep_min, chosen.rep_max)} {UNIT_LABEL[exercise?.unit ?? 'reps']}
                                            </span>
                                            {(chosen.notes || exercise?.notes) && <span className='muted'>{[chosen.notes, exercise?.notes].filter(Boolean).join(' · ')}</span>}
                                        </div>
                                    </div>

                                    {choices.length > 1 && (
                                        <div className='chips'>
                                            {choices.map((choice) => (
                                                <button
                                                    key={choice.id}
                                                    className={`chip ${choice.id === entry.chosen ? 'chip--on' : ''}`}
                                                    onClick={() => {
                                                        entries.patch(entry.id, { chosen: choice.id });
                                                        // Sets that are still empty take the weights of the last time of the exercise that was picked
                                                        const picked = lastRunOf(choice.exercise)?.sets ?? [];
                                                        logged.filter((set) => !set.disabled && !set.done && !set.value).forEach((set, position) => sets.patch(set.id, { weight: picked[position]?.weight ?? 0 }));
                                                    }}
                                                >
                                                    {data.exerciseById.get(choice.exercise)?.name}
                                                    {choice.id === main.id ? '' : ' (alt)'}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {previous && <div className='line__last'>Last trained {shortDate(previous.date)}</div>}

                                    <div className='sets'>
                                        {logged.map((set) => {
                                            const ran = Boolean(set.started_at && set.ended_at);
                                            const no = numbers.get(set.id);
                                            const before = no ? lastSets[no - 1] : undefined;
                                            return (
                                                <div key={set.id} className='set-row'>
                                                    <div
                                                        data-set={set.id}
                                                        className={`set ${set.disabled ? 'set--off' : ''} ${set.done ? 'set--done' : ''} ${training && isRunning(set) ? 'set--current' : ''} ${
                                                            training && next?.id === set.id ? (inBlock ? 'set--follow' : 'set--next') : ''
                                                        }`}
                                                    >
                                                        <span className='set__no'>{set.disabled ? '–' : `${prefix}${no}`}</span>
                                                        {previous && (
                                                            <span className='set__last' title={`Last trained ${shortDate(previous.date)}`}>
                                                                {before ? `${before.value || 0}${weighted && before.weight ? ` × ${before.weight}` : ''}${before.kind ? ` ${before.kind}` : ''}` : '–'}
                                                            </span>
                                                        )}
                                                        <label>
                                                            <input
                                                                type='number'
                                                                inputMode='decimal'
                                                                min={0}
                                                                value={set.value || ''}
                                                                placeholder={UNIT_LABEL[exercise?.unit ?? 'reps']}
                                                                onChange={(event) => sets.patch(set.id, { value: number(event.target.value) })}
                                                            />
                                                        </label>
                                                        {exercise?.weighted && (
                                                            <>
                                                                <label>
                                                                    <input
                                                                        type='number'
                                                                        inputMode='decimal'
                                                                        min={0}
                                                                        step='any'
                                                                        value={set.weight || ''}
                                                                        placeholder='kg'
                                                                        onChange={(event) => sets.patch(set.id, { weight: number(event.target.value) })}
                                                                    />
                                                                </label>
                                                                {logged.length > 1 && !set.disabled && (
                                                                    <button className='mini' title='This weight for all sets below' onClick={() => carryWeight(logged, set, lastSets)}>
                                                                        ⤓
                                                                    </button>
                                                                )}
                                                            </>
                                                        )}
                                                        <div className='set__actions'>
                                                            <button
                                                                className={`mini ${set.kind ? 'mini--on' : ''}`}
                                                                title={KIND_TITLE[set.kind ?? '']}
                                                                onClick={() => sets.patch(set.id, { kind: NEXT_KIND[set.kind ?? ''] })}
                                                            >
                                                                {set.kind || '·'}
                                                            </button>
                                                            <button
                                                                className={`mini ${set.disabled ? 'mini--on' : ''}`}
                                                                title='Skipped on purpose'
                                                                onClick={() => sets.patch(set.id, { disabled: !set.disabled })}
                                                            >
                                                                ✕
                                                            </button>
                                                            {!training ? (
                                                                <button
                                                                    className={`mini ${set.done ? 'mini--ok' : ''}`}
                                                                    title='Done'
                                                                    onClick={() => sets.patch(set.id, { done: !set.done })}
                                                                >
                                                                    ✓
                                                                </button>
                                                            ) : set.disabled ? null : isRunning(set) ? (
                                                                <button className='mini mini--wide mini--run' title='Finish the set' onClick={() => finishSet(set)}>
                                                                    {clock(now - (set.started_at ?? now))} ✓
                                                                </button>
                                                            ) : set.done ? (
                                                                <button className='mini mini--wide mini--ok' title='Undo' onClick={() => data.training.undoSet(set.id)}>
                                                                    {ran ? clock((set.ended_at ?? 0) - (set.started_at ?? 0)) : ''} ✓
                                                                </button>
                                                            ) : (
                                                                <button className='mini mini--wide mini--start' title='Start this set' onClick={() => data.training.startSet(set.id)}>
                                                                    ▶
                                                                </button>
                                                            )}
                                                            <button className='mini' title='Remove set' onClick={() => sets.remove([set.id])}>
                                                                −
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {ran && (
                                                        <div className='set__times'>
                                                            <span className='set__transition'>Transition {clock(transitionBefore(set, order, session.started_at ?? 0))}</span>
                                                            <span>Set {clock((set.ended_at ?? 0) - (set.started_at ?? 0))}</span>
                                                            {Boolean(set.rest_started_at && set.rest_ended_at) && <span>Rest {clock((set.rest_ended_at ?? 0) - (set.rest_started_at ?? 0))}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        <button
                                            className='link'
                                            onClick={() => {
                                                const prev = logged[logged.length - 1];
                                                sets.add({
                                                    disabled: false,
                                                    done: false,
                                                    kind: prev?.kind ?? '',
                                                    position: (prev?.position ?? -1) + 1,
                                                    session: session.id,
                                                    session_exercise: entry.id,
                                                    value: 0,
                                                    weight: prev?.weight ?? 0,
                                                });
                                            }}
                                        >
                                            + Set
                                        </button>
                                    </div>

                                    <input
                                        className='line__comment'
                                        placeholder='Comment, e.g. rack spot, seat height'
                                        value={entry.notes ?? ''}
                                        onChange={(event) => entries.patch(entry.id, { notes: event.target.value })}
                                    />
                                </section>
                            );
                        })}
                    </div>
                </div>
            ))}

            {!data.linesOf(session.workout).length && <div className='empty'>This workout has no exercises yet.</div>}

            <TeaTextarea
                label='Notes of the day'
                rows={2}
                value={session.notes ?? ''}
                onChange={(event) => data.sessions.patch(session.id, { notes: event.target.value })}
            />

            <footer className='session__foot'>
                {training ? (
                    <TeaButton theme='filled' onClick={() => data.training.finishSession(session.id)}>
                        Finish workout
                    </TeaButton>
                ) : (
                    <TeaButton theme={session.status === 'done' ? 'default' : 'filled'} onClick={session.status === 'done' && session.started_at ? () => data.training.reopenSession(session.id) : toggleDone}>
                        {session.status === 'done' ? 'Reopen workout' : 'Complete workout'}
                    </TeaButton>
                )}
            </footer>
        </div>
    );
};
