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
import { TeaAutocomplete, TeaButton, TeaInput, TeaTextarea, useConfirm } from '@teatype/components';

// Hooks
import { Icon } from '@/components/Icon';

import type { tData } from '@/hooks/useTickfit';

// Utility
import { ROMAN } from '@/tools/dates';

interface iPlansViewProps {
    data: tData;
}

/** The plans: up to seven days of a week, one workout each, put on the free days of a week with "Add a plan" in the calendar */
export const PlansView = ({ data }: iPlansViewProps) => {
    const confirm = useConfirm();
    const [selected, setSelected] = useState<string | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    const [search, setSearch] = useState('');

    const plans = [...data.planList].sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)) || a.name.localeCompare(b.name));
    // Put away: kept for the stats and for the weeks they were used in, shown read-only
    const archivedAll = data.plans.rows.filter((row) => row.archived);
    const archived = archivedAll.filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
    const plan = data.plans.rows.find((row) => row.id === selected) ?? data.defaultPlan ?? plans[0];
    const away = Boolean(plan?.archived);
    const isDefault = plan?.id === data.defaultPlan?.id;
    const days = plan ? data.planDays.rows.filter((day) => day.plan === plan.id).sort((a, b) => a.position - b.position) : [];
    const workouts = [...data.workoutList].sort((a, b) => a.name.localeCompare(b.name));
    const options = workouts.map((workout) => ({ label: workout.name, value: workout.id }));
    // A day can still use a workout that was archived afterwards
    const optionsFor = (current: string) => {
        const archived = data.workoutById.get(current);
        return archived?.archived ? [{ label: `${archived.name} (archived)`, value: archived.id }, ...options] : options;
    };

    const create = () => {
        setSelected(data.plans.add({ active: false, name: 'New plan' }).id);
        data.success('Plan created');
    };

    const addDay = () => {
        if (plan && workouts.length) {
            data.planDays.add({ plan: plan.id, position: (days[days.length - 1]?.position ?? -1) + 1, workout: workouts[0].id });
            data.success('Day added');
        }
    };

    const move = (index: number, delta: number) => {
        const other = days[index + delta];
        if (other) {
            data.planDays.patch(days[index].id, { position: other.position });
            data.planDays.patch(other.id, { position: days[index].position });
        }
    };

    const remove = async () => {
        if (!plan) {
            return;
        }
        const ok = await confirm({
            title: 'Delete plan',
            message: `Delete ${plan.name}? Days that are on the calendar already stay.`,
            confirmText: 'Delete',
            variant: 'danger',
        });
        if (ok) {
            setSelected(null);
            data.removePlan(plan.id);
        }
    };

    return (
        <div className='page page--split'>
            <aside className='list'>
                <header className='page__head'>
                    <h1>Plans</h1>
                    <TeaButton size='small' theme='filled' onClick={() => void create()}>New</TeaButton>
                </header>
                {plans.map((row) => (
                    <button key={row.id} className={`list__item ${row.active ? '' : 'list__item--off'} ${row.id === plan?.id ? 'list__item--on' : ''}`} onClick={() => setSelected(row.id)}>
                        {row.name}
                        {row.active && <span className='badge badge--done'>{row.id === data.defaultPlan?.id ? 'Default' : 'Active'}</span>}
                    </button>
                ))}
                {data.planDuplicates.length > 0 && (
                    <TeaButton size='small' onClick={data.removePlanDuplicates}>Remove {data.planDuplicates.length} duplicate{data.planDuplicates.length === 1 ? '' : 's'}</TeaButton>
                )}
                {!plans.length && <div className='empty'>No plans yet.</div>}
                {archivedAll.length > 0 && (
                    <>
                        <button className='list__toggle' onClick={() => setShowArchived(!showArchived)}>
                            <Icon name={showArchived ? 'chevron-down' : 'chevron-right'} /> Archived ({archivedAll.length})
                        </button>
                        {showArchived && (
                            <>
                                <TeaInput placeholder='Search archived' value={search} onChange={(event) => setSearch(event.target.value)} />
                                {archived.map((row) => (
                                    <button key={row.id} className={`list__item list__item--off ${row.id === plan?.id ? 'list__item--on' : ''}`} onClick={() => setSelected(row.id)}>
                                        {row.name}
                                    </button>
                                ))}
                            </>
                        )}
                    </>
                )}
            </aside>

            {plan && (
                <section className='editor'>
                    {away && <p className='editor__archived'>Archived: kept for the stats and cannot be changed or added to a week until it is unarchived.</p>}
                    <fieldset className='editor__body' disabled={away}>
                        <TeaInput label='Name' value={plan.name} onChange={(event) => data.plans.patch(plan.id, { name: event.target.value })} />
                        <TeaTextarea label='Notes' rows={2} value={plan.notes ?? ''} onChange={(event) => data.plans.patch(plan.id, { notes: event.target.value })} />

                        <h2>Days <span className='muted'>Monday, Tuesday, … in this order</span></h2>
                        {days.map((day, index) => (
                            <div key={day.id} className='slot__row'>
                                <span className='day__no'>Day {ROMAN[index] ?? index + 1}</span>
                                <TeaAutocomplete className='slot__exercise' value={day.workout} options={optionsFor(day.workout)} onChange={(workout) => data.planDays.patch(day.id, { workout })} />
                                <button className='mini' title='Up' disabled={index === 0} onClick={() => move(index, -1)}><Icon name='arrow-up' /></button>
                                <button className='mini' title='Down' disabled={index === days.length - 1} onClick={() => move(index, 1)}><Icon name='arrow-down' /></button>
                                <button className='mini' title='Remove' onClick={() => data.planDays.remove([day.id])}><Icon name='close' /></button>
                            </div>
                        ))}
                        <div className='editor__actions'>
                            <TeaButton disabled={!workouts.length || days.length >= 7} onClick={addDay}>Add day</TeaButton>
                            {!workouts.length && <span className='muted'>Create a workout first.</span>}
                        </div>
                    </fieldset>

                    <div className='editor__actions'>
                        {!away && (
                            <>
                                <TeaButton theme={plan.active ? undefined : 'filled'} onClick={() => data.setActive(plan.id, !plan.active)}>{plan.active ? 'Deactivate' : 'Activate'}</TeaButton>
                                {plan.active && !isDefault && <TeaButton onClick={() => data.setDefault(plan.id)}>Make default</TeaButton>}
                                <span className='muted'>
                                    {!plan.active
                                        ? 'Only active plans can be added to a week.'
                                        : isDefault
                                          ? 'Active, and offered first when adding a plan to a week.'
                                          : 'Active, can be added to a week.'}
                                </span>
                            </>
                        )}
                        <span className='grow' />
                        <TeaButton onClick={() => { data.archivePlan(plan.id, !away); if (!away) { setSelected(null); } }}>{away ? 'Unarchive' : 'Archive'}</TeaButton>
                        <TeaButton theme='danger' onClick={() => void remove()}>Delete plan</TeaButton>
                    </div>
                </section>
            )}
        </div>
    );
};
