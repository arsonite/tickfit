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
from .SessionExercise import SessionExercise

# One set
class SetLog(HSDBModel):
    rev              = HSDBAttribute(int, description='Save timestamp (ms) of the last write by a client, set by the sync')
    disabled         = HSDBAttribute(bool, description='Not done on purpose, shown as X')
    done             = HSDBAttribute(bool)
    kind             = HSDBAttribute(str, description='DS (drop set), P (partial), A (assisted) or empty')
    position         = HSDBAttribute(int, required=True)
    session          = HSDBRelation.ManyToOne(Session, required=True) # Same session as session_exercise, to load a day's sets in one request
    session_exercise = HSDBRelation.ManyToOne(SessionExercise, required=True)
    value            = HSDBAttribute(float, description='Reps, minutes or meters, as the exercise counts')
    weight           = HSDBAttribute(float, description='kg')
