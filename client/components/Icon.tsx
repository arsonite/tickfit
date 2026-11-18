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

// Drawn as SVG: the text symbols (▶ ✓ ✕) turn into colour emoji on iOS
const PATHS = {
    calendar: <path d='M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM4 9h16M8 2v4M16 2v4' />,
    check: <path d='M5 12.5l4.5 4.5L19 7.5' />,
    'check-circle': <path d='M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l3 3 5-6' />,
    'chevron-down': <path d='M6 9l6 6 6-6' />,
    'chevron-left': <path d='M15 5l-7 7 7 7' />,
    'chevron-right': <path d='M9 5l7 7-7 7' />,
    close: <path d='M6 6l12 12M18 6L6 18' />,
    'arrow-down': <path d='M12 4v13M6 12l6 6 6-6' />,
    'arrow-up': <path d='M12 20V7M6 12l6-6 6 6' />,
    moon: <path d='M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z' />,
    play: <path d='M8 5.5v13l11-6.5z' fill='currentColor' />,
    skip: <path d='M5 6l9 6-9 6zM18 5v14' />,
    sun: <path d='M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' />,
} as const;

type tIconName = keyof typeof PATHS;

interface iIconProps {
    className?: string;
    name: tIconName;
    size?: number | string;
}

export const Icon = ({ className, name, size = '1em' }: iIconProps) => (
    <svg
        aria-hidden='true'
        className={`icon ${className ?? ''}`}
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2.2'
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        {PATHS[name]}
    </svg>
);

export type { tIconName };
