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

"""Shared by the import scripts: the HSDB HTTP client, the aliases and the week documents."""

# System imports
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ALIASES = HERE / 'aliases.json'
DEFAULT_URL = os.environ.get('TICKFIT_URL', f"http://127.0.0.1:{os.environ.get('TICKFIT_PORT', '8767')}")


def now_ms() -> int:
    return int(time.time() * 1000)


def load_aliases() -> dict:
    """Source name -> name in the app, compared case-insensitively."""
    if not ALIASES.exists():
        return {}
    return {key.casefold(): value for key, value in json.loads(ALIASES.read_text('utf-8')).items() if not key.startswith('_')}


def canonical(name: str, aliases: dict) -> str:
    name = ' '.join(name.split())
    return aliases.get(name.casefold(), name)


def load_weeks(folder: Path) -> list:
    """The week documents of parse_sheets.py (or of a PDF reader that writes the same schema), oldest first."""
    weeks = [json.loads(path.read_text('utf-8')) for path in sorted(Path(folder).glob('*.json'))]
    return sorted(weeks, key=lambda week: (week['year'], week['week'], week['source']))


class Api:
    """The HSDB routes of the tickfit server: GET/POST /hsdb/<Model>, PATCH /hsdb/<Model>/<id>, POST /hsdb/<Model>/bulk."""

    def __init__(self, url: str = DEFAULT_URL, dry_run: bool = False):
        self.url = url.rstrip('/')
        self.dry_run = dry_run
        self._fake = 0

    def request(self, method: str, path: str, body=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(f'{self.url}/hsdb{path}', data=data, method=method, headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read() or 'null')
        except urllib.error.HTTPError as error:
            raise SystemExit(f'{method} {path} -> {error.code}: {error.read().decode()[:300]}')
        except urllib.error.URLError as error:
            raise SystemExit(f'No server at {self.url} ({error.reason}). Start it first or pass --url.')

    def all(self, model: str, relations: bool = False) -> list:
        return self.request('GET', f'/{model}' + ('?include_relations=true' if relations else ''))

    def create(self, model: str, rows: list) -> list:
        """Creates the rows in chunks and returns them with their ids, in order. A dry run hands out fake ids."""
        if self.dry_run:
            created = []
            for row in rows:
                self._fake += 1
                created.append({**row, 'id': f'dry-{self._fake}'})
            return created
        created = []
        for start in range(0, len(rows), 200):
            result = self.request('POST', f'/{model}/bulk', {'create': rows[start:start + 200]})['create']
            for item in result:
                if not item.get('ok'):
                    raise SystemExit(f'{model}: {item.get("error")}')
                created.append(item['data'])
        return created

    def patch(self, model: str, entry_id: str, data: dict):
        if not self.dry_run:
            self.request('PATCH', f'/{model}/{entry_id}', data)
