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
import { useRef, useState } from 'react';

// TeaType
import { TeaButton, TeaCheckbox, TeaInput, TeaModal, TeaSelect, TeaTextarea, useConfirm } from '@teatype/components';

// Components
import { Thumb } from '@/components/Thumb';

// Hooks
import type { tData } from '@/hooks/useTickfit';

// Utility
import { shrink } from '@/tools/image';

// Types
import type { iExercise, tUnit } from '@/types';

interface iExercisesViewProps {
    data: tData;
}

// An exercise that is being made or changed, id is empty for a new one
type tDraft = Omit<iExercise, 'id'> & { id: string };

const UNITS: { label: string; value: tUnit }[] = [
    { label: 'Reps', value: 'reps' },
    { label: 'Minutes', value: 'minutes' },
    { label: 'Meters', value: 'meters' },
];

const BLANK: tDraft = { id: '', image: '', name: '', notes: '', unit: 'reps', weighted: true };

/** The exercises with their pictures, which the workouts are built from */
export const ExercisesView = ({ data }: iExercisesViewProps) => {
    const confirm = useConfirm();
    const [draft, setDraft] = useState<tDraft | null>(null);
    const [query, setQuery] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const file = useRef<HTMLInputElement>(null);

    const matching = data.exercises.rows
        .filter((exercise) => exercise.name.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name));
    const shown = matching.filter((exercise) => !exercise.archived);
    const archived = matching.filter((exercise) => exercise.archived);
    const archivedCount = data.exercises.rows.filter((exercise) => exercise.archived).length;
    const away = Boolean(draft?.archived);

    const save = () => {
        if (!draft?.name.trim()) {
            return;
        }
        const { id, ...fields } = { ...draft, name: draft.name.trim() };
        setDraft(null);
        if (id) {
            data.exercises.patch(id, fields);
        } else {
            data.exercises.add(fields);
        }
    };

    // Put away: kept for what was logged with it, not offered for new workout lines
    const archive = (archived: boolean) => {
        if (draft?.id) {
            data.exercises.patch(draft.id, { archived });
            setDraft(null);
        }
    };

    const remove = async () => {
        if (!draft?.id) {
            return;
        }
        const used = data.slots.rows.filter((slot) => slot.exercise === draft.id).length;
        const ok = await confirm({
            title: 'Delete exercise',
            message: used
                ? `${draft.name} is used in ${used} workout line${used === 1 ? '' : 's'}. They are deleted with everything that was logged for them.`
                : `Delete ${draft.name}?`,
            confirmText: 'Delete',
            variant: 'danger',
        });
        if (ok) {
            const id = draft.id;
            setDraft(null);
            data.removeExercise(id);
        }
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

    return (
        <div className='page'>
            <header className='page__head'>
                <h1>Exercises</h1>
                <input className='search' type='search' placeholder='Search' value={query} onChange={(event) => setQuery(event.target.value)} />
                <TeaButton theme='filled' onClick={() => setDraft(BLANK)}>New exercise</TeaButton>
            </header>

            {!shown.length && <div className='empty'>{data.exercises.rows.length - archivedCount ? 'Nothing found.' : 'No exercises yet.'}</div>}

            <div className='cards'>
                {shown.map((exercise) => (
                    <button key={exercise.id} className='card' onClick={() => setDraft({ ...BLANK, ...exercise })}>
                        <Thumb exercise={exercise} size='large' />
                        <strong>{exercise.name}</strong>
                        <span className='muted'>{exercise.unit}{exercise.weighted ? ' · kg' : ''}</span>
                    </button>
                ))}
            </div>

            {archivedCount > 0 && (
                <div className='list'>
                    <button className='list__toggle' onClick={() => setShowArchived(!showArchived)}>
                        {showArchived ? '▾' : '▸'} Archived ({archivedCount})
                    </button>
                    {showArchived && (
                        <div className='cards'>
                            {archived.map((exercise) => (
                                <button key={exercise.id} className='card card--archived' onClick={() => setDraft({ ...BLANK, ...exercise })}>
                                    <Thumb exercise={exercise} size='large' />
                                    <strong>{exercise.name}</strong>
                                    <span className='muted'>{exercise.unit}{exercise.weighted ? ' · kg' : ''}</span>
                                </button>
                            ))}
                            {!archived.length && <div className='empty'>Nothing found.</div>}
                        </div>
                    )}
                </div>
            )}

            <TeaModal
                isOpen={draft !== null}
                title={draft?.id ? 'Exercise' : 'New exercise'}
                footer={
                    <div className='modal-actions'>
                        {draft?.id && <TeaButton theme='danger' onClick={() => void remove()}>Delete</TeaButton>}
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
                        <TeaSelect label='Counted in' value={draft.unit} options={UNITS} onChange={(event) => setDraft({ ...draft, unit: event.target.value as tUnit })} />
                        <TeaCheckbox label='With weight (kg)' checked={!!draft.weighted} onChange={(weighted) => setDraft({ ...draft, weighted })} />
                        <TeaTextarea label='Notes' rows={3} placeholder='Seat height, grip, cues …' value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
                    </fieldset>
                )}
            </TeaModal>
        </div>
    );
};
