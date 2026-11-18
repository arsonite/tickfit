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

# The warm-up of a workout is made of exercises now: lines of the workout that are flagged. Existing lines are not.
# The old text of Workout.warmup stays as it is, the app shows it until it is replaced by exercises.

class WarmupLines(HSDBMigration):
    def migrate(self):
        try:
            table = self.table('WorkoutExercise')
        except KeyError:  # No row of it yet
            return
        table.add_field('warmup', False)
        self.log(f'WorkoutExercise: {len(table)} rows')