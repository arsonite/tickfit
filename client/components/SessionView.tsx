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

// Hooks
import type { tData } from '@/hooks/useTickfit';

// Utility
import { shortDate, weekdayName } from '@/tools/dates';

// Types
import type { iEntry, iExercise, iSet, tSetKind, tUnit } from '@/types';

interface iSessionViewProps {
    data: tData;
    sessionId: string;

    onBack: () => void;
}

const UNIT_LABEL: Record<tUnit, string> = { meters: 'm', minutes: 'min', reps: 'reps' };
const NEXT_KIND: Record<string, tSetKind> = { '': 'DS', DS: 'P', P: 'A', A: '' };
const KIND_TITLE: Record<string, string> = { '': 'Normal set', A: 'Assisted', DS: 'Drop set', P: 'Partial' };

const byPosition = (a: iSet, b: iSet) => a.position - b.position;

const number = (text: string): number => Number(text.replace(',', '.')) || 0;

const target = (sets: number, min?: number, max?: number): string => {
    const reps = min && max && min !== max ? `${min}–${max}` : `${min || max || ''}`;
    return reps ? `${sets} × ${reps}` : `${sets} ×`;
};

/** One day of training: the lines of the workout, the sets of each, and what was done the time before */
export const SessionView = ({ data, sessionId, onBack }: iSessionViewProps) => {
    const session = data.sessions.rows.find((row) => row.id === sessionId);
    const { entries, sets } = data;
    const started = useRef(false);

    // What was done the last time this workout was done
    const last = useMemo(() => {
        const before = session
            ? data.sessions.rows
                  .filter((row) => row.workout === session.workout && row.status === 'done' && row.date < session.date)
                  .sort((a, b) => b.date.localeCompare(a.date))[0]
            : undefined;
        return before
            ? { entries: entries.rows.filter((entry) => entry.session === before.id), sets: sets.rows.filter((set) => set.session === before.id) }
            : null;
    }, [data.sessions.rows, entries.rows, session, sets.rows]);

    // Opens the day: prepares the lines that are not yet with the values of the last time
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
        const lastOf = (slot: string) => last?.entries.find((entry) => entry.slot === slot);
        const created = entries.addMany(
            missing.map(({ main, alternatives }) => {
                const before = lastOf(main.id);
                const keep = before && (before.chosen === main.id || alternatives.some((alternative) => alternative.id === before.chosen));
                return { chosen: keep ? before.chosen : main.id, notes: before?.notes ?? '', session: session.id, slot: main.id };
            }),
        );
        sets.addMany(
            created.flatMap((entry) => {
                const before = lastOf(entry.slot);
                const old = before ? (last?.sets ?? []).filter((set) => set.session_exercise === before.id).sort(byPosition) : [];
                const count = old.length || data.slotById.get(entry.slot)?.sets || 1;
                return Array.from({ length: count }, (_, position) => ({
                    disabled: false,
                    done: false,
                    kind: old[position]?.kind ?? '',
                    position,
                    session: session.id,
                    session_exercise: entry.id,
                    value: old[position]?.value ?? 0,
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

    if (!session) {
        return <div className='empty'>This day does not exist anymore.</div>;
    }
    const workout = data.workoutById.get(session.workout);

    const describeSets = (entry: iEntry, exercise: iExercise | undefined): string => {
        const before = last?.entries.find((old) => old.slot === entry.slot);
        if (!before) {
            return '';
        }
        const parts = last!.sets
            .filter((set) => set.session_exercise === before.id && !set.disabled && (set.value || set.weight))
            .sort(byPosition)
            .map((set) => {
                const weighted = exercise?.weighted ?? true;
                return `${set.value || 0}${weighted ? ` × ${set.weight || 0}` : ''}${set.kind ? ` ${set.kind}` : ''}`;
            });
        const other = before.chosen !== entry.chosen ? data.exerciseById.get(data.slotById.get(before.chosen)?.exercise ?? '')?.name : '';
        return parts.length ? `${other ? `${other}: ` : ''}${parts.join(' · ')}` : '';
    };

    const toggleDone = () => {
        data.sessions.patch(session.id, { status: session.status === 'done' ? 'planned' : 'done' });
    };

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
                {workout?.warmup && <p className='session__warmup'>Warm-up: {workout.warmup}</p>}
                {workout?.notes && <p className='muted'>{workout.notes}</p>}
            </header>

            {lines.map(({ main, alternatives, entry }, index) => {
                if (!entry) {
                    return null;
                }
                const choices = [main, ...alternatives];
                const chosen = data.slotById.get(entry.chosen) ?? main;
                const exercise = data.exerciseById.get(chosen.exercise);
                const logged = sets.rows.filter((set) => set.session_exercise === entry.id).sort(byPosition);
                const previous = describeSets(entry, exercise);

                return (
                    <section key={entry.id} className={`line ${main.superset && index > 0 ? 'line--joined' : ''}`}>
                        <div className='line__head'>
                            <Thumb exercise={exercise} />
                            <div className='line__title'>
                                <strong>{exercise?.name ?? '?'}</strong>
                                <span className='muted'>
                                    {target(chosen.sets, chosen.rep_min, chosen.rep_max)} {UNIT_LABEL[exercise?.unit ?? 'reps']}
                                    {main.superset && index > 0 ? ' · superset' : ''}
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
                                        onClick={() => entries.patch(entry.id, { chosen: choice.id })}
                                    >
                                        {data.exerciseById.get(choice.exercise)?.name}
                                        {choice.id === main.id ? '' : ' (alt)'}
                                    </button>
                                ))}
                            </div>
                        )}

                        {previous && <div className='line__last'>Last: {previous}</div>}

                        <div className='sets'>
                            {logged.map((set, position) => (
                                <div key={set.id} className={`set ${set.disabled ? 'set--off' : ''} ${set.done ? 'set--done' : ''}`}>
                                    <span className='set__no'>{position + 1}</span>
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
                                    )}
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
                                    <button
                                        className={`mini ${set.done ? 'mini--ok' : ''}`}
                                        title='Done'
                                        onClick={() => sets.patch(set.id, { done: !set.done })}
                                    >
                                        ✓
                                    </button>
                                    <button className='mini' title='Remove set' onClick={() => sets.remove([set.id])}>
                                        −
                                    </button>
                                </div>
                            ))}
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
                                        value: prev?.value ?? 0,
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

            {!data.linesOf(session.workout).length && <div className='empty'>This workout has no exercises yet.</div>}

            <TeaTextarea
                label='Notes of the day'
                rows={2}
                value={session.notes ?? ''}
                onChange={(event) => data.sessions.patch(session.id, { notes: event.target.value })}
            />

            <footer className='session__foot'>
                <TeaButton theme={session.status === 'done' ? 'default' : 'filled'} onClick={toggleDone}>
                    {session.status === 'done' ? 'Reopen workout' : 'Complete workout'}
                </TeaButton>
            </footer>
        </div>
    );
};
