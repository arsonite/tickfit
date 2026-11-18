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

-   **Exercises** with a picture, a free **type** (pull, push, legs ..., typed in and filterable), counted in with chips: **reps**, **minutes**, **seconds**, **meters**, **kilometers**, plus **weight** (kg) as a checkbox. Minutes and seconds exclude each other, so do meters and kilometers; reps, minutes and meters share the one value of a set, so only one of those is on. Time is filled in with the recorded set time when the set is finished, editable. **Select** mode picks several exercises for edit, archive, unarchive or delete at once
-   **Workouts** made of exercises, each line with sets, a rep range, a superset flag and alternatives. The warm-up is its own group of exercise lines (with alternatives), not text
-   **Plans** of up to 7 days. Several plans can be **active**, one of them is the **default** (offered first); only active plans can be added to a week. Nothing is scheduled by itself: set a workout on a day, or use "Add a plan" to fill the free days of one week (Monday first), or "Fill with rest days" to put a rest day on every free day of the week. The week header says **Plan: <name>** while the week is exactly that plan (rest days aside) and **Custom** as soon as days were added, changed or moved by hand
-   **Shift by drag and drop**: drag a day (⠿ handle, works by touch too) onto another day to move or swap it, or onto the ‹ / › arrows to move it a week. Nothing realigns automatically; days can also be skipped or removed from the menu
-   **Dates** show as `dd.mm.yyyy` (stored as `YYYY-MM-DD`). Day cards have the info on the left and the status icon (done, rest, skipped, still to come; none on today, the green border is enough) centred in a box of its own on the right
-   **Settings** (device-local): light mode, accent colour, default rest, start the next set when the rest is over (on by default; the rest counts down and the next set of the exercise starts by itself, off: it counts up until you start it), vibration, keep screen awake, last-week row, **hide the sidebar** (no rail; a swipe from the left edge to the right brings it in as a sheet), sync, **clear local data** (deletes the device copy and fetches everything from the server again; unsent changes are sent first) and clean-up of old auto-planned days
-   **Backup, export, import** (Settings → Data): *Full backup* downloads one `tickfit-backup` JSON file with every table and the device settings; *Restore* replaces everything here with such a file (the sync then makes the server match). *Export* gives exercises, workouts and plans (with the exercises they use), the training log (JSON, or CSV with one line per finished set) or the settings. *Import* adds what is not here yet (same id is skipped, an exercise with an existing name is not added twice, rows pointing to missing rows are dropped).
-   **Training log**: reps (or minutes), kg, drop/partial/assisted sets, a comment per exercise (rack spot, seat height ...) and notes per day
-   **Last trained**: each exercise shows, per set, what you did the last time *that exercise* was trained (any workout, plan or version, matched set by set) as a read-only row. Only the kg is prefilled (editable); reps stay empty. The ⤓ button next to a kg field applies it to all sets below that are not done yet, "Take over kg" (only for exercises that were trained with weight) fills the kg of the last time into all sets that are not done. Reps, kg, set type and the comment can always be corrected, also after a set or an exercise is done (and reps entered after the rest). Skip and remove are locked on a done set until it is undone, and so are the alternatives once every set of the exercise is done
-   **Statistics**: week by week (sessions, sets, reps, volume, time, change to the week before), PRs per exercise (heaviest, set volume, estimated 1RM, longest) with a feed of the last 30 days, per exercise (progression chart) and per plan. Per-plan numbers come from the workouts of the plan, so a workout in several plans counts for each

-   **Pictures are files, not data**: `Exercise.image` is an `HSDBRawFile(image_png, ...)` field (typed like `HSDBAttribute`: `image_jpeg`, `image_png`, `pdf`, `bytes`, ...; HSDB checks the bytes really are that type). The picture is sent inside the exercise (`{type, data}` or a data URL, a picture chosen offline stays on the device until the sync), HSDB stores it as `rawfiles/image/<sha256>.<ext>` and the exercise keeps that path, loaded from `/hsdb/rawfiles/...`. Backups and exports embed the pictures again so they restore anywhere
-   **Phone**: zoom (pinch, double tap) and the swipe back of Safari are locked (`lockGestures` of `@teatype/toolkit`, same in lockkliye), inputs are 16 px on touch screens so iOS does not zoom on focus, safe areas are respected, toasts confirm saves, deletes and moves

