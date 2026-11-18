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
from teatype.db.hsdb.core import HSDBAttribute, HSDBModel, HSDBRawFile
from teatype.db.hsdb.core.HSDBRawFileType import image_png

# One movement, e.g. "Dumbbell Preacher Curl"
class Exercise(HSDBModel):
    rev       = HSDBAttribute(int, description='Save timestamp (ms) of the last write by a client, set by the sync')
    archived  = HSDBAttribute(bool, description='Put away: kept for what was logged with it, not offered for new workout lines')
    category  = HSDBAttribute(str, description='Free text the exercises are filtered by, e.g. "pull"')
    distanced = HSDBAttribute(bool, description='A set also has a distance in km')
    image     = HSDBRawFile(image_png, description='Picture of the exercise')
    name      = HSDBAttribute(str, required=True)
    notes     = HSDBAttribute(str, description='Machine settings and cues, e.g. "Rack: 4"')
    timed     = HSDBAttribute(bool, description='A set also has a time (minutes and seconds)')
    unit      = HSDBAttribute(str, required=True, description='What the value of a set counts: reps, minutes, meters or none (only time, distance or weight)')
    weighted  = HSDBAttribute(bool, description='A set also has a weight in kg')
