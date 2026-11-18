#!/usr/bin/env python3

# Copyright (C) 2024-2026 Burak Günaydin
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, version 3 of the License.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.

# Third-party imports
from teatype.io import env, path
from teatype.logging import log
from teatype.modulo.hsdb import hsdb

# Local imports
from server.models import Exercise, Plan, PlanDay, Session, SessionExercise, SetLog, Workout, WorkoutExercise

# Settings of .env next to this file, variables that are already set win over it
env.load(path.join(path.caller_parent(), '.env'))

DB_NAME = 'tickfit'
MODELS = [
    Exercise,
    Plan,
    PlanDay,
    Session,
    SessionExercise,
    SetLog,
    Workout,
    WorkoutExercise]
PORT = int(env.get('TICKFIT_PORT', 8767)) # The vite dev server proxies /hsdb to this port (vite.config.ts)
# Browser origins that may call the server directly, the browser normally goes through the vite proxy (same origin)
CORS_ORIGINS = env.get('TICKFIT_CORS_ORIGINS', r'https?://(localhost|127\.0\.0\.1)(:\d+)?')

if __name__ == '__main__':
    # Pending files of migrations/ are applied here, before the models are loaded
    db = hsdb.init(DB_NAME, models=MODELS, port=PORT, cors_origins=CORS_ORIGINS, root_path=env.get('TICKFIT_DATA_PATH'))
    if not db.server:
        raise SystemExit(f'"{DB_NAME}" is already hosted by another process')

    log(f'Counts: { {name: db.count(name) for name in db.models} }')
    db.server.join() # Blocks until Ctrl+C, the server lives in this process
