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

# What an exercise counts is reps, a time (minutes or seconds) and a distance (meters or km), each on its own, so the value
# of a set is only for reps. Time is kept in seconds (SetLog.seconds) and distance in km (SetLog.distance), the exercise
# says in which unit they are shown (time_unit, distance_unit). An exercise that was counted in minutes or meters (unit)
# is timed or distanced now, and so are the values of its sets.

# Third-party imports
from teatype.db.hsdb.core import HSDBMigration

class CountedIn(HSDBMigration):
    def migrate(self):
        try:
            exercises = self.table('Exercise')
        except KeyError:  # No row of it yet
            return
        legacy = {}
        for row in exercises:
            unit = row.get('unit')
            row['time_unit'] = 'minutes' if unit == 'minutes' else 'seconds'
            row['distance_unit'] = 'meters' if unit == 'meters' and not row.get('distanced') else 'km'
            if unit in ('minutes', 'meters'):
                legacy[row['id']] = unit
                row['timed' if unit == 'minutes' else 'distanced'] = True
                row['unit'] = 'none'
        self.log(f'Exercise: {len(exercises)} rows, {len(legacy)} counted in minutes or meters')
        if not legacy:
            return

        lines = {row['id']: row.get('exercise') for row in self.table('WorkoutExercise')}
        entries = {row['id']: row.get('chosen') or row.get('slot') for row in self.table('SessionExercise')}
        converted = 0
        for row in self.table('SetLog'):
            unit = legacy.get(lines.get(entries.get(row.get('session_exercise'))))
            if not unit:
                continue
            value = row.get('value') or 0
            if unit == 'minutes':
                row['seconds'] = round((row.get('seconds') or 0) + value * 60, 3)
            else:
                row['distance'] = round((row.get('distance') or 0) + value / 1000, 6)
            row['value'] = 0.0
            converted += 1
        self.log(f'SetLog: {converted} sets converted')