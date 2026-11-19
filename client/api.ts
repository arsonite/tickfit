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

// API
import { HSDBBaseAPI } from '@teatype/api';

// The server (tickfit_server.py) serves the HSDB unit under /hsdb/<Model>. The vite dev server proxies
// <base>/hsdb to it, so the browser only needs its own origin (works on http://localhost:8104/ and
// https://tickfit.homepie.net alike)
HSDBBaseAPI.configure({
    baseUrl: window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, ''),

    host: window.location.hostname,
    port: Number(import.meta.env.VITE_HSDB_PORT ?? 8767),
    endpoint: 'hsdb',
    timeout: 8000,
});

class ExerciseAPI extends HSDBBaseAPI {
    static resource = 'Exercise';
}

class PlanAPI extends HSDBBaseAPI {
    static resource = 'Plan';
}

class PlanDayAPI extends HSDBBaseAPI {
    static resource = 'PlanDay';
}

class SessionAPI extends HSDBBaseAPI {
    static resource = 'Session';
}

class EntryAPI extends HSDBBaseAPI {
    static resource = 'SessionExercise';
}

class SetAPI extends HSDBBaseAPI {
    static resource = 'SetLog';
}

class WorkoutAPI extends HSDBBaseAPI {
    static resource = 'Workout';
}

class SlotAPI extends HSDBBaseAPI {
    static resource = 'WorkoutExercise';
}

export { EntryAPI, ExerciseAPI, PlanAPI, PlanDayAPI, SessionAPI, SetAPI, SlotAPI, WorkoutAPI };
