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

- A workout is reused when its lines match one of the app (same exercises, sets, reps, supersets, warm-up lines, alternatives). A
  changed one becomes a new version of the same family, the way the app does it when a trained workout is edited. Everything that is
  imported is archived, the live workouts and the active plan of the app stay as they are.
- Plans: one inactive plan for every set of workouts that was trained for some weeks ("<label> (KW03 2026)", laid out like its first
  week). Not created when a plan of that label or name exists (the active plan of the app, a second run).
- A day counts when a set has reps (or an X), the sheets paste last week's weights into the new week and those are no training. A
  day without any is not imported, a rest day is only imported when something was done. A date that has a session already (also a
  planned one of the app) is skipped.
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
    """What makes a workout the same one: [(exercise, sets, rep_min, rep_max, superset, warmup, (alternatives))]."""
    return tuple((name, sets, low or 0, high or 0, bool(superset), bool(warmup), tuple(alts)) for name, sets, low, high, superset, warmup, alts in lines)


def doc_signature(workout: dict, aliases: dict) -> tuple:
    return signature([
        (canonical(line['exercise'], aliases).casefold(), line['sets'], line['rep_min'], line['rep_max'], line['superset'], line['warmup'],
         [canonical(alt['exercise'], aliases).casefold() for alt in line['alternatives']])
        for line in workout['lines']
    ])


def is_done(value: dict) -> bool:
    """The sheets paste last week's weights into the new week and leave 0 in unused cells, only reps (or an X) tell that a set was done."""
    return value['disabled'] or bool(value['value'])


def has_numbers(workout: dict) -> bool:
    return any(is_done(v) for line in workout['lines'] for v in line['values'])


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
        self.counts = {'workouts': 0, 'plans': 0, 'sessions': 0, 'sets': 0, 'skipped': 0}

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
                (self.exercise_names[main['exercise']], main['sets'], main.get('rep_min'), main.get('rep_max'), main.get('superset'), main.get('warmup'),
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
            'name': doc['name'], 'focus': doc['focus'], 'kind': kind_of(doc), 'warmup': '', 'notes': '', 'archived': True, 'rev': self.now,
            'rest_seconds': 0 if kind_of(doc) == 'rest' else week['rest_seconds'] or DEFAULT_REST_SECONDS,
            'version': max((v.get('version') or 1 for v in versions), default=0) + 1,
            'family': (first.get('family') or first['id']) if first else '',
        }])[0]
        mains = self.api.create('WorkoutExercise', [{
            'workout': row['id'], 'exercise': self.exercise_ids[canonical(line['exercise'], self.aliases).casefold()], 'position': position, 'sets': line['sets'],
            'rep_min': line['rep_min'] or 0, 'rep_max': line['rep_max'] or 0, 'superset': line['superset'], 'warmup': line['warmup'], 'notes': split_notes(line['notes'])[0], 'rev': self.now,
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
                if taken[doc['date']] not in ('imported', 'done'):
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
            for position, value in enumerate(v for v in line['values'] if is_done(v)):
                sets.append({
                    'session': session['id'], 'session_exercise': entry['id'], 'position': position, 'value': value['value'] or 0, 'weight': value['weight'] or 0,
                    'kind': value['kind'], 'disabled': value['disabled'], 'done': not value['disabled'], 'started_at': 0, 'ended_at': 0,
                    'rest_started_at': 0, 'rest_ended_at': 0, 'rev': self.now,
                })
        self.api.create('SetLog', sets)
        self.counts['sessions'], self.counts['sets'] = len(sessions), len(sets)
        self.plans(weeks)
        print(f'{self.counts["workouts"]} workout versions, {self.counts["plans"]} plans, {self.counts["sessions"]} sessions and {self.counts["sets"]} sets added, {self.counts["skipped"]} days were there already')

    def plans(self, weeks: list):
        """One inactive plan for every set of workouts that was trained for some weeks (same label, same workouts, the days are the first week's
        as the weeks rotate when a day is shifted). The plans of the app (same name or same label) are left alone, the live workouts too."""
        existing = {plan['name'].casefold() for plan in self.api.all('Plan')}
        def worked(week: dict) -> set:
            return {day['workout'].casefold() for day in week['days'] if day['workout'] and not day['workout'].casefold().startswith('rest')}

        groups: list = []  # [label, workout names, first week, fullest week]
        for week in weeks:
            names = worked(week)
            group = next((g for g in groups if g[0] == week['plan'] and names & g[1] and len(names & g[1]) >= min(len(names), len(g[1])) - 1), None)  # a week with a day missing or shifted away is still the same plan
            if not group:
                groups.append([week['plan'], names, week, week])
                continue
            group[1] |= names
            if len(names) > len(worked(group[3])):
                group[3] = week
        added = 0
        for label, _, first, week in groups:
            name = f'{label} (KW{first["week"]:02d} {first["year"]})'
            if label.casefold() in existing or name.casefold() in existing:
                continue
            days = []
            for position, day in enumerate(week['days']):
                doc = next((d for d in week['workouts'] if d['date'] == day['date']), None)
                row = self.workout_for(week, doc) if doc else None
                row = row or next(iter(reversed(self.versions.get((day['workout'] or '').casefold(), []))), None)
                if row:
                    days.append({'position': position, 'workout': row['id']})
            if not days:
                continue
            plan = self.api.create('Plan', [{'name': name, 'active': False, 'default': False, 'notes': '', 'rev': self.now}])[0]
            self.api.create('PlanDay', [{'plan': plan['id'], **day, 'rev': self.now} for day in days])
            existing.add(name.casefold())
            added += 1
            print(f'+ plan "{name}" with {len(days)} days')
        self.counts['plans'] = added


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
