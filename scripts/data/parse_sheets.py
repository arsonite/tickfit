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
Reads the weekly sheets (.xlsx) into week documents (parsed/<year>-KW<week>-<file>.json) that import_history.py and seed_exercises.py use.

    parse_sheets.py [files or folders]   default: sheets/ (folders like 2025/ and 2026/ work, the folder name is the year)
    parse_sheets.py --dump file.xlsx     prints every filled cell, to see what the parser sees

Week and year come from the file name ("KW 47 (FB).xlsx") and the folder, the dates of the days are computed from them (the cells
inside the sheets were often copied along and are only compared, a mismatch is reported). Two layouts are known:

    Landing page   a "Landing Page" sheet with the days (Day I..VII, workout names) and one sheet per workout, found by its name.
                   The sheets have a header row (Übung, Auswahl, Ziel, Set 1..n, Einheit, Notizen), moved columns are fine
    Teaser         the first sheets (FitGPT 3.0/5.0): one sheet per weekday ("Montag Push 1"), no header row, fixed columns A-I

How a workout sheet looks:

    Übung / Einheit REPS      the exercise, its target ("3 x 8-12") and the reps of every set
    ↳ name / Einheit KG       an alternative, in the KG row: the weights of the exercise that was done ("40/22" = 40 for the
                              first, 22 for the alternative that was chosen). "a / b" is two alternatives
    ↳ Superset: name          done in turns with the line above
    Warmup: name              a line of the warm-up
    X in a set                the set does not exist (past the target) or was left out on purpose (within it)
    10 DS, 8 P, 12 A          drop set, partial, assisted. "10+8 DS" and "10 - 8" are two sets in one cell (the later ones drop sets)
    a date in a set           Excel turned "22.5" into the 22nd of May, it is turned back

Weights that are filled in but without reps are the numbers the sheet pastes in for the next week, they are not a workout.
A week that can not be read is reported and skipped, the others are still written.

