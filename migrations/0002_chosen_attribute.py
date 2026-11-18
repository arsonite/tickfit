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

# SessionExercise.chosen is a plain id now instead of a relation (a second relation to WorkoutExercise next to `slot` was
# overwritten by it on restore). The stored id stays, a row without one chose the slot itself.

class ChosenAttribute(HSDBMigration):
    def migrate(self):
        try:
            table = self.table('SessionExercise')
        except KeyError:  # No row of it yet
            return
        table.transform(lambda row: row.update(
            chosen=row.get('chosen') or row.get('slot', '')))
        self.log(f'SessionExercise: {len(table)} rows')