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
import { useMemo, useState } from 'react';

// TeaType
import { TeaCheckbox, TeaInput, TeaModal, TeaPanel, TeaSelect, TeaTable } from '@teatype/components';

// Components
import { BarChart, LineChart } from '@/components/StatsCharts';

// Hooks
import { useParam } from '@/hooks/useRoute';
import type { tData } from '@/hooks/useTickfit';

// Utility
import { shortDate, today } from '@/tools/dates';
import {
    buildStats,
    delta,
    exerciseDetail,
    exerciseTotals,
    formatMinutes,
    formatNumber,
    formatSet,
    personalRecords,
    planStats,
    rangeOf,
    unitOf,
    weeklyStats,
} from '@/tools/stats';
import { mainUnit } from '@/tools/training';
import type { iExerciseDetail, iPREvent, iRange, iRecord, iStatsContext, iWeek, tRangeKind, tRecordKind } from '@/tools/stats';

// Types
import type { iExercise } from '@/types';

interface iStatsViewProps {
    data: tData;
}

type tTab = 'exercises' | 'plans' | 'prs' | 'weeks';

const TABS: { id: tTab; label: string }[] = [
    { id: 'weeks', label: 'Weeks' },
    { id: 'prs', label: 'PRs' },
    { id: 'exercises', label: 'Exercises' },
    { id: 'plans', label: 'Plans' },
];

const RANGES: { label: string; value: tRangeKind }[] = [
    { label: 'All time', value: 'all' },
    { label: 'Last 12 weeks', value: 'weeks12' },
    { label: 'This year', value: 'year' },
    { label: 'Custom', value: 'custom' },
];

const CHART_WEEKS = 52;
const FEED_SIZE = 8;

const RECORD_LABEL: Record<tRecordKind, string> = { e1rm: 'Est. 1RM', value: 'Best set', volume: 'Set volume', weight: 'Heaviest' };

const dash = '–';

/** The change to the week before: up is green, down orange, nothing if it is not known */
const Delta = ({ format = formatNumber, value }: { format?: (value: number) => string; value: number | null }) =>
    value === null ? null : (
        <small className={`delta ${value > 0 ? 'delta--up' : value < 0 ? 'delta--down' : ''}`}>
            {value > 0 ? '+' : value < 0 ? '−' : '±'}
            {format(Math.abs(value))}
        </small>
    );

const Cell = ({ delta: change, format, text }: { delta?: number | null; format?: (value: number) => string; text: string }) => (
    <div className='cell'>
        <span>{text}</span>
        {change !== undefined && <Delta format={format} value={change} />}
    </div>
);

const timeText = (week: Pick<iWeek, 'minutes' | 'sessions' | 'timed'>): string =>
    week.minutes === null ? dash : `${week.timed < week.sessions ? '~' : ''}${formatMinutes(week.minutes)}`;

// ---- Weeks

