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
import { useEffect, useState } from 'react';

// TeaType
import { TeaButton, TeaModal, TeaSelect, useConfirm } from '@teatype/components';

// Hooks
import type { tData } from '@/hooks/useTickfit';

// Utility
import { ROMAN, addDays, calendarWeek, mondayOf, shortDate, today, weekDays, weekdayName } from '@/tools/dates';

// Types
import type { iSession } from '@/types';

interface iWeekViewProps {
    data: tData;

    onNavigate: (view: 'plans') => void;
    onOpen: (sessionId: string) => void;
}

const MAX_WEEKS_AHEAD = 26;

const STATUS_LABEL = { done: 'Done', planned: 'Planned', skipped: 'Skipped' };

/** The calendar week: seven days with the workout of each, which can be moved around by hand */
export const WeekView = ({ data, onNavigate, onOpen }: iWeekViewProps) => {
    const confirm = useConfirm();
    const [monday, setMonday] = useState(() => mondayOf(today()));
    const [menu, setMenu] = useState<string | null>(null); // The date whose actions are open
    const [adding, setAdding] = useState<string | null>(null);
    const [pick, setPick] = useState('');

    const days = weekDays(monday);
    const { ensure } = data;
    const now = today();
    const week = calendarWeek(monday);

    // The schedule is written ahead of the week that is shown
    useEffect(() => {
        ensure(addDays(monday, 6));
    }, [ensure, monday]);

    if (!data.activePlan) {
        return (
            <div className='empty'>
                <h2>No plan yet</h2>
                <p className='muted'>The week fills itself from the plan you activate.</p>
                <div className='empty__actions'>
                    {!data.workouts.rows.length && <TeaButton theme='filled' onClick={data.seed}>Add the example plan</TeaButton>}
                    <TeaButton onClick={() => onNavigate('plans')}>Create a plan</TeaButton>
                </div>
            </div>
        );
    }

    const sessionOn = (date: string): iSession | undefined => data.sessions.rows.find((session) => session.date === date);
    const workoutName = (session?: iSession) => data.workoutById.get(session?.workout ?? '')?.name ?? '?';
    const workouts = [...data.workouts.rows].sort((a, b) => a.name.localeCompare(b.name));

    const remove = async (session: iSession) => {
        setMenu(null);
        const ok = await confirm({
            title: 'Remove day',
            message: session.status === 'done' ? `Remove ${workoutName(session)} with everything that was logged?` : `Remove ${workoutName(session)} from this day?`,
            confirmText: 'Remove',
            variant: 'danger',
        });
        if (ok) {
            data.removeSessions([session.id]);
        }
    };

    return (
        <div className='week'>
            <header className='week__head'>
                <div>
                    <h1>
                        Calendar week {week.week} <span className='muted'>{week.year}</span>
                    </h1>
                    <p className='muted'>
                        {shortDate(days[0])} – {shortDate(days[6])} · {data.activePlan.name}
                    </p>
                </div>
                <div className='week__nav'>
                    <TeaButton size='small' onClick={() => setMonday(addDays(monday, -7))}>‹</TeaButton>
                    <TeaButton size='small' disabled={monday === mondayOf(now)} onClick={() => setMonday(mondayOf(now))}>Today</TeaButton>
                    <TeaButton size='small' disabled={monday >= addDays(mondayOf(now), MAX_WEEKS_AHEAD * 7)} onClick={() => setMonday(addDays(monday, 7))}>›</TeaButton>
                </div>
            </header>

            <div className='week__grid'>
                {days.map((date, index) => {
                    const session = sessionOn(date);
                    const lastWeek = sessionOn(addDays(date, -7));
                    const workout = data.workoutById.get(session?.workout ?? '');
                    const open = menu === date;
                    return (
                        <article
                            key={date}
                            className={`day ${date === now ? 'day--today' : ''} ${session ? `day--${session.status}` : 'day--empty'} ${workout?.kind === 'rest' ? 'day--rest' : ''}`}
                        >
                            <div className='day__head'>
                                <span className='day__no'>Day {ROMAN[index]}</span>
                                <span className='muted'>{weekdayName(date)} · {shortDate(date)}</span>
                                {session && (
                                    <button className='mini' title='Move, skip or remove' onClick={() => setMenu(open ? null : date)}>⋯</button>
                                )}
                            </div>

                            {session ? (
                                <button className='day__body' onClick={() => onOpen(session.id)}>
                                    <strong>{workoutName(session)}</strong>
                                    {workout?.focus && <span className='muted'>{workout.focus}</span>}
                                    <span className={`badge badge--${session.status}`}>{STATUS_LABEL[session.status]}</span>
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
                                    Last week: {workoutName(lastWeek)}{lastWeek.status === 'done' ? ' ✓' : lastWeek.status === 'skipped' ? ' (skipped)' : ''}
                                </span>
                            )}

                            {session && open && (
                                <div className='day__menu'>
                                    <button onClick={() => { setMenu(null); data.moveDay(session.id, -1); }}>‹ Earlier</button>
                                    <button onClick={() => { setMenu(null); data.moveDay(session.id, 1); }}>Later ›</button>
                                    {session.status === 'planned' && (
                                        <>
                                            <button onClick={() => { setMenu(null); data.shiftDay(session.id, 1); }}>Push this and all after by a day</button>
                                            <button onClick={() => { setMenu(null); data.shiftDay(session.id, -1); }}>Pull this and all after back a day</button>
                                        </>
                                    )}
                                    {session.status !== 'done' && (
                                        <button onClick={() => { setMenu(null); data.sessions.patch(session.id, { status: session.status === 'skipped' ? 'planned' : 'skipped' }); }}>
                                            {session.status === 'skipped' ? 'Plan again' : 'Skip'}
                                        </button>
                                    )}
                                    <button className='danger' onClick={() => void remove(session)}>Remove</button>
                                </div>
                            )}
                        </article>
                    );
                })}
            </div>

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
                <TeaSelect label='Workout' value={pick} options={workouts.map((workout) => ({ label: workout.name, value: workout.id }))} onChange={(event) => setPick(event.target.value)} />
            </TeaModal>
        </div>
    );
};
