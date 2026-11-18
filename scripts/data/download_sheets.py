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
Downloads Google Sheets as .xlsx into sheets/.

    download_sheets.py <url or id> [...]            sheets that are shared by link ("anyone with the link can view")
    download_sheets.py --list sheets.txt            one url or id per line, # for comments
    download_sheets.py --folder <id> --api-key KEY  every sheet in a Drive folder (shared by link, needs a Drive API key)

Sheets that are not shared can be downloaded by hand (File > Download > .xlsx) into sheets/, parse_sheets.py reads that folder.
"""

# System imports
import argparse
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from common import HERE

SHEET = 'application/vnd.google-apps.spreadsheet'


def sheet_id(source: str) -> str:
    match = re.search(r'/d/([\w-]+)', source)
    return match.group(1) if match else source.strip()


def fetch(url: str) -> tuple:
    try:
        with urllib.request.urlopen(url, timeout=120) as response:
            return response.read(), response.headers.get('Content-Disposition', '')
    except urllib.error.HTTPError as error:
        raise SystemExit(f'{url.split("?")[0]} -> {error.code}. Is the sheet shared by link?')


def filename(disposition: str, fallback: str) -> str:
    match = re.search(r"filename\*=UTF-8''([^;]+)", disposition) or re.search(r'filename="?([^";]+)', disposition)
    name = urllib.parse.unquote(match.group(1)) if match else fallback
    name = re.sub(r'[\\/:*?"<>|]', '_', name)
    return name if name.lower().endswith('.xlsx') else f'{name}.xlsx'


def download_sheet(identifier: str, folder: Path, name: str = '') -> Path:
    body, disposition = fetch(f'https://docs.google.com/spreadsheets/d/{identifier}/export?format=xlsx')
    target = folder / filename(disposition, name or identifier)
    target.write_bytes(body)
    print(f'{target.name} ({len(body) // 1024} KB)')
    return target


def list_folder(folder_id: str, api_key: str) -> list:
    query = urllib.parse.urlencode({'q': f"'{folder_id}' in parents and trashed = false", 'key': api_key, 'pageSize': 1000, 'fields': 'files(id,name,mimeType)'})
    body, _ = fetch(f'https://www.googleapis.com/drive/v3/files?{query}')
    return json.loads(body)['files']


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('sources', nargs='*', help='sheet urls or ids')
    parser.add_argument('--list', type=Path, help='text file with one url or id per line')
    parser.add_argument('--folder', help='id of a Drive folder')
    parser.add_argument('--api-key', help='Drive API key, for --folder')
    parser.add_argument('--out', type=Path, default=HERE / 'sheets')
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    sources = list(args.sources)
    if args.list:
        sources += [line.split('#')[0].strip() for line in args.list.read_text('utf-8').splitlines() if line.split('#')[0].strip()]
    for source in sources:
        download_sheet(sheet_id(source), args.out)

    if args.folder:
        if not args.api_key:
            raise SystemExit('--folder needs --api-key')
        for file in list_folder(args.folder, args.api_key):
            if file['mimeType'] == SHEET:
                download_sheet(file['id'], args.out, file['name'])
            elif file['name'].lower().endswith('.xlsx'):
                body, _ = fetch(f"https://www.googleapis.com/drive/v3/files/{file['id']}?alt=media&key={args.api_key}")
                (args.out / file['name']).write_bytes(body)
                print(file['name'])
    if not sources and not args.folder:
        parser.error('nothing to download')


if __name__ == '__main__':
    main()
