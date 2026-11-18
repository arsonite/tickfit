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
-   **Workouts** made of exercises, each line with sets, a rep range, a superset flag and alternatives
-   **Plans** of days that repeat; the calendar weeks fill themselves from the active plan
-   **Missed days realign**: an unfinished workout from the past moves to today, the following days make room. Rest days are dropped
-   **Shift by hand**: a day earlier or later, push or pull all following days, skip, remove
-   **Training log**: reps (or minutes), kg, drop/partial/assisted sets, a comment per exercise (rack spot, seat height ...) and notes per day
-   **Last time on top**: each exercise shows what you did in the last completed session of the same workout, and starts with those values

**Offline first**: everything is read and written on the device (IndexedDB). Without backend or internet the app keeps working and shows "Offline, N changes kept on this device". As soon as the backend is reachable again it syncs by itself (on open, on reconnect, on focus, and every 15 s while offline), then pushes each change right away. Sync is `@teatype/sync` in `auto` mode; conflicts are last write wins.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting started

```sh
cp .env.template .env
scripts/install
scripts/launch-server   # HSDB server on TICKFIT_PORT
scripts/launch-client   # Vite on TICKFIT_CLIENT_PORT
```

| Variable             | Meaning                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `TICKFIT_PORT`       | Port of the HSDB server                                              |
| `TICKFIT_CLIENT_PORT`| Port of the Vite client                                              |
| `TICKFIT_BASE_PATH`  | `/` standalone, `/tickfit/` when served inside homepie (shows a back-to-hub link) |
| `TICKFIT_DATA_PATH`  | Where the HSDB data lives, empty for the default                     |

An empty week offers "Add the example plan", the full-body plan of the old spreadsheet.

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
