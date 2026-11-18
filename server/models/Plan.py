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
from teatype.db.hsdb.core import HSDBAttribute, HSDBModel

# A weekly plan: the days run in a cycle of position 0, 1, 2, ...
class Plan(HSDBModel):
    rev    = HSDBAttribute(int, description='Save timestamp (ms) of the last write by a client, set by the sync')
    active = HSDBAttribute(bool, description='The plan can be put on a week')
    default = HSDBAttribute(bool, description='The active plan that is offered first, only one has it')
    name   = HSDBAttribute(str, required=True)
    notes  = HSDBAttribute(str, description='Shown above the week, e.g. the legend of the flags')