const WeeksTab = ({ ctx }: { ctx: iStatsContext }) => {
    const weeks = useMemo(() => weeklyStats(ctx), [ctx]);
    const shown = weeks.slice(-CHART_WEEKS);
    const charts: { format?: (value: number) => string; title: string; value: (week: iWeek) => number | null }[] = [
        { title: 'Sessions', value: (week) => week.sessions },
        { title: 'Sets', value: (week) => week.sets },
        { title: 'Reps', value: (week) => week.reps },
        { title: 'Volume (kg)', value: (week) => week.volume },
        { format: formatMinutes, title: 'Training time', value: (week) => week.minutes },
    ];

    const timed = weeks.filter((week) => week.minutes !== null);
    const totals = [
        ['Sessions', formatNumber(ctx.sessions.length)],
        ['Sets', formatNumber(weeks.reduce((sum, week) => sum + week.sets, 0))],
        ['Reps', formatNumber(weeks.reduce((sum, week) => sum + week.reps, 0))],
        ['Volume (kg)', formatNumber(weeks.reduce((sum, week) => sum + week.volume, 0))],
        ['Time', timed.length ? formatMinutes(timed.reduce((sum, week) => sum + (week.minutes ?? 0), 0)) : dash],
    ];

    type tRow = { previous?: iWeek; week: iWeek };
    const rows: tRow[] = [...weeks].reverse().map((week, index, list) => ({ previous: list[index + 1], week }));
    const columns = [
        { key: 'week', header: 'Week', render: ({ week }: tRow) => <div className='cell'><strong>{week.label}</strong><small className='muted'>{shortDate(week.key)}</small></div> },
        { key: 'sessions', header: 'Sessions', render: ({ previous, week }: tRow) => <Cell delta={delta(week.sessions, previous?.sessions)} text={formatNumber(week.sessions)} /> },
        { key: 'sets', header: 'Sets', render: ({ previous, week }: tRow) => <Cell delta={delta(week.sets, previous?.sets)} text={formatNumber(week.sets)} /> },
        { key: 'reps', header: 'Reps', render: ({ previous, week }: tRow) => <Cell delta={delta(week.reps, previous?.reps)} text={formatNumber(week.reps)} /> },
        { key: 'volume', header: 'Volume (kg)', render: ({ previous, week }: tRow) => <Cell delta={delta(week.volume, previous?.volume)} text={formatNumber(week.volume)} /> },
        { key: 'minutes', header: 'Time', render: ({ previous, week }: tRow) => <Cell delta={delta(week.minutes, previous?.minutes)} format={formatMinutes} text={timeText(week)} /> },
    ];

    return (
        <>
            <div className='stats__tiles'>
                {totals.map(([title, value]) => (
                    <TeaPanel key={title} size='full' title={title} variant='stat'>{value}</TeaPanel>
                ))}
            </div>

            <div className='stats__charts'>
                {charts.map((chart) => (
                    <TeaPanel key={chart.title} className='stats__chart' size='full' variant='card'>
                        <h3>{chart.title}</h3>
                        <BarChart data={shown.map((week) => ({ label: week.label, value: chart.value(week) }))} format={chart.format} />
                    </TeaPanel>
                ))}
            </div>
            <p className='muted'>Training time only counts sessions that were timed (started and finished in the app), older ones show {dash}. A ~ means only some of the week's sessions were timed.</p>

            <TeaTable className='stats__table' columns={columns} data={rows} keyExtractor={({ week }) => week.key} />
        </>
    );
};

// ---- PRs

const describe = (exercise: iExercise, record: Pick<iRecord, 'kind' | 'reps' | 'value' | 'weight'>): { detail: string; main: string } => {
    const set = formatSet(exercise, { kind: '', value: record.reps ?? 0, weight: record.weight ?? 0 });
    if (record.kind === 'value') {
        return { detail: record.weight ? set : '', main: `${formatNumber(record.value)} ${unitOf(exercise)}` };
    }
    return { detail: set, main: `${formatNumber(record.value)} kg` };
};

const recordLabel = (exercise: iExercise, kind: tRecordKind): string => {
    if (kind !== 'value') {
        return RECORD_LABEL[kind];
    }
    const unit = mainUnit(exercise);
    return unit === 'reps' ? 'Most reps' : unit === 'minutes' || unit === 'seconds' ? 'Longest' : 'Furthest';
};

