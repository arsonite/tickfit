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
exist already (same name, any case) are completed: a count (time, distance, reps), the weight, a category or notes they lack is added, nothing is removed or changed. Edit exercises.json and aliases.json to taste, then run it again any time.

    seed_exercises.py [--dry-run] [--url http://127.0.0.1:8767]
"""

# System imports
import argparse
import json
from pathlib import Path

from common import HERE, Api, DEFAULT_URL, canonical, load_aliases, load_weeks, now_ms

CATALOGUE = HERE / 'exercises.json'


def counted(item: dict) -> dict:
    """What an exercise counts: the unit of the sheets (reps, minutes, meters) becomes reps, a time or a distance."""
    unit = item['unit']
    return {
        'unit': 'none' if unit in ('minutes', 'meters') else unit,
        'timed': bool(item.get('timed')) or unit == 'minutes', 'time_unit': item.get('time_unit') or ('minutes' if unit == 'minutes' else 'seconds'),
        'distanced': bool(item.get('distanced')) or unit == 'meters', 'distance_unit': item.get('distance_unit') or ('meters' if unit == 'meters' else 'km'),
    }


def with_missing(base: dict, other: dict) -> dict:
    """base plus what other has that base lacks: a count or the weight is only ever added, an empty category or note is filled."""
    merged = dict(base)
    if other.get('unit') == 'reps':
        merged['unit'] = 'reps'
    for flag, unit in (('timed', 'time_unit'), ('distanced', 'distance_unit')):
        if other.get(flag) and not base.get(flag):
            merged[flag], merged[unit] = True, other.get(unit) or ('seconds' if flag == 'timed' else 'km')
    merged['weighted'] = bool(base.get('weighted') or other.get('weighted'))
    for field in ('category', 'notes'):
        merged[field] = base.get(field) or other.get(field) or ''
    return merged


def wanted(weeks: list, aliases: dict, catalogue: Path = CATALOGUE) -> dict:
    """casefolded name -> {name, weighted, category, notes, unit, timed, time_unit, distanced, distance_unit}.
    The catalogue wins over what the sheets say, but an exercise the sheets count in minutes on one line and in meters on another has both."""
    found = {}
    for item in json.loads(catalogue.read_text('utf-8')) if catalogue.exists() else []:
        found[item['name'].casefold()] = {'name': item['name'], 'weighted': item.get('weighted', False), 'notes': item.get('notes', ''),
                                          'category': item.get('category', ''), **counted(item)}
    seen: dict = {}  # casefolded name -> [name, weighted, units used by the sheets]
    for week in weeks:
        for workout in week['workouts']:
            for line in workout['lines']:
                for entry in [line, *line['alternatives']]:
                    name = canonical(entry['exercise'], aliases)
                    record = seen.setdefault(name.casefold(), [name, False, set()])
                    record[1] = record[1] or bool(line['weighted'])
                    record[2].add(entry['unit'])
    for key, (name, weighted, units) in seen.items():
        cardio = units & {'minutes', 'meters'}  # A stray reps cell on a cardio line does not make it a reps exercise
        item = {'name': name, 'weighted': weighted, 'notes': '', 'category': '', **counted({'unit': 'reps' if 'reps' in units and not cardio else 'none'}),
                **({'timed': True, 'time_unit': 'minutes'} if 'minutes' in units else {}),
                **({'distanced': True, 'distance_unit': 'meters'} if 'meters' in units else {})}
        found[key] = with_missing(found[key], item) if key in found else item
    return found


def gaps(row: dict, item: dict) -> dict:
    """What an exercise of the server lacks that the catalogue or the sheets know, nothing the app set is taken away."""
    merged = with_missing(row, item)
    return {field: merged[field] for field in ('unit', 'weighted', 'timed', 'time_unit', 'distanced', 'distance_unit', 'category', 'notes') if (merged.get(field) or False) != (row.get(field) or False)}


def describe(patch: dict) -> str:
    return ', '.join(f'{field}={value!r}' for field, value in patch.items())


def ensure_exercises(api: Api, weeks: list, aliases: dict) -> dict:
    """Creates the missing exercises, completes the ones that are there and returns casefolded name -> id of all of them."""
    rows = {row['name'].casefold(): row for row in api.all('Exercise')}
    items = wanted(weeks, aliases)
    missing = [key for key in items if key not in rows]
    for row in api.create('Exercise', [{**items[key], 'rev': now_ms()} for key in missing]):
        rows[row['name'].casefold()] = row
        print(f'+ {row["name"]} ({row["unit"]}{", kg" if row["weighted"] else ""})')
    patched = 0
    for key, item in items.items():
        patch = {} if key in missing else gaps(rows[key], item)
        if patch:
            api.patch('Exercise', rows[key]['id'], {**patch, 'rev': now_ms()})
            print(f'~ {rows[key]["name"]}: {describe(patch)}')
            patched += 1
    print(f'{len(missing)} exercises added, {patched} completed, {len(rows) - len(missing) - patched} were there already')
    return {key: row['id'] for key, row in rows.items()}


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