The week document:
    {source, year, week, plan, rest_seconds, days: [{date, workout}], warnings: [...], workouts: [{name, focus, warmup, date,
     lines: [{exercise, unit, weighted, warmup, sets, rep_min, rep_max, notes, superset, chosen, alternatives: [...],
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
WEEKDAYS = {'montag': 0, 'dienstag': 1, 'mittwoch': 2, 'donnerstag': 3, 'freitag': 4, 'samstag': 5, 'sonntag': 6}
UNITS = {'REPS': 'reps', 'MINUTES': 'minutes', 'MINUTEN': 'minutes', 'MIN': 'minutes', 'METERS': 'meters', 'METER': 'meters', 'M': 'meters'}
NOT_CHOSEN = {'', 'false', 'no', 'nein', '0'}
OVERVIEWS = {'landing page', 'teaser'}
NOT_WORKOUTS = {'aux'}  # the pelvic floor instructions, no sets in there
NOT_A_LABEL = re.compile(r'^(?:fitgpt|📅|kalenderwoche|rest time|übung|notizen|index|[>|↳])', re.IGNORECASE)
FRAME = {'name': 0, 'choice': 1, 'target': 2, 'sets': [3, 4, 5, 6], 'unit': 7, 'notes': 8}  # the sheets without a header row
TARGET = re.compile(r'\s*(?:(\d+)(?:\s*-\s*(\d+))?\s*[x×]\s*)?(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*[A-Za-zäöüÄÖÜ]*\s*')
NUMBER = re.compile(r'(\d+(?:[.,]\d+)?)\s*(DS|P|A)?', re.IGNORECASE)
SEGMENTS = re.compile(r'\s+[-–]\s+|\s*[+;]\s*')
SUPERSET = re.compile(r'^(?:↳|\|)?\s*[|-]*\s*Superset(?:\s*\d+|\s*\([^)]*\))?\s*:\s*(.*)$', re.IGNORECASE)
ALTERNATIVE = re.compile(r'^(?:↳|\|?\s*>)\s*(?:Alternative\s+)?(.*)$', re.IGNORECASE)
OPTIONAL = re.compile(r'^(?:\(optional\)|optional:)\s*', re.IGNORECASE)
WARMUP = re.compile(r'^warm-?up\s*:\s*(.*)$', re.IGNORECASE)


def text(value) -> str:
    if value is None:
        return ''
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.strftime('%Y-%m-%d')
    return ' '.join(str(value).split())


def set_text(value) -> str:
    """A cell of a set. Excel read "22.5" as a date and "0:30" as a time, both are turned back."""
    if isinstance(value, datetime.datetime):
        return f'{value.day}.{value.month}'
    if isinstance(value, datetime.time):
        return str(value.hour * 60 + value.minute)
    return text(value)


def number(value: str):
    return float(value.replace(',', '.'))


def clean_name(name: str) -> str:
    """FULL BODY (A1) -> Full Body A1 and no emojis, the way the app names its workouts."""
    name = re.sub(r'[()]', '', name)
    name = ' '.join(re.sub(r'[^\w\s+°&.-]', '', name).split())
    return name.title() if name.isupper() else name


def sheet_key(title: str) -> str:
    """What a day of the landing page and the tab of its sheet have in common."""
    title = re.sub(r'^kopie von\s+', '', title.casefold().strip())
    return ' '.join(re.sub(r'[^\w+()]+', ' ', title).split())


def grid(sheet) -> list:
    return [[cell for cell in row] for row in sheet.iter_rows(values_only=True)]


def find(rows: list, pattern: str):
    """(row, column, text) of the first cell that matches."""
    for r, row in enumerate(rows):
        for c, cell in enumerate(row):
            if re.search(pattern, text(cell), re.IGNORECASE):
                return r, c, text(cell)
    return None


def parse_overview(rows: list | None) -> dict:
    info = {'plan': None, 'rest_seconds': None, 'names': [None] * 7, 'dates': [None] * 7, 'week': None, 'year': None}
    if not rows:
        return info
    hit = find(rows[:30], r'rest time:\s*(\d+)')
    info['rest_seconds'] = int(re.search(r'(\d+)', hit[2].split(':')[1]).group(1)) if hit else None
    info['plan'] = next((text(row[0]) for row in rows[:12] if row and text(row[0]) and not NOT_A_LABEL.match(text(row[0]))), None)
    hit = find(rows, r'kalenderwoche|calendar week')
    if hit:
        numbers = [text(cell) for cell in rows[hit[0]][hit[1] + 1:hit[1] + 3]]
        info['week'] = int(numbers[0]) if numbers and numbers[0].isdigit() else None
        info['year'] = int(numbers[1]) if len(numbers) > 1 and numbers[1].isdigit() else None
    head = next(((r, row) for r, row in enumerate(rows) if sum(bool(re.fullmatch(r'Day\s+[IV]+', text(cell))) for cell in row) >= 5), None)
    if head:
        at = {ROMAN[text(cell).split()[1]]: c for c, cell in enumerate(head[1]) if re.fullmatch(r'Day\s+[IV]+', text(cell)) and text(cell).split()[1] in ROMAN}
        for row in rows[head[0] + 1:head[0] + 8]:
            label = next((text(cell).casefold() for cell in row if text(cell)), '')
            for index, c in at.items():
                if label == 'workout' and text(row[c]):
                    info['names'][index] = text(row[c])
                if label in ('datum', 'date'):
                    info['dates'][index] = row[c].date() if isinstance(row[c], datetime.datetime) else None
    return info


def header_columns(row: list) -> dict | None:
    labels = {text(cell).casefold(): c for c, cell in enumerate(row) if text(cell)}
    if not ({'übung', 'exercise'} & labels.keys()):
        return None
    sets = sorted((int(re.sub(r'\D', '', label)), c) for label, c in labels.items() if re.fullmatch(r'set\s*\d+', label))
    return {
        'name': labels.get('übung', labels.get('exercise')),
        'choice': labels.get('auswahl', labels.get('choice')),
        'target': next((c for label, c in labels.items() if label.startswith(('ziel', 'target'))), None),
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
    low = number(match.group(3))
    high = number(match.group(4)) if match.group(4) else low
    sets = match.group(2) or match.group(1)
    return {'sets': int(sets) if sets else None, 'rep_min': int(low), 'rep_max': int(high)}


def parse_cell(value: str) -> list:
    """The sets of one cell: [{num, kind, alt, chained}] or [{x: True}]. A cell with "/" is "main/alternative", the last one counts."""
    if value.upper() == 'X':
        return [{'x': True}]
    sets = []
    for index, part in enumerate(SEGMENTS.split(value)):
        pieces = part.split('/')
        match = NUMBER.search(pieces[-1])
        if match:
            sets.append({'num': number(match.group(1)), 'kind': (match.group(2) or '').upper(), 'alt': len(pieces) > 1, 'chained': index > 0})
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
        if len(a) == 1 and len(b) > 1:  # "30 + 6.8": a plate on top of the stack
            b = [{**b[0], 'num': sum(token['num'] for token in b)}]
        for j in range(max(len(a), len(b))):
            reps_token = a[j] if j < len(a) else None
            weight_token = b[j] if j < len(b) else (b[-1] if b and reps_token else None)
            alt = alt or bool(weight_token and weight_token['alt']) or bool(reps_token and reps_token['alt'])
            chained = bool((reps_token or weight_token or {}).get('chained'))
            values.append({
                'value': reps_token['num'] if reps_token else None,
                'weight': weight_token['num'] if weight_token else None,
                'kind': (reps_token and reps_token['kind']) or (weight_token and weight_token['kind']) or ('DS' if chained else ''),
                'disabled': False,
            })
    return values, alt


def classify(label: str) -> tuple:
    """(what the row is, the name in it): main, warmup, superset, alt, bar (the | between superset lines), blank, divider."""
    if not label:
        return 'blank', ''
    if re.fullmatch(r'/{3,}', label):
        return 'divider', ''
    if re.fullmatch(r'\|+', label):
        return 'bar', ''
    for kind, pattern in (('warmup', WARMUP), ('superset', SUPERSET), ('alt', ALTERNATIVE)):
        match = pattern.match(label)
        if match:
            return kind, OPTIONAL.sub('', match.group(1)).strip()
    return 'main', OPTIONAL.sub('', re.sub(r'^\|\s*', '', label)).strip()


def split_alternatives(name: str) -> list:
    return [part.strip() for part in re.split(r'\s+/\s+', name) if part.strip()]


def parse_sheet(title: str, rows: list) -> dict | None:
    head = next(((r, columns) for r, columns in ((r, header_columns(row)) for r, row in enumerate(rows)) if columns), None)
    columns, start = (head[1], head[0] + 1) if head else (FRAME, 1)
    title_row = next((r for r in range((head[0] if head else 1) - 1, -1, -1) if any(text(c) for c in rows[r])), None)
    name, focus, weekday = '', '', None
    if title_row is not None:
        filled = [text(c) for c in rows[title_row] if text(c)]
        label = filled[0]
        if ':' in label and label.split(':')[0].casefold() in WEEKDAYS:
            weekday, label = WEEKDAYS[label.split(':')[0].casefold()], label.split(':', 1)[1]
        name = clean_name(label)
        focus = next((re.sub(r'^focus\s*', '', item, flags=re.IGNORECASE) for item in filled[1:] if item.casefold().startswith('focus')), '')
        focus = focus or (filled[1] if len(filled) > 1 and not head else '')
    if weekday is None:
        weekday = WEEKDAYS.get(title.split()[0].casefold()) if title.split() else None

    lines, line = [], None
    for row in rows[start:]:
        kind, label = classify(cell(row, columns['name']))
        unit_text = cell(row, columns['unit']).upper()
        sets_raw = [set_text(row[c]) if c < len(row) else '' for c in columns['sets']]
        note = cell(row, columns['notes'])
        if re.fullmatch(r'[\d.,:\s-]*', note):  # numbers in the notes column are what the old sheets left behind
            note = ''
        choice = cell(row, columns['choice'])
        if kind == 'divider':
            line = None
            continue
        target = parse_target(cell(row, columns['target']))
        if kind == 'main' and line and unit_text in ('KG', '') and not line['_weights'] and not target['rep_min'] and not choice and not line['alternatives']:
            line['exercise'] = f"{line['exercise']} {label}"  # the name went over two cells
            kind = 'blank'
        if kind in ('main', 'warmup', 'superset'):
            if unit_text not in UNITS and not (target['sets'] or target['rep_min']):
                line = None
                continue
            line = {
                'exercise': label, 'unit': UNITS.get(unit_text, 'reps'), 'weighted': False, 'warmup': kind == 'warmup', 'sets': target['sets'],
                'rep_min': target['rep_min'], 'rep_max': target['rep_max'], 'notes': note, 'superset': kind == 'superset', 'chosen': None,
                'alternatives': [], '_reps': sets_raw, '_weights': [],
            }
            lines.append(line)
            continue
        if line is None:
            continue
        if kind == 'alt' and label:
            alt_unit = line['unit'] if unit_text in ('KG', '') else UNITS.get(unit_text, line['unit'])
            for position, alt_name in enumerate(split_alternatives(label)):
                line['alternatives'].append({'exercise': alt_name, 'unit': alt_unit, 'rep_min': target['rep_min'], 'rep_max': target['rep_max'], 'notes': note})
                if choice.casefold() not in NOT_CHOSEN and position == 0:
                    line['chosen'] = alt_name
        elif note:
            line['notes'] = f"{line['notes']}, {note}" if line['notes'] else note
        bare_weights = not unit_text and line['unit'] == 'reps' and not line['_weights'] and any(re.search(r'\d', s) for s in sets_raw)
        if unit_text == 'KG' or bare_weights:
            line['weighted'] = True
            line['_weights'] = sets_raw

    for line in lines:
        values, alt = sets_of(line.pop('_reps'), line.pop('_weights'), line['sets'])
        if not line['chosen'] and alt and line['alternatives']:
            line['chosen'] = line['alternatives'][0]['exercise']
        line['values'] = values
        line['sets'] = line['sets'] or sum(not v['disabled'] for v in values) or 1
    lines = [line for line in lines if line['exercise']]
    if not lines:
        return None
    return {'name': name, 'focus': focus, 'warmup': '', 'lines': lines, 'sheet': title, 'weekday': weekday}


def week_of(path: Path, info: dict, year: int | None) -> tuple:
    week = next((int(m) for m in re.findall(r'KW\s*(\d+)', path.stem, re.IGNORECASE)), None)
    folder = int(path.parent.name) if re.fullmatch(r'20\d\d', path.parent.name) else None
    return week or info['week'], folder or year or info['year']


def assign(names: list, sheets: list) -> list:
    """For every day the sheet with its name (several days of a name take the sheets in their order), or None."""
    taken, found = set(), []
    for name in names:
        key = sheet_key(name) if name else None
        picked = None
        for wanted in (key, re.sub(r'\s\d+$', '', key or '')):
            picked = next((i for i, (title, _) in enumerate(sheets) if i not in taken and wanted and sheet_key(title) == wanted), None)
            if picked is not None:
                break
        if picked is not None:
            taken.add(picked)
        found.append(picked)
    return found


def has_reps(doc: dict) -> bool:
    return any(v['value'] is not None for line in doc['lines'] for v in line['values'])


def parse_workbook(path: Path, year: int | None = None) -> dict:
    book = openpyxl.load_workbook(path, data_only=True)
    sheets = [(sheet.title, grid(sheet)) for sheet in book.worksheets]
    overview = sheets[0][1] if sheets[0][0].strip().casefold() in OVERVIEWS else None
    info = parse_overview(overview)
    docs = [(title, parse_sheet(title, rows)) for title, rows in sheets[1 if overview else 0:] if title.strip().casefold() not in NOT_WORKOUTS]
    docs = [(title, doc) for title, doc in docs if doc]
    week, year = week_of(path, info, year)
    if not (week and year):
        raise ValueError(f'no calendar week or year found, pass --year (week: {week}, year: {year})')
    monday = datetime.date.fromisocalendar(year, week, 1)
    warnings = []
    if info['week'] and info['week'] != week:
        warnings.append(f'the sheet says week {info["week"]}, the file name {week}')
    if any(info['dates']) and info['dates'][0] and info['dates'][0] != monday:
        warnings.append(f'the sheet says Monday is {info["dates"][0]}, the file name gives {monday}')

    if any(info['names']):
        picks = assign([n or '' for n in info['names']], docs)
        leftover = [doc for i, (_, doc) in enumerate(docs) if i not in picks and has_reps(doc)]  # worked out on a day the page has another name for
        days = []
        for index, pick in enumerate(picks):
            doc = docs[pick][1] if pick is not None else None
            if doc is None and leftover:
                doc = leftover.pop(0)
                warnings.append(f'"{doc["sheet"]}" has no day of its name, put on {info["names"][index] or "the day"} ({(monday + datetime.timedelta(days=index)).isoformat()})')
            if doc:
                doc['date'] = (monday + datetime.timedelta(days=index)).isoformat()
            days.append({'date': (monday + datetime.timedelta(days=index)).isoformat(), 'workout': doc['name'] if doc else clean_name(info['names'][index] or '') or None})
        warnings += [f'"{doc["sheet"]}" has numbers but no day is left, left out' for doc in leftover]
    else:
        days = [{'date': (monday + datetime.timedelta(days=i)).isoformat(), 'workout': None} for i in range(7)]
        for _, doc in docs:
            if doc['weekday'] is not None:
                days[doc['weekday']]['workout'] = doc['name']
                doc['date'] = days[doc['weekday']]['date']
    workouts = [doc for _, doc in docs if doc.get('date')]
    for doc in workouts:
        del doc['weekday']
    return {'source': path.name, 'year': year, 'week': week, 'plan': info['plan'] or 'Imported', 'rest_seconds': info['rest_seconds'], 'days': days,
            'warnings': warnings, 'workouts': workouts}


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
    parser.add_argument('--year', type=int, help='for files that are not in a folder named by year')
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
            print(f'SKIP {file.parent.name}/{file.name}: {error}')
            continue
        (args.out / f'{week["year"]}-KW{week["week"]:02d}-{file.stem}.json'.replace('/', '_')).write_text(json.dumps(week, indent=2, ensure_ascii=False), 'utf-8')
        lines = sum(len(w['lines']) for w in week['workouts'])
        entries = sum(1 for w in week['workouts'] for l in w['lines'] for v in l['values'] if v['value'] is not None)
        print(f'{file.name}: {week["year"]} KW{week["week"]}, {len(week["workouts"])} workouts, {lines} lines, {entries} sets filled in')
        for warning in week['warnings']:
            print(f'    ! {warning}')
    print(f'{len(files) - failed} of {len(files)} read -> {args.out}')


if __name__ == '__main__':
    main()
