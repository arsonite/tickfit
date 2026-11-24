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
import { TeaButton, TeaSettingsPage, useConfirm, type iUseTeaToastReturn } from '@teatype/components';
import type { iTeaSettingsCategory } from '@teatype/components';
import { ChecklistIcon, ContrastIcon, DatabaseIcon, TableIcon } from '@teatype/icons';
import { downloadFile, pickTextFile } from '@teatype/toolkit/file';

// Hooks
import type { iSettings } from '@/hooks/useSettings';
import { DEFAULT_ACCENT } from '@/hooks/useSettings';
import type { tData } from '@/hooks/useTickfit';

// Utility
import { embedImages } from '@/tools/files';
import { BACKUP_TYPE, EXPORT_TYPE, backupFile, exportFile, logCsv, parseTables } from '@/tools/transfer';
import type { tExportKind } from '@/tools/transfer';

const SETTINGS_TYPE = 'tickfit-settings';
const stamp = () => new Date().toISOString().slice(0, 10);

interface iSettingsViewProps {
    data: tData;
    settings: iSettings;
    toast: iUseTeaToastReturn;

    onApply: (settings: unknown) => boolean;
    onChange: <K extends keyof iSettings>(key: K, value: iSettings[K]) => void;
    onClose: () => void;
}

/** The settings of the app, described for the TeaSettingsPage. They are kept on this device only. */
export const SettingsView = ({ data, onApply, onChange, onClose, settings, toast }: iSettingsViewProps) => {
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

    const download = (content: string, name: string, message: string, mimeType?: string) => {
        downloadFile(content, `tickfit-${name}`, mimeType);
        toast.success(message);
    };

    // The pictures are in the file itself, so it can be restored on any server
    const exportKind = async (kind: tExportKind, name: string, message: string) =>
        download(exportFile(kind, await embedImages(data.snapshot())), `${name}-${stamp()}.json`, message);

    const restore = async () => {
        const ok = await confirm({
            title: 'Restore backup',
            message:
                'Everything here, the exercises, workouts, plans and the whole log, is replaced with the contents of the backup file, and so is what is on the server after the next sync. Settings of this device are replaced as well. This cannot be undone.',
            confirmText: 'Choose file',
            variant: 'danger',
        });
        const json = ok ? await pickTextFile() : null;
        if (json === null) {
            return;
        }
        const tables = parseTables(json, [BACKUP_TYPE], true);
        if (!tables) {
            toast.error('Not a Tickfit backup file');
            return;
        }
        data.restoreTables(tables);
        try {
            onApply(JSON.parse(json).settings);
        } catch {
            // The settings are optional
        }
        toast.success(`Backup restored, ${Object.values(tables).reduce((sum, rows) => sum + rows.length, 0)} rows`);
    };

    const importData = async () => {
        const json = await pickTextFile();
        if (json === null) {
            return;
        }
        const tables = parseTables(json, [EXPORT_TYPE, BACKUP_TYPE]);
        if (!tables) {
            toast.error('Not a Tickfit export file');
            return;
        }
        const { added, updated } = data.importTables(tables);
        const parts = [
            added && `${added} row${added === 1 ? '' : 's'} imported`,
            updated && `${updated} exercise${updated === 1 ? '' : 's'} completed`,
        ].filter(Boolean);
        toast.success(parts.length ? parts.join(', ') : 'Nothing new in this file');
    };

    const importSettings = async () => {
        const json = await pickTextFile();
        if (json === null) {
            return;
        }
        try {
            const file = JSON.parse(json);
            if ([SETTINGS_TYPE, BACKUP_TYPE].includes(file?.type) && onApply(file.settings)) {
                toast.success('Settings imported');
                return;
            }
        } catch {
            // Reported below
        }
        toast.error('Not a Tickfit settings file');
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
                            control: {
                                type: 'toggle',
                                value: settings.lightMode,
                                onChange: (value) => onChange('lightMode', value),
                            },
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
                                        <input
                                            type='color'
                                            value={settings.accentColor}
                                            onChange={(event) => onChange('accentColor', event.target.value)}
                                        />
                                        <TeaButton onClick={() => onChange('accentColor', DEFAULT_ACCENT)}>
                                            Reset
                                        </TeaButton>
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
                            control: {
                                type: 'slider',
                                value: settings.defaultRest,
                                min: 15,
                                max: 300,
                                step: 15,
                                unit: ' s',
                                onChange: (value) => onChange('defaultRest', value),
                            },
                        },
                        {
                            id: 'auto-start',
                            label: 'Start the next set after the rest',
                            description:
                                'When the rest is over, the next set of the exercise starts by itself. Without it, the rest keeps counting up until you start it.',
                            control: {
                                type: 'toggle',
                                value: settings.autoStart,
                                onChange: (value) => onChange('autoStart', value),
                            },
                        },
                        {
                            id: 'vibrate',
                            label: 'Vibrate when the rest is over',
                            description: 'A short buzz, on phones that can.',
                            control: {
                                type: 'toggle',
                                value: settings.vibrate,
                                onChange: (value) => onChange('vibrate', value),
                            },
                        },
                        {
                            id: 'keep-awake',
                            label: 'Keep the screen on',
                            description: 'While a workout is running, if the browser allows it.',
                            control: {
                                type: 'toggle',
                                value: settings.keepAwake,
                                onChange: (value) => onChange('keepAwake', value),
                            },
                        },
                    ],
                },
            ],
        },
        {
            id: 'layout',
            label: 'Layout',
            icon: <TableIcon />,
            description: 'How the page is laid out on this device.',
            groups: [
                {
                    id: 'sidebar',
                    items: [
                        {
                            id: 'hide-sidebar',
                            label: 'Hide the sidebar',
                            description:
                                'On a phone: no sidebar or rail, swipe from the left edge to the right to open it. The desktop ignores this.',
                            control: {
                                type: 'toggle',
                                value: settings.hideSidebar,
                                onChange: (value) => onChange('hideSidebar', value),
                            },
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
                            control: {
                                type: 'toggle',
                                value: settings.showLastWeek,
                                onChange: (value) => onChange('showLastWeek', value),
                            },
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
                            description: data.sync.unsavedCount
                                ? `${data.sync.unsavedCount} change${data.sync.unsavedCount > 1 ? 's' : ''} not on the server yet.`
                                : 'Everything is on the server.',
                            control: { type: 'button', label: 'Sync', onClick: () => void data.sync.save() },
                        },
                        {
                            id: 'clear-local',
                            label: 'Clear local data',
                            description:
                                'Deletes the copy on this device and fetches everything from the server again. Changes that are not on the server yet are sent first.',
                            control: { type: 'button', label: 'Clear', theme: 'danger', onClick: () => void refetch() },
                        },
                    ],
                },
                {
                    id: 'backup',
                    title: 'Backup',
                    description:
                        'One file with all exercises, workouts, plans and the whole log, and the settings of this device.',
                    items: [
                        {
                            id: 'backup-export',
                            label: 'Full backup',
                            control: {
                                type: 'button',
                                label: 'Download',
                                onClick: async () =>
                                    download(
                                        backupFile(await embedImages(data.snapshot()), settings),
                                        `backup-${stamp()}.json`,
                                        'Backup downloaded',
                                    ),
                            },
                        },
                        {
                            id: 'backup-restore',
                            label: 'Restore backup',
                            description: 'Replaces everything here with the contents of a backup file.',
                            control: {
                                type: 'button',
                                label: 'Restore',
                                theme: 'danger',
                                onClick: () => void restore(),
                            },
                        },
                    ],
                },
                {
                    id: 'export',
                    title: 'Export',
                    items: [
                        {
                            id: 'export-exercises',
                            label: 'Exercises',
                            control: {
                                type: 'button',
                                label: 'Export',
                                onClick: () => exportKind('exercises', 'exercises', 'Exercises exported'),
                            },
                        },
                        {
                            id: 'export-plans',
                            label: 'Workouts and plans',
                            description: 'With the exercises they use.',
                            control: {
                                type: 'button',
                                label: 'Export',
                                onClick: () => exportKind('plans', 'plans', 'Workouts and plans exported'),
                            },
                        },
                        {
                            id: 'export-log',
                            label: 'Training log',
                            description:
                                'Every day with its sets and times, as JSON that can be imported again, or one line per finished set for a spreadsheet.',
                            control: {
                                type: 'buttons',
                                buttons: [
                                    {
                                        id: 'json',
                                        label: 'JSON',
                                        onClick: () => exportKind('log', 'log', 'Training log exported'),
                                    },
                                    {
                                        id: 'csv',
                                        label: 'CSV',
                                        onClick: () =>
                                            download(
                                                logCsv(data.snapshot()),
                                                `log-${stamp()}.csv`,
                                                'Training log exported',
                                                'text/csv',
                                            ),
                                    },
                                ],
                            },
                        },
                        {
                            id: 'export-settings',
                            label: 'Settings',
                            description: 'Of this device.',
                            control: {
                                type: 'button',
                                label: 'Export',
                                onClick: () =>
                                    download(
                                        JSON.stringify({ type: SETTINGS_TYPE, version: 1, settings }, null, 2),
                                        `settings-${stamp()}.json`,
                                        'Settings exported',
                                    ),
                            },
                        },
                    ],
                },
                {
                    id: 'import',
                    title: 'Import',
                    items: [
                        {
                            id: 'import-data',
                            label: 'Exercises, workouts, plans and log',
                            description:
                                'A file of an export. What is here already (same id) is skipped, an exercise with the name of one here is not added twice but gets the counts it lacks.',
                            control: { type: 'button', label: 'Import', onClick: () => void importData() },
                        },
                        {
                            id: 'import-settings',
                            label: 'Settings',
                            control: { type: 'button', label: 'Import', onClick: () => void importSettings() },
                        },
                    ],
                },
                {
                    id: 'plans',
                    items: [
                        {
                            id: 'example',
                            label: 'Example plan',
                            description:
                                'The plan of the old spreadsheet with its exercises, added next to what is there.',
                            control: { type: 'button', label: 'Add', onClick: data.seed },
                        },
                        {
                            id: 'auto-planned',
                            label: 'Remove auto-planned days',
                            description: data.autoPlanned
                                ? `${data.autoPlanned} upcoming days were filled in by an older version of the app.`
                                : 'No upcoming day was filled in by itself.',
                            control: {
                                type: 'button',
                                label: 'Remove',
                                theme: 'danger',
                                onClick: () => void clearAutoPlanned(),
                            },
                        },
                    ],
                },
            ],
        },
    ];

    return <TeaSettingsPage categories={categories} onClose={onClose} />;
};
