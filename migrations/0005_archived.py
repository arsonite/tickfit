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

# Exercises and plans can be archived, like workouts: everything that exists is live.

# Third-party imports
from teatype.db.hsdb.core import HSDBMigration


class Archived(HSDBMigration):
    def migrate(self):
        for name in ('Exercise', 'Plan'):
            try:
                table = self.table(name)
            except KeyError:  # No row of it yet
                continue
            table.add_field('archived', False)
            self.log(f'{name}: {len(table)} rows')
