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
from .Exercise import Exercise
from .Workout import Workout

# One line of a workout: an exercise with its target. An alternative is a line of its own that points to the main one.
class WorkoutExercise(HSDBModel):
    rev       = HSDBAttribute(int, description='Save timestamp (ms) of the last write by a client, set by the sync')
    exercise  = HSDBRelation.ManyToOne(Exercise, required=True)
    notes     = HSDBAttribute(str, description='Notes of this workout, e.g. "*Includes drop sets"')
    position  = HSDBAttribute(int, required=True)
    rep_max   = HSDBAttribute(int)
    rep_min   = HSDBAttribute(int)
    sets      = HSDBAttribute(int, required=True)
    superset  = HSDBAttribute(bool, description='Done in turns with the line above')
    warmup    = HSDBAttribute(bool, description='A line of the warm-up, done before the others')
    workout   = HSDBRelation.ManyToOne(Workout, required=True)

# An alternative sits in the workout of its main line, assigned here because the class cannot name itself in its own body
WorkoutExercise.alternative_of = HSDBRelation.ManyToOne(WorkoutExercise)
