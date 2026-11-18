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
from .Workout import Workout

# A workout on a date, the dates move when days are missed or shifted
class Session(HSDBModel):
    rev         = HSDBAttribute(int, description='Save timestamp (ms) of the last write by a client, set by the sync')
    date        = HSDBAttribute(str, required=True, indexed=True, description='YYYY-MM-DD')
    finished_at = HSDBAttribute(int, description='Unix time (ms) the training was finished, 0 = not')
    notes       = HSDBAttribute(str, description='Comment on the day')
    plan_day    = HSDBAttribute(int, description='Position in the plan this day was scheduled from, -1 when added by hand')
    started_at  = HSDBAttribute(int, description='Unix time (ms) the training was started, 0 = not. The clock of the training runs from it')
    status      = HSDBAttribute(str, required=True, description='planned, done or skipped')
    workout     = HSDBRelation.ManyToOne(Workout, required=True)