**Plan mode and train mode**: a session opens in plan mode (edit the workout, fill in values afterwards). "Start training" switches to train mode with a clock that runs from a start time kept on the server (`Session.started_at`, unix ms), so a reload or another device recalculates it. The bar is green while a set runs ("Finish set"). Finishing a set of a single exercise starts the rest by itself and shows the next set (dashed bar); in a superset the next exercise of the round starts right away, with no time in between, and the rest starts after the last one of the round. When an exercise is done nothing is suggested: the bar says "Pick the next exercise" and you start any set in the list (▶), e.g. when the gym is full; "Start rest" is still offered. Supersets are framed and labelled A1/B1 ..., done in turns. Finished sets show their set and rest time. Start and end of every set, drop set, partial and rest are stored on the `SetLog` rows (`started_at`, `ended_at`, `rest_started_at`, `rest_ended_at`) for later stats, only the clocks are shown.

**Workout versions**: editing a workout that was trained already does not change the past. It becomes a new version (same `family`), the old one is archived and keeps its sessions; planned sessions and plan days move to the new version. Archived workouts (old versions and imports) are listed under **Archived** in Workouts: read-only, with Unarchive and Duplicate. Any live workout can be archived by hand too (**Archive**); it can not be picked for new days then. Exercises and plans can be archived the same way (Archived section, read-only until unarchived): an archived exercise is not offered for new workout lines, an archived plan is not active and can not be added to a week; both stay in the stats and in what already uses them (migration `0005_archived`). "Last trained" is looked up by exercise, and the stats by family.

**Duplicate plans**: a sync bug could push a row twice when the server dropped a column it did not know (fixed in `@teatype/sync`). Plans page → **Remove N duplicates** deletes the copies (same name, days and state) and keeps the oldest.

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

`scripts/data/` brings the old spreadsheets in (the folders `2025/` and `2026/` of one workbook per week). The server has to run. The base URL comes from `TICKFIT_URL` (default `http://127.0.0.1:$TICKFIT_PORT`), and every script has `--dry-run` (writes nothing) and `--url`. `parse_sheets.py` needs `openpyxl` (`pip install -r scripts/data/requirements.txt`, or `pip install --target <dir> openpyxl` and `PYTHONPATH=<dir>` if the venv is not yours to change).

```sh
cd scripts/data
python download_sheets.py <link-or-id> ...      # link-shared Google Sheets -> sheets/*.xlsx (--list, --folder <id> --api-key <key>)
python parse_sheets.py ~/2025 ~/2026            # xlsx files or folders -> parsed/*.json, one per week (--dump to see the raw cells, --out, --year)
python seed_exercises.py                        # the exercise catalogue: exercises.json plus every exercise found in parsed/
python import_history.py                        # workouts, sessions, sets and plans, see below
```

`aliases.json` maps names used in the sheets to the names of the catalogue; `exercises.json` is the catalogue (category, unit, weighted, timed, distanced, picture). Both seeding and import check by name first and only create what is missing, so existing exercises, workouts, plans and sessions stay untouched and every script can be run again.

What the import creates:

-   **Workouts** are reused when their lines match, a changed one becomes a new version of the family. All imported ones are **archived**, so the live workouts and the active plan stay as they are. Warm-ups become exercise lines
-   **Plans**: one **inactive** plan per set of workouts that was trained for some weeks, named `<label> (KW<week> <year>)` and laid out like its fullest week. A plan whose label or name exists is not created again (this protects the active one)
-   **Sessions and sets**: a day counts when sets have reps (or an X). The sheets paste last week's weights into the new week, so weight-only or 0-rep sets are not training. A date that has a session is skipped

The parser warns about sheets it had to place on another day (a sheet whose name matches no day of the week) and skips non-workout sheets (`AUX`). Check the warnings and `--dry-run` before the real run, any other source (e.g. a PDF reader) can write the same week JSON into `parsed/`.

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
