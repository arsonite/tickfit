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

# A training day, e.g. "Full Body A1" or "Rest"
class Workout(HSDBModel):
    rev          = HSDBAttribute(int, description='Save timestamp (ms) of the last write by a client, set by the sync')
    focus        = HSDBAttribute(str, description='E.g. Upper Body')
    kind         = HSDBAttribute(str, required=True, description='strength, cardio or rest')
    name         = HSDBAttribute(str, required=True)
    notes        = HSDBAttribute(str)
    rest_seconds = HSDBAttribute(int, description='Pause between sets')
    warmup       = HSDBAttribute(str)
