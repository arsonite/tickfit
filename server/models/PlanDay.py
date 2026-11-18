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
from teatype.db.hsdb.core import HSDBAttribute, HSDBModel, HSDBRelation

# Local imports
from .Plan import Plan
from .Workout import Workout

# Which workout a day of the plan holds
class PlanDay(HSDBModel):
    rev      = HSDBAttribute(int, description='Save timestamp (ms) of the last write by a client, set by the sync')
    plan     = HSDBRelation.ManyToOne(Plan, required=True)
    position = HSDBAttribute(int, required=True)
    workout  = HSDBRelation.ManyToOne(Workout, required=True)
