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
import { useMemo, useRef, useState } from 'react';

// TeaType
import { TeaButton, TeaCheckbox, TeaInput, TeaModal, TeaSelect, TeaTextarea, useConfirm } from '@teatype/components';

// Components
import { Icon } from '@/components/Icon';
import { Thumb } from '@/components/Thumb';

// Hooks
import { useFlag, useParam } from '@/hooks/useRoute';
import type { tData } from '@/hooks/useTickfit';

// Utility
import { shrink } from '@/tools/image';
import { distanceUnit, timeUnit } from '@/tools/training';

// Types
import type { iExercise } from '@/types';

interface iExercisesViewProps {
    data: tData;
}

// An exercise that is being made or changed, id is empty for a new one
type tDraft = Omit<iExercise, 'id'> & { id: string };

// What the bulk edit changes: empty or 'keep' leaves it as it is
interface iBulk {
    category: string;
    distance: string;
    reps: string;
    time: string;
    weighted: string;
}

type tCount = 'km' | 'meters' | 'minutes' | 'reps' | 'seconds';

const COUNTS: { label: string; short: string; value: tCount }[] = [
    { label: 'Reps', short: 'reps', value: 'reps' },
    { label: 'Minutes', short: 'min', value: 'minutes' },
    { label: 'Seconds', short: 's', value: 'seconds' },
    { label: 'Meters', short: 'm', value: 'meters' },
    { label: 'Kilometers', short: 'km', value: 'km' },
];

type tCounted = Pick<iExercise, 'distance_unit' | 'distanced' | 'time_unit' | 'timed' | 'unit'>;

const hasCount = (exercise: tCounted, count: tCount): boolean =>
    count === 'reps'
        ? exercise.unit === 'reps'
        : count === 'minutes' || count === 'seconds'
          ? Boolean(exercise.timed) && timeUnit(exercise) === count
          : Boolean(exercise.distanced) && distanceUnit(exercise) === count;

/** Turns one count on or off. Reps, a time and a distance are counted on their own, but a time is in minutes or seconds and a distance in meters or km, never both. */
const withCount = <T extends tCounted>(exercise: T, count: tCount, on: boolean = !hasCount(exercise, count)): T => {
    if (count === 'reps') {
        return { ...exercise, unit: on ? 'reps' : 'none' };
    }
    if (count === 'minutes' || count === 'seconds') {
        return { ...exercise, timed: on, time_unit: on ? count : exercise.time_unit };
    }
    return { ...exercise, distanced: on, distance_unit: on ? count : exercise.distance_unit };
};

const SWITCH = [
    { label: 'Keep', value: 'keep' },
    { label: 'On', value: 'on' },
    { label: 'Off', value: 'off' },
];

const TIME_OPTIONS = [
    { label: 'Keep', value: 'keep' },
    { label: 'Minutes', value: 'minutes' },
    { label: 'Seconds', value: 'seconds' },
    { label: 'Off', value: 'off' },
];

const DISTANCE_OPTIONS = [
    { label: 'Keep', value: 'keep' },
    { label: 'Meters', value: 'meters' },
    { label: 'Kilometers', value: 'km' },
    { label: 'Off', value: 'off' },
];

const BLANK: tDraft = { category: '', distance_unit: 'km', distanced: false, id: '', image: '', name: '', notes: '', time_unit: 'minutes', timed: false, unit: 'reps', weighted: true };
const NO_BULK: iBulk = { category: '', distance: 'keep', reps: 'keep', time: 'keep', weighted: 'keep' };

/** What an exercise counts, in a few words */
const countsOf = (exercise: iExercise): string =>
    [exercise.category, ...COUNTS.filter((count) => hasCount(exercise, count.value)).map((count) => count.short), exercise.weighted ? 'kg' : '']
        .filter(Boolean)
        .join(' · ');

