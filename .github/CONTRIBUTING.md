# Contributing to Leaflet.markercluster

## Questions

The issue tracker is for bugs and feature requests. If you need help using the plugin, ask in [Leaflet discussions](https://github.com/Leaflet/Leaflet/discussions) or on [GIS Stack Exchange](https://gis.stackexchange.com/questions/tagged/leaflet).

## Reporting bugs

First, make sure the bug comes from Leaflet.markercluster and not from your app code or another plugin, and [search the issues](https://github.com/Leaflet/Leaflet.markercluster/issues) to see if it's already been reported. If it has, add any new details there.

When you [open an issue](https://github.com/Leaflet/Leaflet.markercluster/issues/new/choose), include:

- A **specific title**. Bad: "Problem with spiderfy". Good: "Spiderfied markers stay open after `removeLayer` on Leaflet 2.0".
- The **Leaflet and Leaflet.markercluster versions**, and the browser and OS.
- A **minimal example** on CodePen, JSFiddle or a similar site, with no code that isn't needed to show the bug. The CDN setup from the [README](../README.md#getting-started) is an easy starting point.
- Whether it happens on the latest release, `main`, or both. If it only happens on `main`, `git bisect` can find the commit that broke it.

## Pull requests

Bug fixes, performance improvements and small features that don't add much code are the easiest to merge. For anything bigger, open an issue first so we can agree on the approach before you write it. If a feature can work as a separate plugin, it's often better as one.

Before you send a pull request:

- Add a test that fails without your change, in `test/`.
- Run `npm test`. It must pass on both Leaflet 2.0 and 1.9.
- If you touched clustering, adding, removing or zooming, run `npm run bench` before and after your change and put the numbers in the pull request.
- If you changed the public API, update the README and the types in `src/`.

## Development

```sh
npm install
npx playwright install chromium
```

- `npm test` runs the linter, the type checks and the tests in headless Chromium, on both Leaflet 2.0 and 1.9.
- `npx vitest test/spiderfy.test.js --project "leaflet 2"` runs one file on one Leaflet version in watch mode.
- `npm run build` builds `dist/`.
- `npm run bench` benchmarks loading, zooming and memory use. Its options are listed at the top of `bench/run.js`.

The demos in `example/` load `src/` directly, so they work from any static server in the repo root (for example `npx serve`). The global script demo needs `npm run build` first.
