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

# Plan.active may be set on several plans now, Plan.default marks the one that is offered first.
# The plan that was the active one so far is the default as well.

# Third-party imports
from teatype.db.hsdb.core import HSDBMigration

class PlanDefault(HSDBMigration):
    def migrate(self):
        try:
            table = self.table('Plan')
        except KeyError:  # No row of it yet
            return
        table.add_field('default', lambda row: bool(row.get('active')))
        self.log(f'Plan: {len(table)} rows')