/** The exercises with their pictures, which the workouts are built from */
export const ExercisesView = ({ data }: iExercisesViewProps) => {
    const confirm = useConfirm();
    const [draft, setDraft] = useState<tDraft | null>(null);
    const [query, setQuery] = useParam('q');
    const [type, setType] = useParam('type');
    const [showArchived, setShowArchived] = useFlag('archived');
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [bulk, setBulk] = useState<iBulk | null>(null);
    const file = useRef<HTMLInputElement>(null);

    const types = useMemo(() => [...new Set(data.exercises.rows.map((exercise) => exercise.category?.trim() ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b)), [data.exercises.rows]);

    const matching = data.exercises.rows
        .filter((exercise) => exercise.name.toLowerCase().includes(query.trim().toLowerCase()))
        .filter((exercise) => !type || (type === '-' ? !exercise.category?.trim() : exercise.category?.trim() === type))
        .sort((a, b) => a.name.localeCompare(b.name));
    const shown = matching.filter((exercise) => !exercise.archived);
    const archived = matching.filter((exercise) => exercise.archived);
    const archivedCount = data.exercises.rows.filter((exercise) => exercise.archived).length;
    const away = Boolean(draft?.archived);
    const chosen = data.exercises.rows.filter((exercise) => selected.includes(exercise.id));
    const visible = [...shown, ...(showArchived ? archived : [])];

    const stopSelecting = () => {
        setSelecting(false);
        setSelected([]);
    };

    const toggle = (id: string) => setSelected((list) => (list.includes(id) ? list.filter((other) => other !== id) : [...list, id]));

    const open = (exercise: iExercise) => (selecting ? toggle(exercise.id) : setDraft({ ...BLANK, ...exercise }));

    const save = () => {
        if (!draft?.name.trim()) {
            return;
        }
        const { id, ...fields } = { ...draft, category: draft.category?.trim() ?? '', name: draft.name.trim() };
        setDraft(null);
        if (id) {
            data.exercises.patch(id, fields);
        } else {
            data.exercises.add(fields);
        }
        data.success(id ? 'Exercise saved' : 'Exercise created');
    };

    // Put away: kept for what was logged with it, not offered for new workout lines
    const archive = (archived: boolean) => {
        if (draft?.id) {
            data.exercises.patch(draft.id, { archived });
            setDraft(null);
            data.success(archived ? 'Exercise archived' : 'Exercise unarchived');
        }
    };

    const archiveMany = (archived: boolean) => {
        const todo = chosen.filter((exercise) => Boolean(exercise.archived) !== archived);
        todo.forEach((exercise) => data.exercises.patch(exercise.id, { archived }));
        data.success(`${todo.length} exercise${todo.length === 1 ? '' : 's'} ${archived ? 'archived' : 'unarchived'}`);
        stopSelecting();
    };

    const removeMany = async (list: iExercise[]) => {
        const ids = list.map((exercise) => exercise.id);
        const used = data.slots.rows.filter((slot) => ids.includes(slot.exercise)).length;
        const ok = await confirm({
            title: list.length === 1 ? 'Delete exercise' : `Delete ${list.length} exercises`,
            message: used
                ? `${list.length === 1 ? list[0].name : 'They are'} used in ${used} workout line${used === 1 ? '' : 's'}. They are deleted with everything that was logged for them.`
                : list.length === 1
                  ? `Delete ${list[0].name}?`
                  : `Delete ${list.length} exercises?`,
            confirmText: 'Delete',
            variant: 'danger',
        });
        if (ok) {
            setDraft(null);
            data.removeExercises(ids);
            stopSelecting();
        }
    };

    const applyBulk = () => {
        if (!bulk) {
            return;
        }
        const flag = (value: string, current?: boolean) => (value === 'keep' ? current : value === 'on');
        chosen.forEach((exercise) =>
            {
                let counted: tCounted = exercise;
                if (bulk.reps !== 'keep') {
                    counted = withCount(counted, 'reps', bulk.reps === 'on');
                }
                if (bulk.time !== 'keep') {
                    counted = withCount(counted, bulk.time === 'seconds' ? 'seconds' : 'minutes', bulk.time !== 'off');
                }
                if (bulk.distance !== 'keep') {
                    counted = withCount(counted, bulk.distance === 'km' ? 'km' : 'meters', bulk.distance !== 'off');
                }
                data.exercises.patch(exercise.id, { distance_unit: counted.distance_unit, distanced: counted.distanced, time_unit: counted.time_unit, timed: counted.timed, unit: counted.unit, category: bulk.category.trim() || exercise.category, weighted: flag(bulk.weighted, exercise.weighted) });
            },
        );
        data.success(`${chosen.length} exercise${chosen.length === 1 ? '' : 's'} changed`);
        setBulk(null);
        stopSelecting();
    };

    const pickImage = async (files: FileList | null) => {
        if (!files?.[0] || !draft) {
            return;
        }
        try {
            setDraft({ ...draft, image: await shrink(files[0]) });
        } catch (error) {
            data.onError(error);
        }
    };

    const card = (exercise: iExercise) => (
        <button key={exercise.id} className={`card ${exercise.archived ? 'card--archived' : ''} ${selected.includes(exercise.id) ? 'card--selected' : ''}`} onClick={() => open(exercise)}>
            {selecting && <span className={`card__check ${selected.includes(exercise.id) ? 'card__check--on' : ''}`}>{selected.includes(exercise.id) && <Icon name='check' />}</span>}
            <Thumb exercise={exercise} size='large' />
            <strong>{exercise.name}</strong>
            <span className='muted card__counts'>{countsOf(exercise)}</span>
        </button>
    );

    return (
        <div className='page'>
            <header className='page__head page__head--wrap'>
                <h1>Exercises</h1>
                <input className='search' type='search' placeholder='Search' value={query} onChange={(event) => setQuery(event.target.value)} />
                <TeaSelect
                    aria-label='Type'
                    value={type}
                    options={[{ label: 'All types', value: '' }, ...types.map((name) => ({ label: name, value: name })), { label: 'No type', value: '-' }]}
                    onChange={(event) => setType(event.target.value)}
                />
                <TeaButton onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>{selecting ? 'Done' : 'Select'}</TeaButton>
                <TeaButton theme='filled' onClick={() => setDraft(BLANK)}>New exercise</TeaButton>
            </header>

            {selecting && (
                <div className='bulkbar'>
                    <strong>{selected.length} selected</strong>
                    <TeaButton size='small' onClick={() => setSelected(visible.map((exercise) => exercise.id))}>All shown</TeaButton>
                    <TeaButton size='small' disabled={!selected.length} onClick={() => setSelected([])}>None</TeaButton>
                    <span className='grow' />
                    <TeaButton size='small' disabled={!selected.length} onClick={() => setBulk(NO_BULK)}>Edit</TeaButton>
                    <TeaButton size='small' disabled={!chosen.some((exercise) => !exercise.archived)} onClick={() => archiveMany(true)}>Archive</TeaButton>
                    <TeaButton size='small' disabled={!chosen.some((exercise) => exercise.archived)} onClick={() => archiveMany(false)}>Unarchive</TeaButton>
                    <TeaButton size='small' theme='danger' disabled={!selected.length} onClick={() => void removeMany(chosen)}>Delete</TeaButton>
                </div>
            )}

            {!shown.length && <div className='empty'>{data.exercises.rows.length - archivedCount ? 'Nothing found.' : 'No exercises yet.'}</div>}

            <div className='cards'>{shown.map(card)}</div>

            {archivedCount > 0 && (
                <div className='list'>
                    <button className='list__toggle' onClick={() => setShowArchived(!showArchived)}>
                        <Icon name={showArchived ? 'chevron-down' : 'chevron-right'} /> Archived ({archivedCount})
                    </button>
                    {showArchived && (
                        <div className='cards'>
                            {archived.map(card)}
                            {!archived.length && <div className='empty'>Nothing found.</div>}
                        </div>
                    )}
                </div>
            )}

            <datalist id='exercise-types'>
                {types.map((name) => (
                    <option key={name} value={name} />
                ))}
            </datalist>

            <TeaModal
                isOpen={draft !== null}
                title={draft?.id ? 'Exercise' : 'New exercise'}
                footer={
                    <div className='modal-actions'>
                        {draft?.id && <TeaButton theme='danger' onClick={() => void removeMany([draft as iExercise])}>Delete</TeaButton>}
                        {draft?.id && <TeaButton onClick={() => archive(!away)}>{away ? 'Unarchive' : 'Archive'}</TeaButton>}
                        <span className='grow' />
                        <TeaButton onClick={() => setDraft(null)}>Cancel</TeaButton>
                        <TeaButton theme='filled' disabled={!draft?.name.trim() || away} onClick={() => void save()}>Save</TeaButton>
                    </div>
                }
                onClose={() => setDraft(null)}
            >
                {draft && (
                    <fieldset className='form editor__body' disabled={away}>
                        {away && <p className='editor__archived'>Archived: kept for what was logged with it and cannot be changed until it is unarchived. Workouts that use it keep it.</p>}
                        <div className='form__picture'>
                            <Thumb exercise={draft as iExercise} size='large' />
                            <div className='form__picture-actions'>
                                <TeaButton size='small' onClick={() => file.current?.click()}>{draft.image ? 'Change picture' : 'Add picture'}</TeaButton>
                                {draft.image && <TeaButton size='small' onClick={() => setDraft({ ...draft, image: '' })}>Remove</TeaButton>}
                            </div>
                            <input ref={file} hidden type='file' accept='image/*' onChange={(event) => { void pickImage(event.target.files); event.target.value = ''; }} />
                        </div>
                        <TeaInput label='Name' value={draft.name} autoFocus onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                        <TeaInput label='Type' list='exercise-types' placeholder='e.g. pull, push, legs, cardio' value={draft.category ?? ''} onChange={(event) => setDraft({ ...draft, category: event.target.value })} />
                        <div className='form__group'>
                            <span className='form__label'>Counted in</span>
                            <div className='chips'>
                                {COUNTS.map((count) => (
                                    <button
                                        key={count.value}
                                        type='button'
                                        aria-pressed={hasCount(draft, count.value)}
                                        className={`chip ${hasCount(draft, count.value) ? 'chip--on' : ''}`}
                                        onClick={() => setDraft(withCount(draft, count.value))}
                                    >
                                        {count.label}
                                    </button>
                                ))}
                            </div>
                            <p className='muted form__hint'>Minutes or seconds, meters or kilometers, not both. The time is filled in when a set is finished.</p>
                        </div>
                        <div className='form__checks'>
                            <TeaCheckbox label='Weight (kg)' checked={!!draft.weighted} onChange={(weighted) => setDraft({ ...draft, weighted })} />
                        </div>
                        <TeaTextarea label='Notes' rows={3} placeholder='Seat height, grip, cues …' value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
                    </fieldset>
                )}
            </TeaModal>

            <TeaModal
                isOpen={bulk !== null}
                title={`Edit ${chosen.length} exercise${chosen.length === 1 ? '' : 's'}`}
                footer={
                    <div className='modal-actions'>
                        <span className='grow' />
                        <TeaButton onClick={() => setBulk(null)}>Cancel</TeaButton>
                        <TeaButton theme='filled' onClick={applyBulk}>Apply</TeaButton>
                    </div>
                }
                onClose={() => setBulk(null)}
            >
                {bulk && (
                    <div className='form'>
                        <TeaInput label='Type' list='exercise-types' placeholder='Empty keeps the type' value={bulk.category} onChange={(event) => setBulk({ ...bulk, category: event.target.value })} />
                        <TeaSelect label='Reps' value={bulk.reps} options={SWITCH} onChange={(event) => setBulk({ ...bulk, reps: event.target.value })} />
                        <TeaSelect label='Time' value={bulk.time} options={TIME_OPTIONS} onChange={(event) => setBulk({ ...bulk, time: event.target.value })} />
                        <TeaSelect label='Distance' value={bulk.distance} options={DISTANCE_OPTIONS} onChange={(event) => setBulk({ ...bulk, distance: event.target.value })} />
                        <TeaSelect label='Weight (kg)' value={bulk.weighted} options={SWITCH} onChange={(event) => setBulk({ ...bulk, weighted: event.target.value })} />
                    </div>
                )}
            </TeaModal>
        </div>
    );
};
