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

# An exercise can count more than the value: a time (minutes and seconds) and a distance (km), and it has a free type
# to filter by. Sets got the fields for time and distance. Nothing is converted, the unit and the values stay as they are.

# Third-party imports
from teatype.db.hsdb.core import HSDBMigration

class Measures(HSDBMigration):
    def migrate(self):
        for name, fields in (('Exercise', {'category': '', 'timed': False, 'distanced': False}), ('SetLog', {'seconds': 0.0, 'distance': 0.0})):
            try:
                table = self.table(name)
            except KeyError:  # No row of it yet
                continue
            for field, default in fields.items():
                table.add_field(field, default)
            self.log(f'{name}: {len(table)} rows')