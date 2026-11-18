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
from teatype.db.hsdb.core import HSDBMigration

# The training clock (Session, SetLog) and the versions of a workout (Workout). Rows that exist already were not timed
# and are the first version of their workout.


class TimeTracking(HSDBMigration):
    def migrate(self):
        fields = {
            'Session': {'started_at': 0, 'finished_at': 0},
            'SetLog': {'started_at': 0, 'ended_at': 0, 'rest_started_at': 0, 'rest_ended_at': 0},
            'Workout': {'archived': False, 'family': lambda row: row['id'], 'version': 1},
        }
        for model, defaults in fields.items():
            try:
                table = self.table(model)
            except KeyError:  # No row of it yet
                continue
            for name, default in defaults.items():
                table.add_field(name, default)
            self.log(f'{model}: {len(table)} rows')