const RecentFeed = ({ events, onOpen }: { events: iPREvent[]; onOpen: (id: string) => void }) => {
    const [all, setAll] = useState(false);

    return (
        <section className='stats__feed'>
            <h2>Recent PRs <span className='muted'>last 30 days</span></h2>
            {!events.length && <p className='muted'>No records broken in the last 30 days.</p>}
            {events.slice(0, all ? undefined : FEED_SIZE).map((event) => {
                const { detail, main } = describe(event.exercise, event);
                return (
                    <button key={`${event.exercise.id}${event.kind}${event.date}`} className='feed__item' onClick={() => onOpen(event.exercise.id)}>
                        <span className='badge badge--done'>PR</span>
                        <span className='feed__text'>
                            <strong>{event.exercise.name}</strong> {recordLabel(event.exercise, event.kind)} {main}
                            {detail && <span className='muted'> ({detail})</span>}
                            <span className='muted'> · before {formatNumber(event.previous)}{event.kind === 'value' ? ` ${unitOf(event.exercise)}` : ' kg'}</span>
                        </span>
                        <span className='muted'>{shortDate(event.date)}</span>
                    </button>
                );
            })}
            {events.length > FEED_SIZE && <button className='link' onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all ${events.length}`}</button>}
        </section>
    );
};

const PRsTab = ({ ctx, onOpen }: { ctx: iStatsContext; onOpen: (id: string) => void }) => {
    const [query, setQuery] = useState('');
    const [onlyRecent, setOnlyRecent] = useState(false);
    const { boards, recent } = useMemo(() => personalRecords(ctx), [ctx]);

    const shown = boards.filter(
        (board) => board.exercise.name.toLowerCase().includes(query.trim().toLowerCase()) && (!onlyRecent || board.records.some((record) => record.recent) || board.repsAtWeight.some((row) => row.recent)),
    );

    return (
        <>
            <RecentFeed events={recent} onOpen={onOpen} />

            <div className='stats__filters'>
                <input className='search' type='search' placeholder='Search exercise' value={query} onChange={(event) => setQuery(event.target.value)} />
                <TeaCheckbox checked={onlyRecent} label='With a PR in the last 30 days' onChange={setOnlyRecent} />
            </div>
            <p className='muted'>Records come from normal and drop sets. Partial and assisted sets do not count. The estimated 1RM (Epley) uses sets of up to 12 reps.</p>

            {!shown.length && <div className='empty'>{boards.length ? 'Nothing found.' : 'No sets with values yet.'}</div>}
            <div className='stats__cards'>
                {shown.map(({ exercise, last, records, repsAtWeight }) => (
                    <TeaPanel key={exercise.id} className='stats__card' size='full' variant='card'>
                        <button className='stats__name' onClick={() => onOpen(exercise.id)}>{exercise.name}</button>
                        <span className='muted'>last trained {shortDate(last)}</span>
                        <dl className='records'>
                            {records.map((record) => {
                                const { detail, main } = describe(exercise, record);
                                return (
                                    <div key={record.kind} className={`records__item ${record.recent ? 'records__item--new' : ''}`}>
                                        <dt>{recordLabel(exercise, record.kind)}{record.recent && <span className='badge badge--done'>PR</span>}</dt>
                                        <dd>
                                            <strong>{main}</strong>
                                            <span className='muted'>{[detail, shortDate(record.date)].filter(Boolean).join(' · ')}</span>
                                        </dd>
                                    </div>
                                );
                            })}
                        </dl>
                        {repsAtWeight.length > 0 && (
                            <details className='stats__reps'>
                                <summary>Most reps at a weight ({repsAtWeight.length})</summary>
                                <ul>
                                    {repsAtWeight.map((row) => (
                                        <li key={row.weight}>
                                            <strong>{formatNumber(row.reps)} × {formatNumber(row.weight)}</strong>
                                            {row.recent && <span className='badge badge--done'>PR</span>}
                                            <span className='muted'>{shortDate(row.date)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </TeaPanel>
                ))}
            </div>
        </>
    );
};

// ---- Exercises

type tTotals = ReturnType<typeof exerciseTotals>[number];

const SORT: Record<string, (a: tTotals, b: tTotals) => number> = {
    alternatives: (a, b) => a.alternatives - b.alternatives,
    first: (a, b) => a.first.localeCompare(b.first),
    last: (a, b) => a.last.localeCompare(b.last),
    name: (a, b) => a.exercise.name.localeCompare(b.exercise.name),
    reps: (a, b) => a.reps - b.reps,
    sessions: (a, b) => a.sessions - b.sessions,
    sets: (a, b) => a.sets - b.sets,
    volume: (a, b) => a.volume - b.volume,
};

const ExercisesTab = ({ ctx, onOpen }: { ctx: iStatsContext; onOpen: (id: string) => void }) => {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<{ direction: 'asc' | 'desc' | null; key: string | null }>({ direction: 'desc', key: 'last' });
    const totals = useMemo(() => exerciseTotals(ctx), [ctx]);

    const compare = SORT[sort.direction && sort.key ? sort.key : 'name'];
    const rows = totals
        .filter((row) => row.exercise.name.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => (compare(a, b) || SORT.name(a, b)) * (sort.direction === 'desc' ? -1 : 1));

    const columns = [
        { key: 'name', header: 'Exercise', sortable: true, render: (row: tTotals) => <button className='stats__name' onClick={() => onOpen(row.exercise.id)}>{row.exercise.name}</button> },
        { key: 'sessions', header: 'Sessions', sortable: true, render: (row: tTotals) => formatNumber(row.sessions) },
        { key: 'sets', header: 'Sets', sortable: true, render: (row: tTotals) => formatNumber(row.sets) },
        { key: 'reps', header: 'Reps / total', sortable: true, render: (row: tTotals) => `${formatNumber(row.reps)}${mainUnit(row.exercise) === 'reps' ? '' : ` ${unitOf(row.exercise)}`}` },
        { key: 'volume', header: 'Volume (kg)', sortable: true, render: (row: tTotals) => (row.volume ? formatNumber(row.volume) : dash) },
        { key: 'first', header: 'First', sortable: true, render: (row: tTotals) => shortDate(row.first) },
        { key: 'last', header: 'Last', sortable: true, render: (row: tTotals) => shortDate(row.last) },
        { key: 'alternatives', header: 'As alternative', sortable: true, render: (row: tTotals) => (row.alternatives ? `${row.alternatives}×` : dash) },
    ];

    return (
        <>
            <div className='stats__filters'>
                <input className='search' type='search' placeholder='Search exercise' value={query} onChange={(event) => setQuery(event.target.value)} />
                <span className='muted'>{rows.length} exercise{rows.length === 1 ? '' : 's'}. Click one for its progression.</span>
            </div>
            <TeaTable
                className='stats__table'
                columns={columns}
                data={rows}
                emptyMessage='Nothing found.'
                keyExtractor={(row) => row.exercise.id}
                sortDirection={sort.direction}
                sortKey={sort.key}
                onSort={(key, direction) => setSort({ direction, key })}
            />
        </>
    );
};

const ExerciseModal = ({ ctx, id, onClose }: { ctx: iStatsContext; id: string | null; onClose: () => void }) => {
    const detail = useMemo(() => (id ? exerciseDetail(ctx, id) : null), [ctx, id]);
    const totals = detail?.totals;
    const exercise = totals?.exercise;

    return (
        <TeaModal isOpen={id !== null} size='lg' title={exercise?.name ?? 'Exercise'} onClose={onClose}>
            {detail && totals && exercise && <ExerciseDetail detail={detail} exercise={exercise} totals={totals} />}
        </TeaModal>
    );
};

const ExerciseDetail = ({ detail, exercise, totals }: { detail: iExerciseDetail; exercise: iExercise; totals: tTotals }) => {
    const weighted = Boolean(exercise.weighted);
    const unit = unitOf(exercise);
    const hasE1rm = detail.points.some((point) => point.e1rm !== null);
    const top = weighted ? 'Best weight' : 'Best set';

    return (
        <div className='stats__detail'>
            <p className='muted'>
                {unit}{weighted ? ' · kg' : ''}{exercise.category ? ` · ${exercise.category}` : ''} · {totals.sessions} session{totals.sessions === 1 ? '' : 's'} · {totals.sets} sets · {shortDate(totals.first)} → {shortDate(totals.last)}
            </p>
            {detail.replacedBy.length > 0 && <p className='muted'>Done instead of this: {detail.replacedBy.map((row) => `${row.exercise.name} (${row.sessions}×)`).join(', ')}</p>}
            {totals.alternatives > 0 && <p className='muted'>Done as an alternative in {totals.alternatives} session{totals.alternatives === 1 ? '' : 's'}.</p>}

            <h3>{weighted ? 'Best weight and estimated 1RM (kg)' : `Best set (${unit})`}</h3>
            <LineChart
                series={[
                    { name: top, points: detail.points.map((point) => ({ date: point.date, value: point.top })) },
                    ...(hasE1rm ? [{ name: 'Est. 1RM', points: detail.points.map((point) => ({ date: point.date, value: point.e1rm })) }] : []),
                ]}
            />
            <div className='chart__legend'>
                <span className='chart__key chart__key--0'>{top}</span>
                {hasE1rm && <span className='chart__key chart__key--1'>Est. 1RM</span>}
            </div>

            <h3>{mainUnit(exercise) === 'reps' && weighted ? 'Volume per session (kg)' : `Total per session (${unit})`}</h3>
            <BarChart data={detail.points.map((point) => ({ label: shortDate(point.date), value: point.volume }))} />

            <h3>Sessions</h3>
            <TeaTable
                className='stats__table'
                columns={[
                    { key: 'date', header: 'Date', render: (row) => shortDate(row.date) },
                    {
                        key: 'sets',
                        header: weighted && mainUnit(exercise) === 'reps' ? 'Sets (reps × kg)' : 'Sets',
                        render: (row) => <span>{row.label}{row.alternative && <small className='muted'> (alternative)</small>}</span>,
                    },
                ]}
                data={detail.sessions}
                keyExtractor={(row) => row.session}
            />

            {detail.comments.length > 0 && (
                <>
                    <h3>Comments</h3>
                    <ul className='stats__comments'>
                        {detail.comments.map((comment, index) => (
                            <li key={index}><span className='muted'>{shortDate(comment.date)}</span> {comment.text}</li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
};

// ---- Plans

const PlansTab = ({ ctx }: { ctx: iStatsContext }) => {
    const rows = useMemo(() => planStats(ctx), [ctx]);
    type tRow = (typeof rows)[number];
    const shared = rows.filter((row) => row.shared > 0);

    const columns = [
        {
            key: 'name',
            header: 'Plan',
            render: (row: tRow) => (
                <div className='cell'>
                    <strong>{row.name}</strong>
                    {row.plan?.default && row.plan.active && <span className='badge badge--done'>Default</span>}
                    {row.plan?.active && !row.plan.default && <span className='badge'>Active</span>}
                </div>
            ),
        },
        { key: 'sessions', header: 'Sessions', render: (row: tRow) => formatNumber(row.sessions) },
        { key: 'weeks', header: 'Weeks', render: (row: tRow) => formatNumber(row.weeks) },
        { key: 'volume', header: 'Volume (kg)', render: (row: tRow) => (row.volume ? formatNumber(row.volume) : dash) },
        { key: 'range', header: 'First → last session', render: (row: tRow) => (row.sessions ? `${shortDate(row.first)} → ${shortDate(row.last)}` : dash) },
    ];

    return (
        <>
            <p className='muted'>
                {shared.length
                    ? `A workout that is in several plans (${shared.map((row) => row.name).join(', ')}) is counted for each of them, so the plans add up to more than all sessions.`
                    : 'Sessions count for the plan that has the workout (all its versions).'}
            </p>
            <TeaTable className='stats__table' columns={columns} data={rows} emptyMessage='No plans yet.' keyExtractor={(row) => row.id || 'none'} />
        </>
    );
};

// ---- Page

/** What was trained: week by week, the records, each exercise and each plan, for a range of dates */
export const StatsView = ({ data }: iStatsViewProps) => {
    // Tab, range and the open exercise are in the address, a reload stays where it was
    const [tabParam, setTab] = useParam('tab', 'weeks');
    const [kindParam, setKind] = useParam('range', 'all');
    const [from, setFrom] = useParam('from');
    const [to, setTo] = useParam('to');
    const [openParam, setOpen] = useParam('open');
    const tab = (TABS.find((item) => item.id === tabParam)?.id ?? 'weeks') as tTab;
    const kind = (RANGES.find((item) => item.value === kindParam)?.value ?? 'all') as tRangeKind;
    const custom = useMemo<iRange>(() => ({ from, to }), [from, to]);
    const open = openParam || null;

    const { entries, exercises, planDays, plans, sessions, sets, slots, workouts } = data;
    const range = useMemo(() => rangeOf(kind, today(), custom), [kind, custom]);
    const ctx = useMemo(
        () => buildStats({ entries: entries.rows, exercises: exercises.rows, planDays: planDays.rows, plans: plans.rows, sessions: sessions.rows, sets: sets.rows, slots: slots.rows, workouts: workouts.rows }, range),
        [entries.rows, exercises.rows, planDays.rows, plans.rows, range, sessions.rows, sets.rows, slots.rows, workouts.rows],
    );
    const anyDone = sessions.rows.some((session) => session.status === 'done');

    return (
        <div className='page stats'>
            <header className='page__head'>
                <h1>Statistics</h1>
                <div className='stats__range'>
                    <TeaSelect aria-label='Range' options={RANGES} value={kind} onChange={(event) => setKind(event.target.value)} />
                    {kind === 'custom' && (
                        <>
                            <TeaInput aria-label='From' max={custom.to || undefined} type='date' value={custom.from ?? ''} onChange={(event) => setFrom(event.target.value)} />
                            <TeaInput aria-label='To' min={custom.from || undefined} type='date' value={custom.to ?? ''} onChange={(event) => setTo(event.target.value)} />
                        </>
                    )}
                </div>
            </header>

            <div className='seg' role='tablist'>
                {TABS.map((item) => (
                    <button key={item.id} aria-selected={tab === item.id} className={`seg__item ${tab === item.id ? 'seg__item--on' : ''}`} role='tab' onClick={() => setTab(item.id)}>
                        {item.label}
                    </button>
                ))}
            </div>

            {!ctx.sessions.length && (
                <div className='empty'>
                    <h2>{anyDone ? 'Nothing in this range' : 'No statistics yet'}</h2>
                    {anyDone ? 'No finished workouts between these dates.' : 'They appear here once a workout is finished.'}
                </div>
            )}
            {ctx.sessions.length > 0 && (
                <>
                    {tab === 'weeks' && <WeeksTab ctx={ctx} />}
                    {tab === 'prs' && <PRsTab ctx={ctx} onOpen={setOpen} />}
                    {tab === 'exercises' && <ExercisesTab ctx={ctx} onOpen={setOpen} />}
                    {tab === 'plans' && <PlansTab ctx={ctx} />}
                </>
            )}

            <ExerciseModal ctx={ctx} id={open} onClose={() => setOpen('')} />
        </div>
    );
};
