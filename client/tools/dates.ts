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

// Dates are YYYY-MM-DD strings in local time, so they sort as text and never shift with the time zone

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const pad = (n: number): string => String(n).padStart(2, '0');

const toISO = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parse = (iso: string): Date => {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day);
};

const today = (): string => toISO(new Date());

const addDays = (iso: string, days: number): string => {
    const date = parse(iso);
    date.setDate(date.getDate() + days);
    return toISO(date);
};

// Calendar weeks run Monday to Sunday
const mondayOf = (iso: string): string => addDays(iso, -((parse(iso).getDay() + 6) % 7));

const weekDays = (iso: string): string[] => {
    const monday = mondayOf(iso);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
};

// ISO 8601: week 1 is the one with the first Thursday of the year
const calendarWeek = (iso: string): { week: number; year: number } => {
    const thursday = parse(addDays(mondayOf(iso), 3));
    const year = thursday.getFullYear();
    const firstThursday = new Date(year, 0, 4);
    firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3);
    return { week: 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86400000)), year };
};

const weekdayName = (iso: string): string => parse(iso).toLocaleDateString('en-GB', { weekday: 'long' });

// dd.mm.yyyy
const shortDate = (iso: string): string => {
    const [year, month, day] = iso.split('-');
    return `${day}.${month}.${year}`;
};

export { ROMAN, addDays, calendarWeek, mondayOf, parse, shortDate, toISO, today, weekdayName, weekDays };
