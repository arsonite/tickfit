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
Reads the weekly sheets (.xlsx) into week documents (parsed/<name>.json) that import_history.py and seed_exercises.py use.

    parse_sheets.py [files or folders]   default: sheets/
    parse_sheets.py --dump file.xlsx     prints every filled cell, to see what the parser sees

The sheet is read by its headers (Übung, Auswahl, Ziel, Set 1..n, Einheit, Notizen), so moved columns are fine. How a week looks:

    Übung / Einheit REPS      the exercise, its target ("3 x 8-12") and the reps of every set
    ↳ name / Einheit KG       an alternative, in the KG row: the weights of the exercise that was done ("40/22" = 40 for the
                              first, 22 for the alternative that was chosen)
    ↳ Superset: name          done in turns with the line above
    X in a set                the set does not exist (past the target) or was left out on purpose (within it)
    10 DS, 8 P, 12 A          drop set, partial, assisted. "10+8 DS" are two sets in one cell

A week that can not be read is reported and skipped, the others are still written.

The week document:
    {source, year, week, plan, rest_seconds, days: [{date, workout}], workouts: [{name, focus, warmup, date,
     lines: [{exercise, unit, weighted, sets, rep_min, rep_max, notes, superset, chosen, alternatives: [...],
              values: [{value, weight, kind, disabled}]}]}]}
