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
from .Session import Session
from .WorkoutExercise import WorkoutExercise

# The line of a workout as done on one day: which of main and alternatives was chosen
class SessionExercise(HSDBModel):
    rev     = HSDBAttribute(int, description='Save timestamp (ms) of the last write by a client, set by the sync')
    # The id of a WorkoutExercise (the slot itself or an alternative of it). Not a relation: HSDB indexes relations per pair of
    # models, so a second one to WorkoutExercise next to slot overwrites it on create and on restore
    chosen  = HSDBAttribute(str, description='Id of the chosen WorkoutExercise, the slot or one of its alternatives')
    notes   = HSDBAttribute(str, description='Comment of this day, e.g. the rack spot')
    session = HSDBRelation.ManyToOne(Session, required=True)
    slot    = HSDBRelation.ManyToOne(WorkoutExercise, required=True)
