#!/usr/bin/env python3

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

"""
Seeds the exercise catalogue: the exercises of exercises.json plus every exercise the parsed weeks use (parsed/), the ones that
exist already (same name, any case) are left alone. Edit exercises.json and aliases.json to taste, then run it again any time.

    seed_exercises.py [--dry-run] [--url http://127.0.0.1:8767]
"""

# System imports
import argparse
import json
from pathlib import Path

from common import HERE, Api, DEFAULT_URL, canonical, load_aliases, load_weeks, now_ms

CATALOGUE = HERE / 'exercises.json'


def wanted(weeks: list, aliases: dict, catalogue: Path = CATALOGUE) -> dict:
    """casefolded name -> {name, unit, weighted, category, timed, distanced}. The catalogue wins over what the sheets say."""
    found = {}
    for item in json.loads(catalogue.read_text('utf-8')) if catalogue.exists() else []:
        found[item['name'].casefold()] = {'name': item['name'], 'unit': item['unit'], 'weighted': item.get('weighted', False), 'notes': item.get('notes', ''),
                                     'category': item.get('category', ''), 'timed': item.get('timed', False), 'distanced': item.get('distanced', False)}
    for week in weeks:
        for workout in week['workouts']:
            for line in workout['lines']:
                for entry in [line, *line['alternatives']]:
                    name = canonical(entry['exercise'], aliases)
                    found.setdefault(name.casefold(), {'name': name, 'unit': entry['unit'], 'weighted': line['weighted'], 'notes': ''})
    return found


def ensure_exercises(api: Api, weeks: list, aliases: dict) -> dict:
    """Creates the missing exercises and returns casefolded name -> id of all of them."""
    existing = {row['name'].casefold(): row['id'] for row in api.all('Exercise')}
    missing = [item for key, item in wanted(weeks, aliases).items() if key not in existing]
    for row in api.create('Exercise', [{**item, 'rev': now_ms()} for item in missing]):
        existing[row['name'].casefold()] = row['id']
        print(f'+ {row["name"]} ({row["unit"]}{", kg" if row["weighted"] else ""})')
    print(f'{len(missing)} exercises added, {len(existing) - len(missing)} were there already')
    return existing


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--url', default=DEFAULT_URL)
    parser.add_argument('--parsed', type=Path, default=HERE / 'parsed')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    weeks = load_weeks(args.parsed) if args.parsed.exists() else []
    ensure_exercises(Api(args.url, args.dry_run), weeks, load_aliases())


if __name__ == '__main__':
    main()
