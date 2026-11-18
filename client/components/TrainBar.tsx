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
import { clock, hasOpenRest } from '@/tools/training';

// Types
import type { iSession } from '@/types';

interface iTrainBarProps {
    data: tData;
    session: iSession;
    /** Sets after which a rest makes sense: not between the lines of a superset, not after the last set */
    restable: Set<string>;
}

/** The clock of the training, and the rest after a set: started by hand, because only the lifter knows when a set is over */
export const TrainBar = ({ data, session, restable }: iTrainBarProps) => {
    const now = useNow(true);
    const workout = data.workoutById.get(session.workout);
    const target = (workout?.rest_seconds ?? 0) * 1000;
    const mine = data.sets.rows.filter((set) => set.session === session.id);

    const resting = mine.find(hasOpenRest);
    // The last finished set that has no rest yet, as long as nothing was started after it
    const finished = mine.filter((set) => set.ended_at && !set.rest_started_at && restable.has(set.id)).sort((a, b) => (b.ended_at ?? 0) - (a.ended_at ?? 0))[0];
    const pending = finished && !mine.some((set) => (set.started_at ?? 0) > (finished.ended_at ?? 0)) ? finished : undefined;

    const elapsed = resting ? now - (resting.rest_started_at ?? now) : 0;
    const over = Boolean(resting && target && elapsed > target);

    // A short buzz when the rest is used up, once per rest
    const buzzed = useRef<string | null>(null);
    useEffect(() => {
        if (resting && over && buzzed.current !== resting.id) {
            buzzed.current = resting.id;
            navigator.vibrate?.(250);
        }
    }, [over, resting]);

    return (
        <div className='trainbar'>
            <div className='trainbar__clock' title='Training time'>
                {clock(now - (session.started_at ?? now))}
            </div>
            {resting ? (
                <>
                    <div className={`trainbar__rest ${over ? 'trainbar__rest--over' : ''}`}>
                        <span>
                            Rest {target ? (over ? `+${clock(elapsed - target)}` : clock(target - elapsed)) : clock(elapsed)}
                        </span>
                        {target > 0 && <span className='trainbar__fill' style={{ width: `${Math.min(100, (elapsed / target) * 100)}%` }} />}
                    </div>
                    <button className='mini mini--wide' onClick={() => data.training.endRest(session.id)}>
                        Skip
                    </button>
                </>
            ) : pending ? (
                <button className='trainbar__go' onClick={() => data.training.startRest(pending.id)}>
                    Start rest{target ? ` · ${clock(target)}` : ''}
                </button>
            ) : (
                <span className='muted trainbar__hint'>Start the next set</span>
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
