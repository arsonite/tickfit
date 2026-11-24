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

// Utility
import { parse, shortDate } from '@/tools/dates';
import { formatNumber } from '@/tools/stats';

// Charts as plain SVG, the colours come from the theme (see stats.scss)

const WIDTH = 520;
const HEIGHT = 180;
const PAD = { bottom: 32, left: 54, right: 10, top: 10 };
const PLOT = { height: HEIGHT - PAD.top - PAD.bottom, width: WIDTH - PAD.left - PAD.right };

const STEPS = 4;

// A round step (1, 1.2, 1.5, 2 ... times a power of ten) that is at least what is needed, never below 1
const niceStep = (needed: number): number => {
    const base = 10 ** Math.floor(Math.log10(Math.max(needed, 1e-9)));
    const step =
        [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
            .map((factor) => factor * base)
            .find((candidate) => candidate >= needed - 1e-9) ?? base * 10;
    return Math.max(1, step);
};

/** The axis from min up to a round max in four steps that contains all values */
const scaleOf = (max: number, min = 0): { hi: number; lo: number } => {
    const first = niceStep((max - min) / STEPS);
    const lo = Math.floor(min / first) * first;
    return { hi: lo + niceStep((max - lo) / STEPS) * STEPS, lo };
};

interface iAxisProps {
    hi: number;
    lo: number;
}

// Lines with their value on the left
const Grid = ({ hi, lo }: iAxisProps) => (
    <>
        {Array.from({ length: STEPS + 1 }, (_, index) => {
            const y = PAD.top + (PLOT.height * index) / STEPS;
            return (
                <g key={index}>
                    <line className='chart__grid' x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} />
                    <text className='chart__label' textAnchor='end' x={PAD.left - 6} y={y + 4}>
                        {formatNumber(hi - ((hi - lo) * index) / STEPS)}
                    </text>
                </g>
            );
        })}
    </>
);

interface iBarChartProps {
    data: { hint?: string; label: string; value: number | null }[];
    format?: (value: number) => string;
}

/** One bar per entry, a value of null has no bar (unknown, not zero) */
export const BarChart = ({ data, format = formatNumber }: iBarChartProps) => {
    const { hi: max, lo } = scaleOf(Math.max(0, ...data.map((item) => item.value ?? 0)));
    const slot = PLOT.width / Math.max(1, data.length);
    const every = Math.ceil(data.length / 4);

    return (
        <svg className='chart' viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role='img'>
            <Grid hi={max} lo={lo} />
            {data.map((item, index) => {
                const height = ((item.value ?? 0) / max) * PLOT.height;
                const x = PAD.left + slot * index;
                return (
                    <g key={item.label}>
                        <title>{`${item.label}: ${item.value === null ? '–' : format(item.value)}${item.hint ? ` (${item.hint})` : ''}`}</title>
                        {item.value !== null && (
                            <rect
                                className='chart__bar'
                                height={Math.max(item.value ? 1.5 : 0, height)}
                                rx={2}
                                width={Math.max(1, slot * 0.7)}
                                x={x + slot * 0.15}
                                y={PAD.top + PLOT.height - height}
                            />
                        )}
                        {index % every === 0 && (
                            <text className='chart__label' textAnchor='middle' x={x + slot / 2} y={HEIGHT - 8}>
                                {item.label.replace(/^\d{4} /, '')}
                            </text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
};

interface iLineChartProps {
    series: { name: string; points: { date: string; value: number | null }[] }[];
}

/** Lines over time, the dates are spread by their distance, a gap (null) breaks the line */
export const LineChart = ({ series }: iLineChartProps) => {
    const points = series.flatMap((line) => line.points);
    const times = points.map((point) => parse(point.date).getTime());
    const from = Math.min(...times);
    const span = Math.max(...times) - from;
    const values = points.flatMap((point) => (point.value === null ? [] : [point.value]));
    const peak = Math.max(0, ...values);
    // Starts at zero unless the values stay in the upper part, then the lines would be flat
    const { hi: top, lo: bottom } = scaleOf(
        peak,
        values.length && Math.min(...values) > peak * 0.4 ? Math.min(...values) * 0.9 : 0,
    );

    const place = (date: string, value: number) => ({
        x: PAD.left + (span ? ((parse(date).getTime() - from) / span) * PLOT.width : PLOT.width / 2),
        y: PAD.top + PLOT.height - ((value - bottom) / (top - bottom)) * PLOT.height,
    });
    const dates = [...new Set(points.map((point) => point.date))].sort();

    return (
        <svg className='chart' viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role='img'>
            <Grid hi={top} lo={bottom} />
            {[dates[0], dates[dates.length - 1]].map((date, index) => (
                <text
                    key={index}
                    className='chart__label'
                    textAnchor={index ? 'end' : 'start'}
                    x={index ? WIDTH - PAD.right : PAD.left}
                    y={HEIGHT - 8}
                >
                    {date ? shortDate(date) : ''}
                </text>
            ))}
            {series.map((line, index) => {
                const known = line.points.filter((point) => point.value !== null);
                const path = known.map((point, step) => {
                    const { x, y } = place(point.date, point.value as number);
                    return `${step ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
                });
                return (
                    <g key={line.name} className={`chart__series chart__series--${index}`}>
                        {known.length > 1 && <path className='chart__line' d={path.join(' ')} />}
                        {known.map((point) => {
                            const { x, y } = place(point.date, point.value as number);
                            return (
                                <circle key={point.date} className='chart__dot' cx={x} cy={y} r={3.5}>
                                    <title>{`${line.name}, ${shortDate(point.date)}: ${formatNumber(point.value as number)}`}</title>
                                </circle>
                            );
                        })}
                    </g>
                );
            })}
        </svg>
    );
};