"""

# System imports
import argparse
import datetime
import json
import re
from pathlib import Path

import openpyxl

from common import HERE

ROMAN = {'I': 0, 'II': 1, 'III': 2, 'IV': 3, 'V': 4, 'VI': 5, 'VII': 6}
UNITS = {'REPS': 'reps', 'MINUTES': 'minutes', 'MINUTEN': 'minutes', 'MIN': 'minutes', 'METERS': 'meters', 'METER': 'meters', 'M': 'meters'}
NOT_CHOSEN = {'', 'false', 'no', 'nein', '0'}
TARGET = re.compile(r'\s*(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*')
NUMBER = re.compile(r'(\d+(?:[.,]\d+)?)\s*(DS|P|A)?', re.IGNORECASE)


def text(value) -> str:
    if value is None:
        return ''
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.strftime('%Y-%m-%d')
    return ' '.join(str(value).split())


def number(value: str):
    return float(value.replace(',', '.'))


def clean_name(name: str) -> str:
    """FULL BODY (A1) -> Full Body A1, the way the app names its workouts."""
    name = re.sub(r'[()]', '', name).strip()
    return name.title() if name.isupper() else name


def grid(sheet) -> list:
    return [[cell for cell in row] for row in sheet.iter_rows(values_only=True)]


def find(rows: list, pattern: str):
    """(row, column, text) of the first cell that matches."""
    for r, row in enumerate(rows):
        for c, cell in enumerate(row):
            if re.search(pattern, text(cell), re.IGNORECASE):
                return r, c, text(cell)
    return None


def as_date(value):
    if isinstance(value, datetime.datetime):
        return value.date()
    if isinstance(value, datetime.date):
        return value
    for fmt in ('%Y-%m-%d', '%d.%m.%Y', '%d/%m/%Y', '%d.%m.%y'):
        try:
            return datetime.datetime.strptime(text(value), fmt).date()
        except ValueError:
            pass
    return None


def parse_overview(sheets: list, stem: str) -> dict:
    info = {'week': None, 'year': None, 'plan': None, 'rest_seconds': None, 'days': [None] * 7, 'dates': [None] * 7}
    for rows in sheets:
        hit = find(rows, r'kalenderwoche|calendar week')
        if hit and info['week'] is None:
            numbers = [int(float(cell)) for cell in rows[hit[0]][hit[1] + 1:] if isinstance(cell, (int, float))]
            info['week'] = next((n for n in numbers if 1 <= n <= 53), None)
            info['year'] = next((n for n in numbers if n >= 2000), None)
        if not info['plan']:
            hit = find(rows[:20], r'^(?!last).*\bweek\s+[a-z0-9]$')
            info['plan'] = hit[2] if hit else None
        if not info['rest_seconds']:
            hit = find(rows[:30], r'rest time:\s*(\d+)')
            info['rest_seconds'] = int(re.search(r'(\d+)', hit[2].split(':')[1]).group(1)) if hit else None
        head = next(((r, row) for r, row in enumerate(rows) if sum(bool(re.fullmatch(r'Day\s+[IV]+', text(cell))) for cell in row) >= 5), None)
        if head:
            at = {ROMAN[text(cell).split()[1]]: c for c, cell in enumerate(head[1]) if re.fullmatch(r'Day\s+[IV]+', text(cell)) and text(cell).split()[1] in ROMAN}
            for row in rows[head[0] + 1:head[0] + 8]:
                label = next((text(cell).casefold() for cell in row if text(cell)), '')
                for index, c in at.items():
                    if label == 'workout' and text(row[c]):
                        info['days'][index] = clean_name(text(row[c]))
                    if label == 'datum' or label == 'date':
                        info['dates'][index] = as_date(row[c])
    info['plan'] = info['plan'] or (re.search(r'week\s+\w+', stem, re.IGNORECASE) or [None])[0] or 'Imported'
    return info


def header_columns(row: list) -> dict | None:
    labels = {text(cell).casefold(): c for c, cell in enumerate(row) if text(cell)}
    if not ({'übung', 'exercise'} & labels.keys()):
        return None
    sets = sorted((int(re.sub(r'\D', '', label)), c) for label, c in labels.items() if re.fullmatch(r'set\s*\d+', label))
    return {
        'name': labels.get('übung', labels.get('exercise')),
        'choice': labels.get('auswahl', labels.get('choice')),
        'target': labels.get('ziel', labels.get('target')),
        'unit': labels.get('einheit', labels.get('unit')),
        'notes': labels.get('notizen', labels.get('notes')),
        'sets': [c for _, c in sets],
    }


def cell(row: list, column) -> str:
    return text(row[column]) if column is not None and column < len(row) else ''


def parse_target(value: str) -> dict:
    match = TARGET.fullmatch(value)
    if not match:
        return {'sets': None, 'rep_min': None, 'rep_max': None}
    low = number(match.group(2))
    high = number(match.group(3)) if match.group(3) else low
    return {'sets': int(match.group(1)) if match.group(1) else None, 'rep_min': int(low), 'rep_max': int(high)}


def parse_cell(value: str) -> list:
    """The sets of one cell: [{num, kind, alt}] or [{x: True}]. A cell with "/" is "main/alternative", the last one counts."""
    if value.upper() == 'X':
        return [{'x': True}]
    sets = []
    for part in re.split(r'[+;]', value):
        pieces = part.split('/')
        match = NUMBER.search(pieces[-1])
        if match:
            sets.append({'num': number(match.group(1)), 'kind': (match.group(2) or '').upper(), 'alt': len(pieces) > 1})
    return sets


def sets_of(reps: list, weights: list, planned) -> tuple:
    """Merges the reps row and the weights row into sets. An X past the target is no set at all, without a target no X counts."""
    values, alt = [], False
    for index in range(max(len(reps), len(weights))):
        a = parse_cell(reps[index]) if index < len(reps) else []
        b = parse_cell(weights[index]) if index < len(weights) else []
        if (a and a[0].get('x')) or (b and b[0].get('x')):
            if planned is not None and index < planned:
                values.append({'value': None, 'weight': None, 'kind': '', 'disabled': True})
            continue
        for j in range(max(len(a), len(b))):
            reps_token = a[j] if j < len(a) else None
            weight_token = b[j] if j < len(b) else None
            alt = alt or bool(weight_token and weight_token['alt']) or bool(reps_token and reps_token['alt'])
            values.append({
                'value': reps_token['num'] if reps_token else None,
                'weight': weight_token['num'] if weight_token else None,
                'kind': (reps_token and reps_token['kind']) or (weight_token and weight_token['kind']) or '',
                'disabled': False,
            })
    return values, alt


def parse_workout(rows: list, start: int, end: int, columns: dict) -> dict:
    title = next((r for r in range(start - 1, max(start - 6, -1), -1) if any(text(c) for c in rows[r])), None)
    name = focus = ''
    if title is not None:
        filled = [text(c) for c in rows[title] if text(c)]
        name = clean_name(filled[0])
        focus = next((re.sub(r'^focus\s*', '', item, flags=re.IGNORECASE) for item in filled[1:] if item.casefold().startswith('focus')), '')
    lines, warmup, line, in_warmup = [], [], None, False
    for row in rows[start + 1:end]:
        label, unit_text = cell(row, columns['name']), cell(row, columns['unit']).upper()
        sets_raw = [cell(row, c) for c in columns['sets']]
        if re.fullmatch(r'/{3,}', label):
            line, in_warmup = None, False
            continue
        if label.casefold().startswith('warmup'):
            in_warmup, line = True, None
            warmup.append(re.sub(r'^warmup:\s*', '', label, flags=re.IGNORECASE))
            continue
        if in_warmup:
            if label.startswith('↳'):
                warmup.append(label.lstrip('↳ ').strip())
            continue
        arrow = label.startswith('↳')
        stripped = label.lstrip('↳ ').strip()
        if arrow and stripped.casefold().startswith('superset'):
            label, arrow, stripped = '', False, stripped.split(':', 1)[-1].strip()
            superset = True
        else:
            superset = False
        if (stripped and not arrow and stripped != '|') or superset:
            target = parse_target(cell(row, columns['target']))
            if unit_text not in UNITS and not (target['sets'] or target['rep_min']):
                line = None
                continue
            line = {
                'exercise': stripped, 'unit': UNITS.get(unit_text, 'reps'), 'weighted': False, 'sets': target['sets'], 'rep_min': target['rep_min'],
                'rep_max': target['rep_max'], 'notes': cell(row, columns['notes']), 'superset': superset, 'chosen': None, 'alternatives': [],
                '_reps': sets_raw, '_weights': [], '_choice': {},
            }
            lines.append(line)
            continue
        if line is None:
            continue
        note = cell(row, columns['notes'])
        choice = cell(row, columns['choice'])
        if arrow and stripped:
            target = parse_target(cell(row, columns['target']))
            alt_unit = line['unit'] if unit_text == 'KG' else UNITS.get(unit_text, line['unit'])
            line['alternatives'].append({'exercise': stripped, 'unit': alt_unit, 'rep_min': target['rep_min'], 'rep_max': target['rep_max'], 'notes': note})
            if choice.casefold() not in NOT_CHOSEN:
                line['chosen'] = stripped
        elif note:
            line['notes'] = f"{line['notes']}, {note}" if line['notes'] else note
        if unit_text == 'KG':
            line['weighted'] = True
            line['_weights'] = sets_raw
        if not arrow and choice:
            line['_choice']['main'] = choice
    for line in lines:
        values, alt = sets_of(line.pop('_reps'), line.pop('_weights'), line['sets'])
        picked = line.pop('_choice').get('main', '')
        match = next((a['exercise'] for a in line['alternatives'] if a['exercise'].casefold() == picked.casefold()), None)
        if match:
            line['chosen'] = match
        elif alt and line['alternatives'] and not line['chosen']:
            line['chosen'] = line['alternatives'][0]['exercise']
        line['values'] = values
        line['sets'] = line['sets'] or sum(not v['disabled'] for v in values) or 1
    return {'name': name, 'focus': focus, 'warmup': ', or '.join(warmup), 'lines': lines}


def parse_workbook(path: Path, year: int | None = None) -> dict:
    book = openpyxl.load_workbook(path, data_only=True)
    sheets = [grid(sheet) for sheet in book.worksheets]
    info = parse_overview(sheets, path.stem)
    workouts = []
    for rows in sheets:
        heads = [(r, header_columns(row)) for r, row in enumerate(rows)]
        heads = [(r, columns) for r, columns in heads if columns]
        for index, (r, columns) in enumerate(heads):
            workout = parse_workout(rows, r, heads[index + 1][0] - 1 if index + 1 < len(heads) else len(rows), columns)
            if workout['lines']:
                workouts.append(workout)

    dates = [d for d in info['dates'] if d]
    week = info['week'] or (dates[0].isocalendar()[1] if dates else None) or next((int(m) for m in re.findall(r'KW\s*(\d+)', path.stem, re.IGNORECASE)), None)
    year = info['year'] or (dates[0].isocalendar()[0] if dates else None) or year or next((int(m) for m in re.findall(r'(20\d\d)', path.stem)), None)
    if not (week and year):
        raise ValueError(f'no calendar week or year found, pass --year (week: {week}, year: {year})')
    monday = datetime.date.fromisocalendar(year, week, 1)
    days = [{'date': (info['dates'][i] or monday + datetime.timedelta(days=i)).isoformat(), 'workout': info['days'][i]} for i in range(7)]

    taken = set()
    for workout in workouts:
        index = next((i for i, day in enumerate(days) if i not in taken and day['workout'] and day['workout'].casefold() == workout['name'].casefold()), None)
        workout['date'] = days[index]['date'] if index is not None else None
        if index is not None:
            taken.add(index)
    return {'source': path.name, 'year': year, 'week': week, 'plan': info['plan'], 'rest_seconds': info['rest_seconds'], 'days': days, 'workouts': workouts}


def dump(path: Path):
    for sheet in openpyxl.load_workbook(path, data_only=True).worksheets:
        print(f'=== {sheet.title}')
        for r, row in enumerate(sheet.iter_rows(values_only=True), 1):
            cells = [f'{openpyxl.utils.get_column_letter(c)}={text(v)!r}' for c, v in enumerate(row, 1) if text(v) and not re.fullmatch(r'/{3,}', text(v))]
            if cells:
                print(r, ' '.join(cells))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('inputs', nargs='*', type=Path, help='xlsx files or folders (default: sheets/)')
    parser.add_argument('--out', type=Path, default=HERE / 'parsed')
    parser.add_argument('--year', type=int, help='for sheets without a year')
    parser.add_argument('--dump', action='store_true', help='print the cells instead of parsing')
    args = parser.parse_args()

    files = []
    for source in args.inputs or [HERE / 'sheets']:
        files += sorted(source.glob('*.xlsx')) if source.is_dir() else [source]
    files = [f for f in files if not f.name.startswith('~$')]
    if not files:
        raise SystemExit('No .xlsx files found. Put the sheets into scripts/data/sheets/ or run download_sheets.py.')
    if args.dump:
        for file in files:
            dump(file)
        return

    args.out.mkdir(parents=True, exist_ok=True)
    failed = 0
    for file in files:
        try:
            week = parse_workbook(file, args.year)
        except Exception as error:
            failed += 1
            print(f'SKIP {file.name}: {error}')
            continue
        (args.out / f'{week["year"]}-KW{week["week"]:02d}-{file.stem}.json'.replace('/', '_')).write_text(json.dumps(week, indent=2, ensure_ascii=False), 'utf-8')
        lines = sum(len(w['lines']) for w in week['workouts'])
        entries = sum(1 for w in week['workouts'] for l in w['lines'] for v in l['values'] if v['value'] is not None or v['weight'] is not None)
        print(f'{file.name}: {week["year"]} KW{week["week"]}, {len(week["workouts"])} workouts, {lines} lines, {entries} sets filled in')
    print(f'{len(files) - failed} of {len(files)} read -> {args.out}')


if __name__ == '__main__':
    main()
