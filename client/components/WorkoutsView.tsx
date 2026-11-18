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
import { useState } from 'react';

// TeaType
import { TeaAutocomplete, TeaButton, TeaCheckbox, TeaInput, TeaSelect, TeaTextarea, useConfirm } from '@teatype/components';

// Components
import { Thumb } from '@/components/Thumb';

// Hooks
import type { tData } from '@/hooks/useTickfit';

// Utility
import { familyOf } from '@/tools/training';

// Types
import type { iSlot, iWorkout, tKind } from '@/types';

interface iWorkoutsViewProps {
    data: tData;
}

const KINDS: { label: string; value: tKind }[] = [
    { label: 'Strength', value: 'strength' },
    { label: 'Cardio', value: 'cardio' },
    { label: 'Rest day', value: 'rest' },
];

const number = (text: string): number => Math.max(0, Math.round(Number(text))) || 0;

/** The workouts and the exercises in them, edited in place */
export const WorkoutsView = ({ data }: iWorkoutsViewProps) => {
    const confirm = useConfirm();
    const [selected, setSelected] = useState<string | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    const [search, setSearch] = useState('');

    const workouts = [...data.workoutList].sort((a, b) => a.name.localeCompare(b.name));
    // Old versions and what was imported: kept for the stats, shown read-only
    const archived = data.workouts.rows
        .filter((row) => row.archived && row.name.toLowerCase().includes(search.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name) || (b.version ?? 1) - (a.version ?? 1));
    const archivedCount = data.workouts.rows.filter((row) => row.archived).length;
    const workout = data.workoutById.get(selected ?? '') ?? workouts[0];
    const lines = workout ? data.linesOf(workout.id) : [];
    const locked = workout ? data.isLocked(workout.id) : false;
    const exercises = [...data.exercises.rows].sort((a, b) => a.name.localeCompare(b.name));
    const exerciseOptions = exercises.map((exercise) => ({ label: exercise.name, value: exercise.id }));

    // Changes go through here: a workout that was trained is not changed, its changed copy is (see editable of useTickfit)
    const change = (apply: (workoutId: string, slot: (id: string) => string) => void) => {
        if (!workout) {
            return;
        }
        const target = data.editable(workout.id);
        if (target.id !== workout.id) {
            setSelected(target.id);
        }
        apply(target.id, (id) => target.slots.get(id) ?? id);
    };
    const edit = (changes: Partial<iWorkout>) => change((id) => data.workouts.patch(id, changes));
    const editSlot = (id: string, changes: Partial<iSlot>) => change((_, slot) => data.slots.patch(slot(id), changes));

    const create = () => setSelected(data.workouts.add({ kind: 'strength', name: 'New workout' }).id);

    const duplicate = () => {
        if (!workout) {
            return;
        }
        const copy = data.workouts.add({ focus: workout.focus, kind: workout.kind, name: `${workout.name} (copy)`, notes: workout.notes, rest_seconds: workout.rest_seconds });
        const mains = data.slots.addMany(lines.map(({ main }) => ({ exercise: main.exercise, notes: main.notes, position: main.position, rep_max: main.rep_max, rep_min: main.rep_min, sets: main.sets, superset: main.superset, warmup: main.warmup, workout: copy.id })));
        data.slots.addMany(
            lines.flatMap(({ alternatives }, index) =>
                alternatives.map((slot) => ({ alternative_of: mains[index].id, exercise: slot.exercise, position: slot.position, rep_max: slot.rep_max, rep_min: slot.rep_min, sets: slot.sets, workout: copy.id })),
            ),
        );
        setSelected(copy.id);
    };

    const archive = async () => {
        const used = data.planDays.rows.filter((day) => day.workout === workout?.id && data.plans.rows.some((plan) => plan.id === day.plan && plan.active));
        if (used.length) {
            const ok = await confirm({
                title: 'Archive workout',
                message: `${workout?.name} is a day of ${used.length === 1 ? 'an active plan' : `${used.length} active plans`}. The plan keeps it, but it can not be picked for new days until it is unarchived.`,
                confirmText: 'Archive',
            });
            if (!ok) {
                return;
            }
        }
        if (workout) {
            data.workouts.patch(workout.id, { archived: true });
        }
    };

    const remove = async () => {
        if (!workout) {
            return;
        }
        const family = familyOf(workout);
        const versions = new Set(data.workouts.rows.filter((row) => familyOf(row) === family).map((row) => row.id));
        const days = data.sessions.rows.filter((session) => versions.has(session.workout)).length;
        const ok = await confirm({
            title: 'Delete workout',
            message: days
                ? `${workout.name} is on ${days} day${days === 1 ? '' : 's'}${versions.size > 1 ? ` in ${versions.size} versions` : ''}. They are deleted with everything that was logged.`
                : `Delete ${workout.name}?`,
            confirmText: 'Delete',
            variant: 'danger',
        });
        if (ok) {
            setSelected(null);
            data.removeWorkout(workout.id);
        }
    };

    const addLine = (warmup: boolean) => {
        if (!workout || !exercises.length) {
            return;
        }
        const last = Math.max(-1, ...lines.map(({ main }) => main.position));
        change((id) => data.slots.add({ exercise: exercises[0].id, position: last + 1, rep_max: warmup ? 10 : 0, rep_min: warmup ? 5 : 0, sets: warmup ? 1 : 3, warmup, workout: id }));
    };

    const addAlternative = (main: iSlot, count: number) =>
        change((id, slot) => data.slots.add({ alternative_of: slot(main.id), exercise: exercises[0].id, position: count, rep_max: main.rep_max, rep_min: main.rep_min, sets: main.sets, workout: id }));

    const dropSlot = (id: string) => change((_, slot) => data.removeSlots([slot(id)]));

    const removeLine = async (slot: iSlot) => {
        const ok = await confirm({
            title: 'Remove exercise',
            message: `Remove ${data.exerciseById.get(slot.exercise)?.name} from ${workout?.name}?${locked ? '' : ' What was logged for it is deleted.'}`,
            confirmText: 'Remove',
            variant: 'danger',
        });
        if (ok) {
            dropSlot(slot.id);
        }
    };

    // Lines are moved within their group, the warm-up stays before the others
    const move = (group: typeof lines, index: number, delta: number) => {
        const other = group[index + delta];
        if (other) {
            const [here, there] = [group[index].main, other.main];
            change((_, slot) => {
                data.slots.patch(slot(here.id), { position: there.position });
                data.slots.patch(slot(there.id), { position: here.position });
            });
        }
    };

    const warmupLines = lines.filter(({ main }) => main.warmup);
    const mainLines = lines.filter(({ main }) => !main.warmup);

    const renderLine = ({ main, alternatives }: (typeof lines)[number], index: number, group: typeof lines) => (
        <div key={main.id} className='slot'>
            <div className='slot__row'>
                <Thumb exercise={data.exerciseById.get(main.exercise)} />
                <TeaAutocomplete className='slot__exercise' value={main.exercise} options={exerciseOptions} onChange={(exercise) => editSlot(main.id, { exercise })} />
                <TeaInput className='slot__num' label='Sets' type='number' min={1} value={main.sets || ''} onChange={(event) => editSlot(main.id, { sets: number(event.target.value) || 1 })} />
                <TeaInput className='slot__num' label='From' type='number' min={0} value={main.rep_min || ''} onChange={(event) => editSlot(main.id, { rep_min: number(event.target.value) })} />
                <TeaInput className='slot__num' label='To' type='number' min={0} value={main.rep_max || ''} onChange={(event) => editSlot(main.id, { rep_max: number(event.target.value) })} />
            </div>
            <div className='slot__row'>
                <TeaInput className='grow' placeholder='Notes, e.g. *includes drop sets' value={main.notes ?? ''} onChange={(event) => editSlot(main.id, { notes: event.target.value })} />
                {index > 0 && <TeaCheckbox label='Superset with above' checked={!!main.superset} onChange={(superset) => editSlot(main.id, { superset })} />}
                <button className='mini' title='Up' disabled={index === 0} onClick={() => move(group, index, -1)}>↑</button>
                <button className='mini' title='Down' disabled={index === group.length - 1} onClick={() => move(group, index, 1)}>↓</button>
                <button className='mini' title='Remove' onClick={() => void removeLine(main)}>✕</button>
            </div>
            {alternatives.map((alternative) => (
                <div key={alternative.id} className='slot__row slot__row--alt'>
                    <span className='muted'>or</span>
                    <TeaAutocomplete className='slot__exercise' value={alternative.exercise} options={exerciseOptions} onChange={(exercise) => editSlot(alternative.id, { exercise })} />
                    <TeaInput className='slot__num' type='number' min={0} placeholder='From' value={alternative.rep_min || ''} onChange={(event) => editSlot(alternative.id, { rep_min: number(event.target.value) })} />
                    <TeaInput className='slot__num' type='number' min={0} placeholder='To' value={alternative.rep_max || ''} onChange={(event) => editSlot(alternative.id, { rep_max: number(event.target.value) })} />
                    <button className='mini' title='Remove alternative' onClick={() => dropSlot(alternative.id)}>✕</button>
                </div>
            ))}
            <button className='link' disabled={!exercises.length} onClick={() => addAlternative(main, alternatives.length)}>+ Alternative</button>
        </div>
    );

    return (
        <div className='page page--split'>
            <aside className='list'>
                <header className='page__head'>
                    <h1>Workouts</h1>
                    <TeaButton size='small' theme='filled' onClick={() => void create()}>New</TeaButton>
                </header>
                {workouts.map((row) => (
                    <button key={row.id} className={`list__item ${row.id === workout?.id ? 'list__item--on' : ''}`} onClick={() => setSelected(row.id)}>
                        {row.name}
                        <span className='muted'>{row.kind}</span>
                    </button>
                ))}
                {!workouts.length && <div className='empty'>No workouts yet.</div>}
                {archivedCount > 0 && (
                    <>
                        <button className='list__toggle' onClick={() => setShowArchived(!showArchived)}>
                            {showArchived ? '▾' : '▸'} Archived ({archivedCount})
                        </button>
                        {showArchived && (
                            <>
                                <TeaInput placeholder='Search archived' value={search} onChange={(event) => setSearch(event.target.value)} />
                                {archived.map((row) => (
                                    <button key={row.id} className={`list__item list__item--archived ${row.id === workout?.id ? 'list__item--on' : ''}`} onClick={() => setSelected(row.id)}>
                                        {row.name}
                                        <span className='muted'>v{row.version ?? 1}</span>
                                    </button>
                                ))}
                            </>
                        )}
                    </>
                )}
            </aside>

            {workout && (
                <section className='editor'>
                    {((workout.version ?? 1) > 1 || locked) && (
                        <p className='muted'>
                            Version {workout.version ?? 1}
                            {locked ? ' · it was trained, so a change makes a new version and the old one stays for the stats' : ''}
                        </p>
                    )}
                    {workout.archived && (
                        <p className='editor__archived'>
                            <span>Archived: an old version, an import or put away by you. It is kept for the stats and cannot be changed until it is unarchived.</span>
                            <TeaButton size='small' onClick={() => data.workouts.patch(workout.id, { archived: false })}>Unarchive</TeaButton>
                        </p>
                    )}
                    <fieldset className='editor__body' disabled={Boolean(workout.archived)}>
                    <div className='form form--row'>
                        <TeaInput label='Name' value={workout.name} onChange={(event) => edit({ name: event.target.value })} />
                        <TeaSelect label='Type' value={workout.kind} options={KINDS} onChange={(event) => edit({ kind: event.target.value as tKind })} />
                        <TeaInput label='Focus' value={workout.focus ?? ''} onChange={(event) => edit({ focus: event.target.value })} />
                        <TeaInput label='Rest between sets (s)' type='number' min={0} value={workout.rest_seconds || ''} onChange={(event) => edit({ rest_seconds: number(event.target.value) })} />
                    </div>
                    <TeaTextarea label='Notes' rows={2} value={workout.notes ?? ''} onChange={(event) => edit({ notes: event.target.value })} />

                    <h2>Warm-up <span className='muted'>exercises like the others, with the alternatives you pick from</span></h2>
                    {workout.warmup && (
                        <p className='muted'>
                            Old note: “{workout.warmup}”{' '}
                            <button className='link' onClick={() => data.workouts.patch(workout.id, { warmup: '' })}>Remove the note</button> once it is in the lines below.
                        </p>
                    )}
                    {warmupLines.map(renderLine)}
                    <div className='editor__actions'>
                        <TeaButton disabled={!exercises.length} onClick={() => addLine(true)}>Add warm-up</TeaButton>
                    </div>

                    <h2>Exercises</h2>
                    {mainLines.map(renderLine)}
                    <div className='editor__actions'>
                        <TeaButton disabled={!exercises.length} onClick={() => addLine(false)}>Add exercise</TeaButton>
                        {!exercises.length && <span className='muted'>Create an exercise first.</span>}
                    </div>
                    </fieldset>
                    <div className='editor__actions'>
                        {workout.archived ? (
                            <TeaButton onClick={() => data.workouts.patch(workout.id, { archived: false })}>Unarchive</TeaButton>
                        ) : (
                            <TeaButton onClick={() => void archive()}>Archive</TeaButton>
                        )}
                        <TeaButton onClick={() => void duplicate()}>Duplicate</TeaButton>
                        <span className='grow' />
                        <TeaButton theme='danger' onClick={() => void remove()}>Delete workout</TeaButton>
                    </div>
                </section>
            )}
        </div>
    );
};
