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
    ended_at         = HSDBAttribute(int, description='Unix time (ms) the set was finished, 0 = not')
    kind             = HSDBAttribute(str, description='DS (drop set), P (partial), A (assisted) or empty')
    position         = HSDBAttribute(int, required=True)
    rest_ended_at    = HSDBAttribute(int, description='Unix time (ms) the rest after the set ended (next set started or rest skipped)')
    rest_started_at  = HSDBAttribute(int, description='Unix time (ms) the rest after the set was triggered, 0 = no rest')
    session          = HSDBRelation.ManyToOne(Session, required=True) # Same session as session_exercise, to load a day's sets in one request
    session_exercise = HSDBRelation.ManyToOne(SessionExercise, required=True)
    started_at       = HSDBAttribute(int, description='Unix time (ms) the set was started, 0 = not. Drop sets and partials are sets of their own')
    value            = HSDBAttribute(float, description='Reps, minutes or meters, as the exercise counts')
    weight           = HSDBAttribute(float, description='kg')
