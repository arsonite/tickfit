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
import { TeaAutocomplete, TeaButton, TeaModal, TeaSelect, useConfirm } from '@teatype/components';
import { Icon } from '@/components/Icon';
import { usePointerDrag } from '@teatype/hooks/usePointerDrag';

// Hooks
import type { tData } from '@/hooks/useTickfit';

// Utility
import { ROMAN, addDays, calendarWeek, mondayOf, shortDate, today, weekDays, weekdayName } from '@/tools/dates';
import { isTrained, weekPlan } from '@/tools/training';

// Types
import type { iSession } from '@/types';

interface iWeekViewProps {
    data: tData;
    showLastWeek: boolean;

    onNavigate: (view: 'plans') => void;
    onOpen: (sessionId: string) => void;
}

const MAX_WEEKS_AHEAD = 52;

const STATUS_LABEL = { done: 'Done', planned: 'Planned', skipped: 'Skipped' };

/** The calendar week: seven days with the workout of each. Days are put there by hand or with a plan and moved by dragging. */
export const WeekView = ({ data, onNavigate, onOpen, showLastWeek }: iWeekViewProps) => {
    const confirm = useConfirm();
    const [monday, setMonday] = useState(() => mondayOf(today()));
    const [menu, setMenu] = useState<string | null>(null); // The date whose actions are open
    const [adding, setAdding] = useState<string | null>(null);
    const [pick, setPick] = useState('');
    const [applying, setApplying] = useState(false);
    const [plan, setPlan] = useState('');

    const days = weekDays(monday);
    const now = today();
    const week = calendarWeek(monday);

    const sessionOn = (date: string): iSession | undefined =>
        data.sessions.rows.find((session) => session.date === date);
    const workoutName = (session?: iSession) => data.workoutById.get(session?.workout ?? '')?.name ?? '?';
    const workouts = [...data.workoutList].sort((a, b) => a.name.localeCompare(b.name));

    // Dropped on a day: that date. Dropped on an arrow of the week: the same weekday of the week before or after.
    const { drag, start } = usePointerDrag<string>({
        onDrop: (id, target) => {
            const session = data.sessions.current().find((row) => row.id === id);
            if (!session) {
                return;
            }
            if (target.startsWith('week:')) {
                const by = Number(target.slice(5)) * 7;
                data.moveDay(id, addDays(session.date, by));
                setMonday(addDays(monday, by));
            } else {
                data.moveDay(id, target.slice(4));
            }
        },
    });
    const dragged = data.sessions.rows.find((session) => session.id === drag?.item);

    const remove = async (session: iSession) => {
        setMenu(null);
        const ok = await confirm({
            title: 'Remove day',
            message:
                session.status === 'done'
                    ? `Remove ${workoutName(session)} with everything that was logged?`
                    : `Remove ${workoutName(session)} from this day?`,
            confirmText: 'Remove',
            variant: 'danger',
        });
        if (ok) {
            data.removeSessions([session.id]);
        }
    };

    const planOptions = data.activePlans.map((row) => ({
        label: row.id === data.defaultPlan?.id ? `${row.name} (default)` : row.name,
        value: row.id,
    }));
    const free = days.filter((date) => !sessionOn(date)).length;
    const made = weekPlan(days.map(sessionOn), data.plans.rows, data.planDays.rows, (id) => data.workoutById.get(id));

    return (
        <div className={`week ${drag ? 'week--dragging' : ''}`}>
            <header className='week__head'>
                <div>
                    <h1>
                        KW {week.week} <span className='muted'>{week.year}</span>
                    </h1>
                    <p className='muted'>
                        {shortDate(days[0])} – {shortDate(days[6])}
                        {made && (
                            <>
                                {' · '}
                                <span
                                    className={`badge ${made === 'Custom' ? '' : 'badge--done'}`}
                                    title={
                                        made === 'Custom'
                                            ? 'Days were added, changed or moved by hand'
                                            : 'This week is the plan'
                                    }
                                >
                                    {made === 'Custom' ? 'Custom' : `Plan: ${made}`}
                                </span>
                            </>
                        )}
                    </p>
                </div>
                <div className='week__nav'>
                    <div className='week__plan'>
                    <TeaButton
                        size='small'
                        onClick={() => {
                            setPlan(data.defaultPlan?.id ?? '');
                            setApplying(true);
                        }}
                    >
                        Add a plan
                    </TeaButton>
                    <TeaButton size='small' disabled={!free} onClick={() => data.fillRestDays(monday)}>
                        Fill with rest days
                    </TeaButton>
                    </div>
                    <div className='week__step'>
                    <span
                        className={`week__arrow ${drag?.target === 'week:-1' ? 'week__arrow--over' : ''}`}
                        data-drop='week:-1'
                    >
                        <TeaButton size='small' onClick={() => setMonday(addDays(monday, -7))}>
                            <Icon name='chevron-left' />
                        </TeaButton>
                    </span>
                    <TeaButton
                        size='small'
                        disabled={monday === mondayOf(now)}
                        onClick={() => setMonday(mondayOf(now))}
                    >
                        Today
                    </TeaButton>
                    <span
                        className={`week__arrow ${drag?.target === 'week:1' ? 'week__arrow--over' : ''}`}
                        data-drop='week:1'
                    >
                        <TeaButton
                            size='small'
                            disabled={monday >= addDays(mondayOf(now), MAX_WEEKS_AHEAD * 7)}
                            onClick={() => setMonday(addDays(monday, 7))}
                        >
                            <Icon name='chevron-right' />
                        </TeaButton>
                    </span>
                    </div>
                </div>
            </header>

            <div className='week__grid'>
                {days.map((date, index) => {
                    const session = sessionOn(date);
                    const lastWeek = showLastWeek ? sessionOn(addDays(date, -7)) : undefined;
                    const workout = data.workoutById.get(session?.workout ?? '');
                    const open = menu === date;
                    const locked = isTrained(session);
                    const over = drag?.target === `day:${date}`;
                    return (
                        <article
                            key={date}
                            data-drop={`day:${date}`}
                            className={`day ${open ? 'day--menu' : ''} ${date === now ? 'day--today' : ''} ${session ? `day--${session.status}` : 'day--empty'} ${workout?.kind === 'rest' ? 'day--rest' : ''} ${dragged?.id === session?.id && drag ? 'day--lifted' : ''} ${over ? (locked ? 'day--blocked' : 'day--over') : ''}`}
                        >
                            <div className='day__head'>
                                {session && !locked && (
                                    <button
                                        className='day__grip'
                                        title='Drag to another day'
                                        aria-label='Drag to another day'
                                        onPointerDown={start(session.id)}
                                    >
                                        ⠿
                                    </button>
                                )}
                                <span className='day__no'>Day {ROMAN[index]}</span>
                                <span className='muted'>
                                    {weekdayName(date)} · {shortDate(date)}
                                </span>
                                {session && (
                                    <button
                                        className='mini'
                                        title='Move, skip or remove'
                                        onClick={() => setMenu(open ? null : date)}
                                    >
                                        ⋯
                                    </button>
                                )}
                            </div>

                            {session ? (
                                <button className='day__body' onClick={() => onOpen(session.id)}>
                                    <strong>{workoutName(session)}</strong>
                                    {workout?.focus && <span className='muted'>{workout.focus}</span>}
                                    <span className={`badge badge--${session.status}`}>
                                        {STATUS_LABEL[session.status]}
                                    </span>
                                    {(workout?.kind === 'rest' || session.status !== 'planned' || date !== now) && (
                                        <Icon
                                            className='day__status'
                                            size={36}
                                            name={
                                                workout?.kind === 'rest'
                                                    ? 'moon'
                                                    : session.status === 'done'
                                                      ? 'check-circle'
                                                      : session.status === 'skipped'
                                                        ? 'skip'
                                                        : 'calendar'
                                            }
                                        />
                                    )}
                                </button>
                            ) : (
                                <button
                                    className='day__body day__body--add'
                                    onClick={() => {
                                        setPick(workouts[0]?.id ?? '');
                                        setAdding(date);
                                    }}
                                >
                                    + Add workout
                                </button>
                            )}

                            {lastWeek && (
                                <span className='day__last muted'>
                                    Last week: {workoutName(lastWeek)}
                                    {lastWeek.status === 'done'
                                        ? ' (done)'
                                        : lastWeek.status === 'skipped'
                                          ? ' (skipped)'
                                          : ''}
                                </span>
                            )}

                            {session && open && (
                                <div className='day__menu'>
                                    {session.status !== 'done' && (
                                        <button
                                            onClick={() => {
                                                setMenu(null);
                                                data.sessions.patch(session.id, {
                                                    status: session.status === 'skipped' ? 'planned' : 'skipped',
                                                });
                                            }}
                                        >
                                            {session.status === 'skipped' ? 'Plan again' : 'Skip'}
                                        </button>
                                    )}
                                    <button className='danger' onClick={() => void remove(session)}>
                                        Remove
                                    </button>
                                </div>
                            )}
                        </article>
                    );
                })}
            </div>

            {!data.workouts.rows.length && (
                <div className='empty'>
                    <p className='muted'>No workouts yet, create your own or start from an example.</p>
                    <div className='empty__actions'>
                        <TeaButton theme='filled' onClick={data.seed}>
                            Add the example plan
                        </TeaButton>
                        <TeaButton onClick={() => onNavigate('plans')}>Create a plan</TeaButton>
                    </div>
                </div>
            )}

            {drag && dragged && (
                <div className='day-ghost' style={{ left: drag.x, top: drag.y }}>
                    {workoutName(dragged)}
                </div>
            )}

            <TeaModal
                isOpen={adding !== null}
                title={adding ? `Add workout on ${weekdayName(adding)}` : ''}
                size='sm'
                footer={
                    <TeaButton
                        theme='filled'
                        disabled={!pick}
                        onClick={() => {
                            if (adding) {
                                data.addDay(adding, pick);
                            }
                            setAdding(null);
                        }}
                    >
                        Add
                    </TeaButton>
                }
                onClose={() => setAdding(null)}
            >
                <TeaAutocomplete
                    label='Workout'
                    value={pick}
                    options={workouts.map((workout) => ({ label: workout.name, value: workout.id }))}
                    onChange={setPick}
                />
            </TeaModal>

            <TeaModal
                isOpen={applying}
                title={`Add a plan to week ${week.week}`}
                size='sm'
                footer={
                    <TeaButton
                        theme='filled'
                        disabled={!plan}
                        onClick={() => {
                            data.applyPlan(plan, monday);
                            setApplying(false);
                        }}
                    >
                        Add to the free days
                    </TeaButton>
                }
                onClose={() => setApplying(false)}
            >
                {planOptions.length ? (
                    <>
                        <TeaSelect
                            label='Plan'
                            value={plan}
                            options={planOptions}
                            onChange={(event) => setPlan(event.target.value)}
                        />
                        <p className='muted'>
                            The days of the plan go on Monday, Tuesday, … of this week. Days that are filled already (
                            {7 - free} of 7) stay as they are, nothing else is changed.
                        </p>
                    </>
                ) : (
                    <p className='muted'>
                        There is no active plan.{' '}
                        <button className='link' onClick={() => onNavigate('plans')}>
                            Activate or create one
                        </button>
                    </p>
                )}
            </TeaModal>
        </div>
    );
};
