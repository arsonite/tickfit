<a name="readme-top"></a>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/arsonite/tickfit">
    <img src="public/favicon.svg" alt="project icon" width="80" height="80">
  </a>

<h1 align="center">tickfit</h3>

  <p align="center">
    Workout plans, a self-aligning weekly schedule and a training log, in place of the spreadsheet.
    <br />
    ·
    <a href="https://github.com/arsonite/tickfit/issues">Report Bug</a>
    ·
    <a href="https://github.com/arsonite/tickfit/issues">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<summary>Table of Contents</summary>
<ol>
  <li><a href="#about">About</a></li>
  <li><a href="#getting-started">Getting started</a></li>
  <li><a href="#migrations">Migrations</a></li>
  <li><a href="#importing-old-sheets">Importing old sheets</a></li>
  <li><a href="#contributing">Contributing</a></li>
  <li><a href="#license">License</a></li>
  <li><a href="#contact">Contact</a></li>
</ol>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

-   [![React][React.js]][React-url]
-   [![TypeScript][TypeScript]][TypeScript-url]
-   [![Vite][Vite]][Vite-url]
-   [teatype](https://github.com/arsonite/teatype) components and its HSDB (Python) as server

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ABOUT -->

## About

-   **Exercises** with a picture, counted in reps, minutes or meters, with or without weight
-   **Workouts** made of exercises, each line with sets, a rep range, a superset flag and alternatives. The warm-up is its own group of exercise lines (with alternatives), not text
-   **Plans** of up to 7 days. Nothing is scheduled by itself: set a workout on a day, or use "Add a plan" to fill the free days of one week (Monday first)
-   **Shift by drag and drop**: drag a day (⠿ handle, works by touch too) onto another day to move or swap it, or onto the ‹ / › arrows to move it a week. Nothing realigns automatically; days can also be moved a day earlier or later, skipped or removed from the menu
-   **Settings** (device-local): light mode, accent colour, default rest, vibration, keep screen awake, last-week row, sync and clean-up of old auto-planned days
-   **Training log**: reps (or minutes), kg, drop/partial/assisted sets, a comment per exercise (rack spot, seat height ...) and notes per day
-   **Last time on top**: each exercise shows what you did in the last completed session of the same workout, and starts with those values

**Plan mode and train mode**: a session opens in plan mode (edit the workout, fill in values afterwards). "Start training" switches to train mode with a clock that runs from a start time kept on the server (`Session.started_at`, unix ms), so a reload or another device recalculates it. The bar is green while a set runs ("Finish set") and purple in between: the transition, which is measured too, so you can pick any exercise and set freely (▶ on every set, or "Next" for the suggestion, e.g. when the gym is full). "Start rest" is always offered after a set and counts down the default rest. Supersets are framed and labelled A1/B1 ..., done in turns. Finished sets show their transition, set and rest time. Start and end of every set, drop set, partial and rest are stored on the `SetLog` rows (`started_at`, `ended_at`, `rest_started_at`, `rest_ended_at`) for later stats, only the clocks are shown.

**Workout versions**: editing a workout that was trained already does not change the past. It becomes a new version (same `family`), the old one is archived and keeps its sessions; planned sessions and plan days move to the new version. "Last time" and the stats are looked up by family.

**Offline first**: everything is read and written on the device (IndexedDB). Without backend or internet the app keeps working and shows "Offline, N changes kept on this device". As soon as the backend is reachable again it syncs by itself (on open, on reconnect, on focus, and every 15 s while offline), then pushes each change right away. Sync is `@teatype/sync` in `auto` mode; conflicts are last write wins.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting started

```sh
cp .env.template .env
scripts/install
scripts/start all       # server (background) + client (foreground)
scripts/start server    # HSDB server on TICKFIT_PORT
scripts/start client    # Vite on TICKFIT_CLIENT_PORT
```

Run it from the teatype venv, the command comes first (`scripts/start all --detached`). A start first stops the
earlier server/client of this checkout (matched by path), so restarting never leaves a stale process behind.

| Variable             | Meaning                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `TICKFIT_PORT`       | Port of the HSDB server                                              |
| `TICKFIT_CLIENT_PORT`| Port of the Vite client                                              |
| `TICKFIT_BASE_PATH`  | `/` standalone, `/tickfit/` when served inside homepie (shows a back-to-hub link) |
| `TICKFIT_DATA_PATH`  | Where the HSDB data lives, empty for the default                     |

An empty week offers "Add the example plan", the full-body plan of the old spreadsheet. Do not use it after seeding the exercises (see below), it adds its own copies of them.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- IMPORT -->

## Importing old sheets

`scripts/data/` brings the old spreadsheets in. The server has to run. Only `openpyxl` is needed (`pip install -r scripts/data/requirements.txt`), the base URL comes from `TICKFIT_URL` (default `http://127.0.0.1:$TICKFIT_PORT`), and every script has `--dry-run` (writes nothing) and `--url`.

```sh
cd scripts/data
python download_sheets.py <link-or-id> ...      # link-shared Google Sheets -> sheets/*.xlsx (--list, --folder <id> --api-key <key>)
python parse_sheets.py                          # sheets/*.xlsx -> parsed/*.json, one per week (--dump to see the raw cells, --year)
python seed_exercises.py                        # the exercise catalogue: exercises.json plus every exercise found in parsed/
python import_history.py                        # workouts (as versions), sessions, sets, and a plan if there is none
```

`aliases.json` maps names used in the sheets to the names of the catalogue. The import is repeatable: workouts are reused when their lines match, a changed workout becomes a new version, and a date that has a session already is skipped. The parser was written against the empty template, so expect to adjust it (and `aliases.json`) on the first real files; `parse_sheets.py --dump` shows what it reads. Any other source (e.g. a PDF reader) can write the same week JSON into `parsed/`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MIGRATIONS -->

## Migrations

Changes of the models in `server/models` are applied to existing data by the files in `migrations/`, named `<number>_<name>.py`, each with one `HSDBMigration` subclass. They run on server start, once each. Set `HSDB_MIGRATIONS_COLD_MODE=true` to try them without writing anything. See the HSDB README of teatype for the hooks.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->

## License

Distributed under GPL-3 license. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

Project Link: [https://github.com/arsonite/tickfit](https://github.com/arsonite/tickfit)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->

[product-screenshot]: images/screenshot.png
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[TypeScript]: https://img.shields.io/badge/TypeScript-20232A?style=for-the-badge&logo=typescript&logoColor=3178C6
[TypeScript-url]: https://www.typescriptlang.org/
[Vite]: https://img.shields.io/badge/Vite-20232A?style=for-the-badge&logo=vite&logoColor=646CFF
[Vite-url]: https://vitejs.dev/
