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

// TeaType
import { TeaButton, TeaSettingsPage, useConfirm } from '@teatype/components';
import type { iTeaSettingsCategory } from '@teatype/components';
import { ChecklistIcon, ContrastIcon, DatabaseIcon, TableIcon } from '@teatype/icons';

// Hooks
import type { iSettings } from '@/hooks/useSettings';
import { DEFAULT_ACCENT } from '@/hooks/useSettings';
import type { tData } from '@/hooks/useTickfit';

interface iSettingsViewProps {
    data: tData;
    settings: iSettings;

    onChange: <K extends keyof iSettings>(key: K, value: iSettings[K]) => void;
    onClose: () => void;
}

/** The settings of the app, described for the TeaSettingsPage. They are kept on this device only. */
export const SettingsView = ({ data, onChange, onClose, settings }: iSettingsViewProps) => {
    const confirm = useConfirm();

    const clearAutoPlanned = async () => {
        const ok = await confirm({
            title: 'Remove auto-planned days',
            message: `Removes ${data.autoPlanned} upcoming day${data.autoPlanned === 1 ? '' : 's'} that an older version of the app filled in by itself. Days you started or finished, and days you put on the calendar, stay.`,
            confirmText: 'Remove',
            variant: 'danger',
        });
        if (ok) {
            data.clearAutoPlanned();
        }
    };

    const refetch = async () => {
        // What is not on the server yet is sent first, so only what could not be sent is lost
        let lost = data.sync.unsavedCount;
        if (lost && (await data.sync.save()).ok) {
            lost = 0;
        }
        const ok = await confirm({
            title: 'Clear local data',
            message: lost
                ? `${lost} change${lost === 1 ? '' : 's'} could not be sent to the server and ${lost === 1 ? 'is' : 'are'} lost. Everything else is fetched from the server again.`
                : 'The copy on this device is deleted and everything is fetched from the server again. Settings of this device stay.',
            confirmText: 'Clear and fetch',
            variant: 'danger',
        });
        if (ok) {
            await data.sync.resetLocal();
        }
    };

    const categories: iTeaSettingsCategory[] = [
        {
            id: 'appearance',
            label: 'Appearance',
            icon: <ContrastIcon />,
            description: 'How the app looks on this device.',
            groups: [
                {
                    id: 'theme',
                    items: [
                        {
                            id: 'light-mode',
                            label: 'Light mode',
                            description: 'Dark text on a light background.',
                            control: { type: 'toggle', value: settings.lightMode, onChange: (value) => onChange('lightMode', value) },
                        },
                        {
                            id: 'accent-color',
                            label: 'Accent color',
                            layout: 'stacked', // The color popup of the browser opens at the field, on the right it leaves the window
                            description: 'Buttons and highlights, green by default.',
                            control: {
                                type: 'custom',
                                render: () => (
                                    <span className='accent-picker'>
                                        <input type='color' value={settings.accentColor} onChange={(event) => onChange('accentColor', event.target.value)} />
                                        <TeaButton onClick={() => onChange('accentColor', DEFAULT_ACCENT)}>Reset</TeaButton>
                                    </span>
                                ),
                            },
                        },
                    ],
                },
            ],
        },
        {
            id: 'training',
            label: 'Training',
            icon: <ChecklistIcon />,
            description: 'What the training mode does.',
            groups: [
                {
                    id: 'rest',
                    items: [
                        {
                            id: 'default-rest',
                            label: 'Rest between sets',
                            description: 'Used when a workout has no rest of its own.',
                            control: { type: 'slider', value: settings.defaultRest, min: 15, max: 300, step: 15, unit: ' s', onChange: (value) => onChange('defaultRest', value) },
                        },
                        {
                            id: 'vibrate',
                            label: 'Vibrate when the rest is over',
                            description: 'A short buzz, on phones that can.',
                            control: { type: 'toggle', value: settings.vibrate, onChange: (value) => onChange('vibrate', value) },
                        },
                        {
                            id: 'keep-awake',
                            label: 'Keep the screen on',
                            description: 'While a workout is running, if the browser allows it.',
                            control: { type: 'toggle', value: settings.keepAwake, onChange: (value) => onChange('keepAwake', value) },
                        },
                    ],
                },
            ],
        },
        {
            id: 'week',
            label: 'Week',
            icon: <TableIcon />,
            description: 'The calendar.',
            groups: [
                {
                    id: 'calendar',
                    items: [
                        {
                            id: 'show-last-week',
                            label: 'Show last week',
                            description: 'What was on the same weekday a week ago, in each day.',
                            control: { type: 'toggle', value: settings.showLastWeek, onChange: (value) => onChange('showLastWeek', value) },
                        },
                    ],
                },
            ],
        },
        {
            id: 'data',
            label: 'Data',
            icon: <DatabaseIcon />,
            description: 'The server and what is on it.',
            groups: [
                {
                    id: 'sync',
                    items: [
                        {
                            id: 'sync-now',
                            label: 'Sync now',
                            description: data.sync.unsavedCount ? `${data.sync.unsavedCount} change${data.sync.unsavedCount > 1 ? 's' : ''} not on the server yet.` : 'Everything is on the server.',
                            control: { type: 'button', label: 'Sync', onClick: () => void data.sync.save() },
                        },
                        {
                            id: 'clear-local',
                            label: 'Clear local data',
                            description: 'Deletes the copy on this device and fetches everything from the server again. Changes that are not on the server yet are sent first.',
                            control: { type: 'button', label: 'Clear', theme: 'danger', onClick: () => void refetch() },
                        },
                    ],
                },
                {
                    id: 'plans',
                    items: [
                        {
                            id: 'example',
                            label: 'Example plan',
                            description: 'The plan of the old spreadsheet with its exercises, added next to what is there.',
                            control: { type: 'button', label: 'Add', onClick: data.seed },
                        },
                        {
                            id: 'auto-planned',
                            label: 'Remove auto-planned days',
                            description: data.autoPlanned ? `${data.autoPlanned} upcoming days were filled in by an older version of the app.` : 'No upcoming day was filled in by itself.',
                            control: { type: 'button', label: 'Remove', theme: 'danger', onClick: () => void clearAutoPlanned() },
                        },
                    ],
                },
            ],
        },
    ];

    return <TeaSettingsPage categories={categories} onClose={onClose} />;
};
