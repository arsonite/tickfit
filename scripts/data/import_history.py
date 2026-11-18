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
Imports the parsed weeks (parsed/) into a running tickfit server: exercises, workouts, and for every day with numbers in it a done
session with its sets. Run it again after parsing more sheets, what is there already is left alone.

    import_history.py [--dry-run] [--url http://127.0.0.1:8767] [--parsed parsed/]

- A workout is reused when its lines match one of the app (same exercises, sets, reps, supersets, alternatives). A changed one
  becomes a new version of the same family, the way the app does it when a trained workout is edited. Versions that no live workout
  of that name has are archived, the newest of a name that has none stays live.
- A day without any numbers is not imported, a rest day is only imported when something was done. A date that has a session already
  (also a planned one of the app) is skipped and reported.
- The clock of the old weeks was never tracked, started_at/finished_at and the set times stay 0.
- Open the app afterwards, the sync pulls everything.
"""

# System imports
import argparse
from pathlib import Path

from common import HERE, Api, DEFAULT_URL, canonical, load_aliases, load_weeks, now_ms
from seed_exercises import ensure_exercises

DEFAULT_REST_SECONDS = 90


def split_notes(text: str) -> tuple:
    """"Rack: 4, *Includes drop sets" -> (note of the workout line, comment of the day)."""
    parts = [part.strip() for part in text.split(',') if part.strip()]
    return ', '.join(p for p in parts if p.startswith('*')), ', '.join(p for p in parts if not p.startswith('*'))


def signature(lines: list) -> tuple:
    """What makes a workout the same one: [(exercise, sets, rep_min, rep_max, superset, (alternatives))]."""
    return tuple((name, sets, low or 0, high or 0, bool(superset), tuple(alts)) for name, sets, low, high, superset, alts in lines)


def doc_signature(workout: dict, aliases: dict) -> tuple:
    return signature([
        (canonical(line['exercise'], aliases).casefold(), line['sets'], line['rep_min'], line['rep_max'], line['superset'],
         [canonical(alt['exercise'], aliases).casefold() for alt in line['alternatives']])
        for line in workout['lines']
    ])


def has_numbers(workout: dict) -> bool:
    return any(v['value'] is not None or v['weight'] is not None for line in workout['lines'] for v in line['values'])


def kind_of(workout: dict) -> str:
    if workout['name'].casefold() == 'rest':
        return 'rest'
    return 'cardio' if workout['lines'][0]['unit'] != 'reps' else 'strength'


class Importer:
    def __init__(self, api: Api, aliases: dict):
        self.api, self.aliases = api, aliases
        self.now = now_ms()
        self.exercise_ids: dict = {}
        self.exercise_names: dict = {}
        self.versions: dict = {}   # name casefold -> [workout rows, oldest first]
        self.slots: dict = {}      # workout id -> {'mains': [rows], 'alts': {main id: {name casefold: row}}}
        self.signatures: dict = {}  # workout id -> signature
        self.counts = {'workouts': 0, 'sessions': 0, 'sets': 0, 'skipped': 0}

    def load(self, weeks: list):
        self.exercise_ids = ensure_exercises(self.api, weeks, self.aliases)
        self.exercise_names = {value: key for key, value in self.exercise_ids.items()}
        workouts = self.api.all('Workout')
        by_workout: dict = {}
        for slot in self.api.all('WorkoutExercise', relations=True):
            by_workout.setdefault(slot['workout'], []).append(slot)
        for workout in sorted(workouts, key=lambda row: row.get('version') or 1):
            self.versions.setdefault(workout['name'].casefold(), []).append(workout)
            rows = sorted(by_workout.get(workout['id'], []), key=lambda slot: slot['position'])
            mains = [slot for slot in rows if not slot.get('alternative_of')]
            alts = {main['id']: {self.exercise_names[a['exercise']]: a for a in rows if a.get('alternative_of') == main['id']} for main in mains}
            self.slots[workout['id']] = {'mains': mains, 'alts': alts}
            self.signatures[workout['id']] = signature([
                (self.exercise_names[main['exercise']], main['sets'], main.get('rep_min'), main.get('rep_max'), main.get('superset'),
                 [self.exercise_names[a['exercise']] for a in sorted(alts[main['id']].values(), key=lambda a: a['position'])])
                for main in mains
            ])

    def workout_for(self, week: dict, doc: dict) -> dict:
        versions = self.versions.setdefault(doc['name'].casefold(), [])
        sig = doc_signature(doc, self.aliases)
        found = next((row for row in versions if self.signatures[row['id']] == sig), None)
        if found:
            return found
        first = versions[0] if versions else None
        row = self.api.create('Workout', [{
            'name': doc['name'], 'focus': doc['focus'], 'kind': kind_of(doc), 'warmup': doc['warmup'], 'notes': '', 'archived': True, 'rev': self.now,
            'rest_seconds': 0 if kind_of(doc) == 'rest' else week['rest_seconds'] or DEFAULT_REST_SECONDS,
            'version': max((v.get('version') or 1 for v in versions), default=0) + 1,
            'family': (first.get('family') or first['id']) if first else '',
        }])[0]
        mains = self.api.create('WorkoutExercise', [{
            'workout': row['id'], 'exercise': self.exercise_ids[canonical(line['exercise'], self.aliases).casefold()], 'position': position, 'sets': line['sets'],
            'rep_min': line['rep_min'] or 0, 'rep_max': line['rep_max'] or 0, 'superset': line['superset'], 'notes': split_notes(line['notes'])[0], 'rev': self.now,
        } for position, line in enumerate(doc['lines'])])
        wanted = [(main, position, alt) for main, line in zip(mains, doc['lines']) for position, alt in enumerate(line['alternatives'])]
        alts = self.api.create('WorkoutExercise', [{
            'workout': row['id'], 'exercise': self.exercise_ids[canonical(alt['exercise'], self.aliases).casefold()], 'alternative_of': main['id'], 'position': position,
            'sets': main['sets'], 'rep_min': alt['rep_min'] or 0, 'rep_max': alt['rep_max'] or 0, 'notes': split_notes(alt['notes'])[0], 'rev': self.now,
        } for main, position, alt in wanted])
        table: dict = {main['id']: {} for main in mains}
        for (main, _, alt), created in zip(wanted, alts):
            table[main['id']][canonical(alt['exercise'], self.aliases).casefold()] = created
        self.slots[row['id']] = {'mains': mains, 'alts': table}
        self.signatures[row['id']] = sig
        versions.append(row)
        self.counts['workouts'] += 1
        return row

    def sessions_of(self, week: dict, taken: dict) -> list:
        """The sessions to create for a week: [(row, workout row, doc)]."""
        planned = []
        for doc in week['workouts']:
            if not doc['date'] or not has_numbers(doc):
                continue
            if doc['date'] in taken:
                self.counts['skipped'] += 1
                if taken[doc['date']] != 'imported':
                    print(f'skip {doc["date"]} {doc["name"]}: the day has a {taken[doc["date"]]} session already')
                continue
            workout = self.workout_for(week, doc)
            index = next((i for i, day in enumerate(week['days']) if day['date'] == doc['date']), -1)
            row = {'date': doc['date'], 'status': 'done', 'workout': workout['id'], 'plan_day': index, 'notes': '', 'started_at': 0, 'finished_at': 0, 'rev': self.now}
            planned.append((row, workout, doc))
            taken[doc['date']] = 'imported'
        return planned

    def run(self, weeks: list):
        self.load(weeks)
        taken = {session['date']: session['status'] for session in self.api.all('Session')}
        planned = []
        for week in weeks:
            planned += self.sessions_of(week, taken)

        sessions = self.api.create('Session', [row for row, _, _ in planned])
        wanted = []  # (session, slot rows of the workout, line, doc notes)
        for session, (_, workout, doc) in zip(sessions, planned):
            for main, line in zip(self.slots[workout['id']]['mains'], doc['lines']):
                chosen = self.slots[workout['id']]['alts'][main['id']].get(canonical(line['chosen'], self.aliases).casefold()) if line['chosen'] else None
                wanted.append((session, main, chosen or main, line))
        entries = self.api.create('SessionExercise', [{
            'session': session['id'], 'slot': main['id'], 'chosen': chosen['id'], 'notes': split_notes(line['notes'])[1], 'rev': self.now,
        } for session, main, chosen, line in wanted])
        sets = []
        for entry, (session, _, _, line) in zip(entries, wanted):
            for position, value in enumerate(v for v in line['values'] if v['disabled'] or v['value'] is not None or v['weight'] is not None):
                sets.append({
                    'session': session['id'], 'session_exercise': entry['id'], 'position': position, 'value': value['value'] or 0, 'weight': value['weight'] or 0,
                    'kind': value['kind'], 'disabled': value['disabled'], 'done': not value['disabled'], 'started_at': 0, 'ended_at': 0,
                    'rest_started_at': 0, 'rest_ended_at': 0, 'rev': self.now,
                })
        self.api.create('SetLog', sets)
        self.counts['sessions'], self.counts['sets'] = len(sessions), len(sets)
        self.finish(weeks)
        print(f'{self.counts["workouts"]} workout versions, {self.counts["sessions"]} sessions and {self.counts["sets"]} sets added, {self.counts["skipped"]} days were there already')

    def finish(self, weeks: list):
        """Makes the newest version of every name without a live one live, and adds the plan of the first week when the app has none."""
        for versions in self.versions.values():
            if not any(not row.get('archived') for row in versions):
                self.api.patch('Workout', versions[-1]['id'], {'archived': False, 'rev': self.now})
                versions[-1]['archived'] = False
        if not weeks or self.api.all('Plan'):
            return
        plan = self.api.create('Plan', [{'name': weeks[0]['plan'], 'active': True, 'notes': '', 'rev': self.now}])[0]
        live = {name: next(row for row in reversed(rows) if not row.get('archived')) for name, rows in self.versions.items() if any(not row.get('archived') for row in rows)}
        days = [live[day['workout'].casefold()] for day in weeks[0]['days'] if day['workout'] and day['workout'].casefold() in live]
        self.api.create('PlanDay', [{'plan': plan['id'], 'position': position, 'workout': row['id'], 'rev': self.now} for position, row in enumerate(days)])
        print(f'plan "{plan["name"]}" added with {len(days)} days')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--url', default=DEFAULT_URL)
    parser.add_argument('--parsed', type=Path, default=HERE / 'parsed')
    parser.add_argument('--dry-run', action='store_true', help='read the server, write nothing')
    args = parser.parse_args()
    weeks = load_weeks(args.parsed) if args.parsed.exists() else []
    if not weeks:
        raise SystemExit('No parsed weeks. Run parse_sheets.py first.')
    Importer(Api(args.url, args.dry_run), load_aliases()).run(weeks)


if __name__ == '__main__':
    main()
