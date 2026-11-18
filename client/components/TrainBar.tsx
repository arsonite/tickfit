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
import { useEffect, useRef } from 'react';

// Hooks
import type { tData } from '@/hooks/useTickfit';
import { useNow } from '@/hooks/useNow';

// Utility
import { clock, hasOpenRest, isRunning } from '@/tools/training';

import { Icon } from '@/components/Icon';

// Types
import type { iSession, iSet } from '@/types';

interface iTrainBarProps {
    /** Start the next set of the exercise when the rest is over */
    autoStart: boolean;
    data: tData;
    /** Pause between sets (s) when the workout has none of its own */
    defaultRest: number;
    session: iSession;
    vibrate: boolean;

    /** What a set is called, e.g. "Standing Calf Raises · set 2" */
    describe: (set: iSet) => string;
    /** The next set of the exercise (or superset) that is going on. Without one the lifter picks the next exercise. */
    next?: iSet;
    /** There is something left to pick */
    open: boolean;

    /** Finishes the set (and starts the rest by itself when the exercise goes on) */
    onFinish: (set: iSet) => void;
}

/**
 * The clock of the training and what is going on. While a set runs the bar is green. Inside an exercise or a superset
 * the rest starts by itself after a round and the next set is shown. When an exercise is done the lifter picks the
 * next one in the list, the rest can still be started by hand.
 */
export const TrainBar = ({ autoStart, data, defaultRest, describe, next, onFinish, open, session, vibrate }: iTrainBarProps) => {
    const now = useNow(true);
    const workout = data.workoutById.get(session.workout);
    const target = (workout?.rest_seconds || defaultRest) * 1000;
    const mine = data.sets.rows.filter((set) => set.session === session.id);

    const running = mine.find(isRunning);
    const resting = mine.find(hasOpenRest);
    const lastDone = mine.filter((set) => set.ended_at).sort((a, b) => (b.ended_at ?? 0) - (a.ended_at ?? 0))[0];
    const canRest = Boolean(lastDone && !resting && !lastDone.rest_started_at);
    const restDone = Boolean(lastDone?.rest_started_at && lastDone.rest_ended_at);

    const elapsed = resting ? now - (resting.rest_started_at ?? now) : 0;
    const over = Boolean(resting && target && elapsed > target);
    const due = Boolean(autoStart && resting && target && next && elapsed >= target);

    // A short buzz when the rest is used up, once per rest
    const buzzed = useRef<string | null>(null);
    useEffect(() => {
        if (vibrate && resting && over && buzzed.current !== resting.id) {
            buzzed.current = resting.id;
            navigator.vibrate?.(250);
        }
    }, [over, resting, vibrate]);

    // The rest is used up: on to the next set, which ends the rest
    const nextId = next?.id;
    const started = useRef<string | null>(null);
    useEffect(() => {
        if (due && nextId && resting && started.current !== resting.id) {
            started.current = resting.id;
            data.training.startSet(nextId);
        }
    }, [data.training, due, nextId, resting]);

    return (
        <div className={`trainbar ${running ? 'trainbar--set' : next ? 'trainbar--rest' : ''}`}>
            <div className='trainbar__clock' title='Training time'>
                {clock(now - (session.started_at ?? now))}
            </div>

            {running ? (
                <>
                    <div className='trainbar__phase'>
                        <span className='trainbar__label'>Set · {clock(now - (running.started_at ?? now))}</span>
                        <span className='trainbar__what'>{describe(running)}</span>
                    </div>
                    <button className='trainbar__go' onClick={() => onFinish(running)}>
                        Finish set <Icon name='check' />
                    </button>
                </>
            ) : (
                <>
                    <div className='trainbar__phase'>
                        <span className='trainbar__label'>{next ? 'Next set' : open ? 'Pick the next exercise' : 'Nothing open anymore'}</span>
                        <span className='trainbar__what'>{next ? describe(next) : open ? 'Start a set of it in the list below' : 'Finish the workout when you are done'}</span>
                    </div>

                    {resting ? (
                        <>
                            <div className={`trainbar__rest ${over ? 'trainbar__rest--over' : ''}`}>
                                <span>Rest {over ? `+${clock(elapsed - target)}` : clock(target - elapsed)}</span>
                                <span className='trainbar__fill' style={{ width: `${Math.min(100, (elapsed / target) * 100)}%` }} />
                            </div>
                            <button className='mini mini--wide' onClick={() => data.training.endRest(session.id)}>
                                Skip
                            </button>
                        </>
                    ) : (
                        canRest && (
                            <button className='trainbar__rest-btn' onClick={() => lastDone && data.training.startRest(lastDone.id)}>
                                Start rest · {clock(target)}
                            </button>
                        )
                    )}
                    {restDone && !resting && <span className='muted trainbar__hint'>Rested {clock((lastDone?.rest_ended_at ?? 0) - (lastDone?.rest_started_at ?? 0))}</span>}

                    {next && (
                        <button className='trainbar__go' title={describe(next)} onClick={() => data.training.startSet(next.id)}>
                            <Icon name='play' /> {describe(next)}
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

/** On the other pages: a training is going on, and the way back to it */
export const TrainBanner = ({ data, onOpen }: { data: tData; onOpen: (id: string) => void }) => {
    const session = data.training.session;
    const now = useNow(Boolean(session));
    if (!session) {
        return null;
    }
    return (
        <button className='trainbanner' onClick={() => onOpen(session.id)}>
            <span>Training · {data.workoutById.get(session.workout)?.name}</span>
            <strong>{clock(now - (session.started_at ?? now))}</strong>
        </button>
    );
};
