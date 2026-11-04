# Leaflet.markercluster

(all changes in 2.0.0-beta.1 without author notice are by [@mourner](https://github.com/mourner))

## 2.0.0-beta.1 (2026-11-04)

The first beta of 2.0 and the first release since 2021: a full modernization of the plugin. It now works with both **Leaflet 2.0 and 1.9** from one package, is an **ES module** with its own **TypeScript types**, and uses only public Leaflet APIs where possible. Loading markers is **2× faster** with **over a third less memory**, cluster animations are smoother and no longer depend on CSS, clusters are **accessible** to keyboard and screen reader users, and over 20 bugs are fixed.

The release targets [Baseline 2022](https://web.dev/baseline) browsers and Leaflet 1.9+. Breaking changes are listed after the improvements. Install it with `npm install leaflet.markercluster@next`, and please report any problems in [#1115](https://github.com/Leaflet/Leaflet.markercluster/issues/1115).

### ❇️ New features

- Support Leaflet 2.0 alongside 1.9, from the same package and builds ([#1115](https://github.com/Leaflet/Leaflet.markercluster/issues/1115))
- Ship as an ES module: `import {MarkerClusterGroup} from 'leaflet.markercluster'` ([#874](https://github.com/Leaflet/Leaflet.markercluster/issues/874))
- Add TypeScript types, generated from the source and checked in strict mode, with typed options and cluster events. Groups are generic over the member type, e.g. `MarkerClusterGroup<CircleMarker>` ([#982](https://github.com/Leaflet/Leaflet.markercluster/issues/982))
- Animate clusters with the Web Animations API instead of CSS transitions. Markers stay at their real position during animations (no more `move` events or temporary latlngs), a new zoom cancels running animations cleanly, and spider legs draw out and fade in again (broken since Leaflet 1.0)
- Add the `animationDuration` option (default 300 ms) for all cluster and spider animations
- Add `getParent(layer)` to get the cluster a marker (or cluster) is directly in, replacing `marker.__parent`
- Let `clusterclick` handlers cancel the default zoom or spiderfy with `e.originalEvent.preventDefault()` ([#1103](https://github.com/Leaflet/Leaflet.markercluster/pull/1103) by [@eriknikulski](https://github.com/eriknikulski))
- Ship minified builds with source maps ([#864](https://github.com/Leaflet/Leaflet.markercluster/issues/864))

### ⚡️ Performance

- Add markers about 2× faster: `addLayers` of 200k markers takes 415 ms instead of 900 ms, 50k 72 ms instead of 172 ms, and adding a filled group to the map gets the same speedup
- Make `addLayers` before the group is on the map (the common "add everything, then add the group" pattern) no longer quadratic: adding 200k markers and then the group takes 0.4 s instead of 21 s (thanks to [@pmarrapese](https://github.com/pmarrapese) for spotting it in [#988](https://github.com/Leaflet/Leaflet.markercluster/pull/988))
- Use about 38% less memory per marker (600 → 370 bytes at 200k), with one listener per marker instead of three and no extra properties on markers
- Zoom in about 4× faster on large groups (230 → 60 ms over 12 zoom levels with 200k markers)
- Fix quadratic adding and removing when the map has a high `minZoom`: removing half of 200k scattered markers at `minZoom: 10` takes 0.4 s instead of 23 s
- Make `clearLayers` up to 40% faster, and skip `layeradd`/`layerremove` events in bulk calls when nobody listens
- Avoid forced layouts during cluster animations

### ⚠️ Breaking changes

- Require Leaflet 1.9 or 2.0 and a Baseline 2022 browser. Internet Explorer and the old-browser CSS fallbacks are gone
- The package entry is now an ES module that exports `MarkerClusterGroup` and `MarkerCluster`, and no longer sets `L.MarkerClusterGroup`, `L.markerClusterGroup` or other globals. Use `new MarkerClusterGroup(options)`
- `dist/leaflet.markercluster.js` is now the ES module build. For a plain `<script>` tag, use `dist/leaflet.markercluster-global.js`, which sets `L.MarkerClusterGroup` and `L.MarkerCluster` (and `L.markerClusterGroup` on Leaflet 1.x). The `-src` build and the `window.Leaflet.markercluster` global are gone
- Remove `MarkerCluster.css`, since animations no longer use CSS: drop its import or `<link>` (keep `MarkerCluster.Default.css`). CSS overrides of `.leaflet-cluster-anim .leaflet-marker-icon` transitions no longer affect the animations; use `animationDuration`
- Remove `marker.__parent` and the other properties the plugin set on markers (`_spiderLeg`, `_preSpiderfyLatlng`, `_backupLatlng`, `__dragStart`). Use `group.getParent(marker)` or `group.getVisibleParent(marker)` instead
- `DistanceGrid`, `QuickHull` and `MarkerClusterNonAnimated` are no longer public
- Keep a marker in one group at a time: adding it to another group removes it from the first. Before, this broke both groups and threw ([#1051](https://github.com/Leaflet/Leaflet.markercluster/issues/1051), [#1048](https://github.com/Leaflet/Leaflet.markercluster/pull/1048))
- On Leaflet 2.0, subclass with `class extends MarkerClusterGroup` (`extend()` and `initialize()` still work on 1.9), and Enter or Space on a cluster fire `clusterclick` instead of `clusterkeypress`
- `getLayer(id)` returns `undefined` for an unknown id like `LayerGroup` (was `null`), `getVisibleParent` returns a visible `CircleMarker` itself instead of its cluster, and `MarkerCluster.unspiderfy()` no longer takes arguments

### ♿️ Accessibility

- Give clusters an accessible name ("12 markers") on the focusable icon, also for custom icons, with the new `clusterLabel` option for translation ([#1107](https://github.com/Leaflet/Leaflet.markercluster/issues/1107), thanks to [@tmiaa](https://github.com/tmiaa) for [#1044](https://github.com/Leaflet/Leaflet.markercluster/pull/1044))
- Make spiderfy a proper disclosure: clusters get `aria-expanded`, spiderfied markers come right after their cluster in the tab order, and activating a spiderfied cluster again (by keyboard or mouse) closes it
- Close the spider with Escape, moving focus back to the cluster if it was on one of its markers. On Leaflet 1.9 and 2.0.0-beta.1, a Leaflet bug blocks this once any popup has been opened; it's fixed in 2.0.0-beta.2
- Keep focus where it is after activating a cluster with the keyboard, and move it to the map instead of the page when a focused cluster disappears on zoom
- Show the coverage polygon on keyboard focus, not just on hover
- Respect `prefers-reduced-motion`: markers and spider legs fade in place instead of moving

### 🐞 Bug fixes

- Fix markers disappearing after the map's zoom range changes, e.g. when switching to a base layer with a different `maxZoom` ([#869](https://github.com/Leaflet/Leaflet.markercluster/issues/869))
- Fix a dragged marker being clustered and vanishing when the map zooms mid-drag. It now leaves its clusters during the drag and rejoins on drop ([#808](https://github.com/Leaflet/Leaflet.markercluster/issues/808))
- Fix a dragged spiderfied marker snapping back to the cluster on drop
- Fix `clearLayers` during chunked `addLayers` not stopping the rest of the chunks ([#816](https://github.com/Leaflet/Leaflet.markercluster/pull/816) by [@frenomus](https://github.com/frenomus))
- Fix an error when the group is removed from the map during chunked loading; the remaining markers are now added when it's added back
- Fix unclustered markers never showing with a fractional map `minZoom`
- Fix markers flying off when zooming in on a spiderfied cluster
- Fix stale markers left on the map after an animated zoom out (thanks to [@KristjanESPERANTO](https://github.com/KristjanESPERANTO))
- Fix a removed spiderfied marker staying at its spider position if removed during a zoom
- Fix moving a marker after `removeLayers` adding it back to the group
- Fix `removeLayer` of a marker from another group breaking that group's clusters
- Fix removals while the group is off the map: `getBounds()` included removed markers, a marker removed and added back disappeared from `getLayers()`, and `clearLayers()` kept old markers
- Fix `addLayer` of the same marker twice before the group is on the map adding it twice
- Fix `getBounds()` returning the old bounds after removing all markers
- Fix `addLayers` not firing `layeradd` while the group is off the map
- Fix `removeLayer(id)` for clustered markers
- Fix `animateAddingMarkers` and `refreshClusters` throwing or misbehaving with a `CircleMarker`
- Fix a hang when the map has no finite `minZoom`; it throws an error now ([#991](https://github.com/Leaflet/Leaflet.markercluster/pull/991) by [@maranderan](https://github.com/maranderan))

### 🔧 Workflow

- Run tests with Vitest in the browser on both Leaflet 1.9 and 2.0 instead of Karma and PhantomJS, with many more specs
- Build with Rolldown, lint with ESLint against Baseline 2022, and run CI and npm releases on GitHub Actions
- Add a benchmark harness for loading, zooming and memory (`npm run bench`)
- Update the demos to ES modules and Leaflet 2.0, and use the preferred OpenStreetMap tile URL ([#1072](https://github.com/Leaflet/Leaflet.markercluster/pull/1072) by [@Firefishy](https://github.com/Firefishy))

## 1.5.3 (2021-10-18)

### Bugfixes

- Removing unnecessary files on npm package
- Inlucding correct versioning on Github repo

## 1.5.2 (2021-10-18)

### Improvements

- Merged PR [1022](https://github.com/Leaflet/Leaflet.markercluster/pull/1022) for Spiderfy on every room by [MasterEric](https://github.com/MasterEric)

### Bugfixes

- Fixed issue [907](https://github.com/Leaflet/Leaflet.markercluster/issues/907) and [967](https://github.com/Leaflet/Leaflet.markercluster/issues/967) with PR [1027](https://github.com/Leaflet/Leaflet.markercluster/pull/1027) from [DerGuteWolf](https://github.com/DerGuteWolf)
- Removed unexpected dependencies in previous npm package

## 1.5.1 (2021-08-28)

### Improvements

- Spiderfy on keypress [1005](https://github.com/Leaflet/Leaflet.markercluster/pull/1005) by [@neorth](https://github.com/neorth), a fix for issue [940](https://github.com/Leaflet/Leaflet.markercluster/issues/940) and [947](https://github.com/Leaflet/Leaflet.markercluster/issues/947)

## 1.5.0 (2021-03-12)

### Bugfixes

- Updated peer dependency to match latest leaflet version (by [@sanjpareek](https://github.com/sanjpareek)) [#976](https://github.com/Leaflet/Leaflet.markercluster/pull/976)

(all changes below without author notice were made by [@danzel](https://github.com/danzel))

## 1.4.1 (2018-09-14)

### Bugfixes

- Better support stopping dragged markers from being clustered (by [@DerGuteWolf](https://github.com/DerGuteWolf)) [#909](https://github.com/Leaflet/Leaflet.markercluster/pull/909)

## 1.4.0 (2018-08-22)

Required leaflet version bumped to 1.3.1

### Improvements

- Tests run against leaflet 1.1.0+ [#863](https://github.com/Leaflet/Leaflet.markercluster/issues/863)

### Bugfixes

- Fix clearLayers not removing removed markers [#860](https://github.com/Leaflet/Leaflet.markercluster/issues/860)
- Remember opacity 0 correctly (by [@r-yanyo](https://github.com/r-yanyo)) [#890](https://github.com/Leaflet/Leaflet.markercluster/pull/890)
- Fix chunkedLoading LatLngBounds.intersects() (by [@boldtrn](https://github.com/boldtrn)) [#743](https://github.com/Leaflet/Leaflet.markercluster/issues/743) [#891](https://github.com/Leaflet/Leaflet.markercluster/pull/891)

## 1.3.0 (2018-01-19)

### Improvements

- Use Rollup for builds (by [@IvanSanchez](https://github.com/IvanSanchez)) [#769](https://github.com/Leaflet/Leaflet.markercluster/pull/769)

### Bugfixes

- Fix Spiderfier positioning for small markers (by [@ghybs](https://github.com/ghybs)) [#846](https://github.com/Leaflet/Leaflet.markercluster/pull/846)
- Fix anchor usage with latest leaflet version [#861](https://github.com/Leaflet/Leaflet.markercluster/issues/861)

## 1.2.0 (2017-11-06)

### Improvements

- Move `clusterPane` option in to `options` field (by [@ghybs](https://github.com/ghybs)) [#832](https://github.com/Leaflet/Leaflet.markercluster/pull/832)

### Bugfixes

- Fix very small `maxClusterRadius` hanging the browser (by [@lucaswerkmeister](https://github.com/lucaswerkmeister)) [#838](https://github.com/Leaflet/Leaflet.markercluster/pull/838)

## 1.1.0 (2017-08-27)

### Improvements

- Add `clusterPane` option to allow putting clusters in a different pane (by [@ckrahe](https://github.com/ckrahe)) [#819](https://github.com/Leaflet/Leaflet.markercluster/issues/819)

## 1.0.6 (2017-06-19)

### Bugfixes

- Fix some issues when used with non-integer zoom [#789](https://github.com/Leaflet/Leaflet.markercluster/issues/789)
- Change examples to use https (by [@ghybs](https://github.com/ghybs)) [#794](https://github.com/Leaflet/Leaflet.markercluster/pull/794)

## 1.0.5 (2017-04-26)

### Improvements

- Allow passing fitBounds options to zoomToBounds (by [@timkelty](https://github.com/timkelty)) [#779](https://github.com/Leaflet/Leaflet.markercluster/pull/779)

### Bugfixes

- Fixed bug where disableClusteringAtZoom being 0 is treated the same as null (by [@MrCheeze](https://github.com/MrCheeze)) [#773](https://github.com/Leaflet/Leaflet.markercluster/pull/773)

## 1.0.4 (2017-03-14)

### Bugfixes

- Fix errors removing a MarkerClusterGroup from the map during an animation [#758](https://github.com/Leaflet/Leaflet.markercluster/issues/758)

## 1.0.3 (2017-02-02)

### Bugfixes

- Fix moving markers while the MarkerClusterGroup is not on the map [#753](https://github.com/Leaflet/Leaflet.markercluster/issues/753)

## 1.0.2 (2017-01-27)

### Improvements

- Support `layeradd` and `layerremove` events [#647](https://github.com/Leaflet/Leaflet.markercluster/issues/647)

### Bugfixes

- Add support for maps with negative minZoom [#704](https://github.com/Leaflet/Leaflet.markercluster/issues/704)
- Fixed zoomToShowLayer() markers disappearing bug (by [@z3ut](https://github.com/z3ut)) [#739](https://github.com/Leaflet/Leaflet.markercluster/issues/739)
- Fix an issue when opening a popup inside of zoomToShowLayer
- If a marker is moved with an open popup on it, re-open the popup after moving it. [#651](https://github.com/Leaflet/Leaflet.markercluster/issues/651)

## 1.0.1 (2017-01-25)

### Improvements

- Add install and build steps with jake (by [@kazes](https://github.com/kazes)) [#733](https://github.com/Leaflet/Leaflet.markercluster/pull/733)
- Readme improvements (by [@ghybs](https://github.com/ghybs), [@bertyhell](https://github.com/bertyhell)) [#734](https://github.com/Leaflet/Leaflet.markercluster/pull/738), [#734](https://github.com/Leaflet/Leaflet.markercluster/pull/738
- Bump all examples to leaflet 1.0.3

### Bugfixes

- Fixed leaflet 1.0.2 bug where clearLayers would throw an exception (by [@marcianoviereck92](https://github.com/marcianoviereck92)) [#746](https://github.com/Leaflet/Leaflet.markercluster/pull/746)

## 1.0.0 (2016-10-03)

### Improvements

- Compatibility with Leaflet 1.0.0 (by [@danzel](https://github.com/danzel), [@Eschon](https://github.com/Eschon), [@ghybs](https://github.com/ghybs), [@IvanSanchez](https://github.com/IvanSanchez))
- Support moving markers [#57](https://github.com/Leaflet/Leaflet.markercluster/issues/57)
- chunkedLoading option to keep browser more responsive during larging a load data set [#292](https://github.com/Leaflet/Leaflet.markercluster/issues/292)
- maxClusterRadius can be a function (by [@Schwanksta](https://github.com/Schwanksta)) [#298](https://github.com/Leaflet/Leaflet.markercluster/issues/298)
- Spiderfy without zooming when all markers at same location (by [@rdenniston](https://github.com/rdenniston), [@ghybs](https://github.com/ghybs)) [#415](https://github.com/Leaflet/Leaflet.markercluster/issues/415), [#606](https://github.com/Leaflet/Leaflet.markercluster/issues/606)
- On becoming visible, markers retain their original opacity. (by [@IvanSanchez](https://github.com/IvanSanchez)) [#444](https://github.com/Leaflet/Leaflet.markercluster/issues/444)
- Spiderleg Polyline options (by [@mikeatlas](https://github.com/mikeatlas)) [#466](https://github.com/Leaflet/Leaflet.markercluster/issues/466)
- Extra methods to allow refreshing cluster icons (by [@ghybs](https://github.com/ghybs)) [#564](https://github.com/Leaflet/Leaflet.markercluster/issues/564)
- Ability to disable animations (by [@ghybs](https://github.com/ghybs)) [#578](https://github.com/Leaflet/Leaflet.markercluster/issues/578)
- Optimized performance of bulk addLayers and removeLayers (by [@ghybs](https://github.com/ghybs)) [#584](https://github.com/Leaflet/Leaflet.markercluster/issues/584)
- Replaced spiderfy legs animation from SMIL to CSS transition (by [@ghybs](https://github.com/ghybs)) [#585](https://github.com/Leaflet/Leaflet.markercluster/issues/585)
- Provide more detailed context information on the spiderfied event (by [@evanvosberg](https://github.com/evanvosberg)) [#421](https://github.com/Leaflet/Leaflet.markercluster/issues/421)
- Add unspiderfied event
- Readme updates (by [@ghybs](https://github.com/ghybs), [@tomchadwin](https://github.com/tomchadwin) [@Cyrille37](https://github.com/Cyrille37) [@franckl](https://github.com/franckl) [@mikeatlas](https://github.com/mikeatlas)
  [@rdenniston](https://github.com/rdenniston) [@maackle](https://github.com/maackle) [@fureigh](https://github.com/fureigh) [@Wildhoney](https://github.com/Wildhoney) [@Schwanksta](https://github.com/Schwanksta) [@frankrowe](https://github.com/frankrowe))
- Improve adding and removing nested LayerGroups (by [@ghybs](https://github.com/ghybs)) [#624](https://github.com/Leaflet/Leaflet.markercluster/pull/624)
- Add public unspiderfy method (by [@zverev](https://github.com/zverev)) [#617](https://github.com/Leaflet/Leaflet.markercluster/pull/617)
- Optimized performance of bulk add with complex icon create function (by [@mlazowik](https://github.com/mlazowik)) [#697](https://github.com/Leaflet/Leaflet.markercluster/pull/697)
- Remove leaflet from peerDependencies (by [@tyleralves](https://github.com/tyleralves)) [#703](https://github.com/Leaflet/Leaflet.markercluster/pull/703)
- Simplified \_recursively (by [@ghybs](https://github.com/ghybs)) [#656](https://github.com/Leaflet/Leaflet.markercluster/pull/656)

### Bugfixes

- Fix getBounds when removeOutsideVisibleBounds: false is set. [#321](https://github.com/Leaflet/Leaflet.markercluster/issues/321)
- Fix zoomToShowLayer fails after initial spiderfy [#286](https://github.com/Leaflet/Leaflet.markercluster/issues/286)
- Fix cluster not disappearing on Android [#344](https://github.com/Leaflet/Leaflet.markercluster/issues/344)
- Fix RemoveLayers() when spiderified (by [@Grsmto](https://github.com/Grsmto)) [#358](https://github.com/Leaflet/Leaflet.markercluster/issues/358)
- Remove lines from map when removing cluster (by [@olive380](https://github.com/olive380)) [#532](https://github.com/Leaflet/Leaflet.markercluster/issues/532)
- Fix getConvexHull when all markers are located at same latitude (by [@olive380](https://github.com/olive380)) [#533](https://github.com/Leaflet/Leaflet.markercluster/issues/533)
- Fix removeLayers when cluster is not on the map (by [@eschon](https://github.com/eschon)) [#556](https://github.com/Leaflet/Leaflet.markercluster/issues/556)
- Improved zoomToShowLayer with callback check (by [@ghybs](https://github.com/ghybs)) [#572](https://github.com/Leaflet/Leaflet.markercluster/issues/572)
- Improved reliability of RefreshSpec test suite for PhantomJS (by [@ghybs](https://github.com/ghybs)) [#577](https://github.com/Leaflet/Leaflet.markercluster/issues/577)
- Corrected effect of removeOutsideVisibleBounds option (by [@ghybs](https://github.com/ghybs)) [#575](https://github.com/Leaflet/Leaflet.markercluster/issues/575)
- Fix getLayer when provided a string [#531](https://github.com/Leaflet/Leaflet.markercluster/issues/531)
- Documentation improvements (by [@ghybs](https://github.com/ghybs)) [#579](https://github.com/Leaflet/Leaflet.markercluster/issues/579)
- Correct \_getExpandedVisibleBounds for Max Latitude (by [@ghybs](https://github.com/ghybs)) [#587](https://github.com/Leaflet/Leaflet.markercluster/issues/587)
- Correct unspiderfy vector (by [@ghybs](https://github.com/ghybs)) [#604](https://github.com/Leaflet/Leaflet.markercluster/issues/604)
- Remove "leaflet-cluster-anim" class on map remove while spiderfied (by [@ghybs](https://github.com/ghybs)) [#607](https://github.com/Leaflet/Leaflet.markercluster/issues/607)
- Fix disableClusteringAtZoom maxZoom troubles (by [@OriginalSin](https://github.com/OriginalSin)) [#609](https://github.com/Leaflet/Leaflet.markercluster/issues/609)
- Fix clusters not disappearing when they were near the edge on mobile (by [@ghybs](https://github.com/ghybs)) [#529](https://github.com/Leaflet/Leaflet.markercluster/issues/529)
- Remove leaflet from dependencies (by [@ghybs](https://github.com/ghybs)) [#639](https://github.com/Leaflet/Leaflet.markercluster/issues/639)
- Fix interaction between zoomOrSpiderfy and disableClusteringAtZoom (by [@ghybs](https://github.com/ghybs)) [#633](https://github.com/Leaflet/Leaflet.markercluster/issues/633) [#648](https://github.com/Leaflet/Leaflet.markercluster/issues/648)

## 0.4 (2013-12-19)

### Improvements

- Fix Quick Zoom in/out causing everything to disappear in Firefox (Reported by [@paulovieira](https://github.com/paulovieira)) [#140](https://github.com/Leaflet/Leaflet.markercluster/issues/140)
- Slow the expand/contract animation down from 200ms to 300ms

### Bugfixes

- Fix some cases zoomToShowLayer wouldn't work (Reported by [@absemetov](https://github.com/absemetov)) [#203](https://github.com/Leaflet/Leaflet.markercluster/issues/203) [#228](https://github.com/Leaflet/Leaflet.markercluster/issues/228) [#286](https://github.com/Leaflet/Leaflet.markercluster/issues/286)

## 0.3 (2013-12-18)

### Improvements

- Work better with custom projections (by [@andersarstrand](https://github.com/andersarstrand)) [#74](https://github.com/Leaflet/Leaflet.markercluster/issues/74)
- Add custom getBounds that works (Reported by [@2803media](https://github.com/2803media))
- Allow spacing spiderfied icons further apart (Reported by [@stevevance](https://github.com/stevevance)) [#100](https://github.com/Leaflet/Leaflet.markercluster/issues/100)
- Add custom eachLayer that works (Reported by [@cilogi](https://github.com/cilogi)) [#102](https://github.com/Leaflet/Leaflet.markercluster/issues/102)
- Add an option (removeOutsideVisibleBounds) to prevent removing clusters that are outside of the visible bounds (by [@wildhoney](https://github.com/wildhoney)) [#103](https://github.com/Leaflet/Leaflet.markercluster/issues/103)
- Add getBounds method to cluster (Reported by [@nderambure](https://github.com/nderambure)) [#88](https://github.com/Leaflet/Leaflet.markercluster/issues/88)
- Lots of unit tests
- Support having Circle / CircleMarker as child markers
- Add factory methods (Reported by [@mourner](https://github.com/mourner)) [#21](https://github.com/Leaflet/Leaflet.markercluster/issues/21)
- Add getVisibleParent method to allow getting the visible parent cluster or the marker if it is visible. (By [@littleiffel](https://github.com/littleiffel)) [#102](https://github.com/Leaflet/Leaflet.markercluster/issues/102)
- Allow adding non-clusterable things to a MarkerClusterGroup, we don't cluster them. (Reported by [@benbalter](https://github.com/benbalter)) [#195](https://github.com/Leaflet/Leaflet.markercluster/issues/195)
- removeLayer supports taking a FeatureGroup (Reported by [@pabloalcaraz](https://github.com/pabloalcaraz)) [#236](https://github.com/Leaflet/Leaflet.markercluster/issues/236)
- DistanceGrid tests, QuickHull tests and improvements (By [@tmcw](https://github.com/tmcw)) [#247](https://github.com/Leaflet/Leaflet.markercluster/issues/247) [#248](https://github.com/Leaflet/Leaflet.markercluster/issues/248) [#249](https://github.com/Leaflet/Leaflet.markercluster/issues/249)
- Implemented getLayers (Reported by [@metajungle](https://github.com/metajungle)) [#222](https://github.com/Leaflet/Leaflet.markercluster/issues/222)
- zoomToBounds now only zooms in as far as it needs to to get all of the markers on screen if this is less zoom than zooming to the actual bounds would be (Reported by [@adamyonk](https://github.com/adamyonk)) [#185](https://github.com/Leaflet/Leaflet.markercluster/issues/185)
- Keyboard accessibility improvements (By [@Zombienaute](https://github.com/Zombienaute)) [#273](https://github.com/Leaflet/Leaflet.markercluster/issues/273)
- IE Specific css in the default styles is no longer a separate file (By [@frankrowe](https://github.com/frankrowe)) [#280](https://github.com/Leaflet/Leaflet.markercluster/issues/280)
- Improve usability with small maps (Reported by [@JSCSJSCS](https://github.com/JSCSJSCS)) [#144](https://github.com/Leaflet/Leaflet.markercluster/issues/144)
- Implement FeatureGroup.getLayer (Reported by [@newmanw](https://github.com/newmanw)) [#244](https://github.com/Leaflet/Leaflet.markercluster/issues/244)

### Bugfixes

- Fix singleMarkerMode when you aren't on the map (by [@duncanparkes](https://github.com/duncanparkes)) [#77](https://github.com/Leaflet/Leaflet.markercluster/issues/77)
- Fix clearLayers when you aren't on the map (by [@duncanparkes](https://github.com/duncanparkes)) [#79](https://github.com/Leaflet/Leaflet.markercluster/issues/79)
- IE10 Bug fix (Reported by [@theLundquist](https://github.com/theLundquist)) [#86](https://github.com/Leaflet/Leaflet.markercluster/issues/86)
- Fixes for hasLayer after removing a layer (Reported by [@cvisto](https://github.com/cvisto)) [#44](https://github.com/Leaflet/Leaflet.markercluster/issues/44)
- Fix clearLayers not unsetting \_\_parent of the markers, preventing them from being re-added. (Reported by [@apuntovanini](https://github.com/apuntovanini)) [#99](https://github.com/Leaflet/Leaflet.markercluster/issues/99)
- Fix map.removeLayer(markerClusterGroup) not working (Reported by [@Driklyn](https://github.com/Driklyn)) [#108](https://github.com/Leaflet/Leaflet.markercluster/issues/108)
- Fix map.addLayers not updating cluster icons (Reported by [@Driklyn](https://github.com/Driklyn)) [#114](https://github.com/Leaflet/Leaflet.markercluster/issues/114)
- Fix spiderfied clusters breaking if a marker is added to them (Reported by [@Driklyn](https://github.com/Driklyn)) [#114](https://github.com/Leaflet/Leaflet.markercluster/issues/114)
- Don't show coverage for spiderfied clusters as it will be wrong. (Reported by [@ajbeaven](https://github.com/ajbeaven)) [#95](https://github.com/Leaflet/Leaflet.markercluster/issues/95)
- Improve zoom in/out immediately making all everything disappear, still issues in Firefox [#140](https://github.com/Leaflet/Leaflet.markercluster/issues/140)
- Fix animation not stopping with only one marker. (Reported by [@Driklyn](https://github.com/Driklyn)) [#146](https://github.com/Leaflet/Leaflet.markercluster/issues/146)
- Various fixes for new leaflet (Reported by [@PeterAronZentai](https://github.com/PeterAronZentai)) [#159](https://github.com/Leaflet/Leaflet.markercluster/issues/159)
- Fix clearLayers when we are spiderfying (Reported by [@skullbooks](https://github.com/skullbooks)) [#162](https://github.com/Leaflet/Leaflet.markercluster/issues/162)
- Fix removing layers in certain situations (Reported by [@bpavot](https://github.com/bpavot)) [#160](https://github.com/Leaflet/Leaflet.markercluster/issues/160)
- Support calling hasLayer with null (by [@l0c0luke](https://github.com/l0c0luke)) [#170](https://github.com/Leaflet/Leaflet.markercluster/issues/170)
- Lots of fixes for removing a MarkerClusterGroup from the map (Reported by [@annetdeboer](https://github.com/annetdeboer)) [#200](https://github.com/Leaflet/Leaflet.markercluster/issues/200)
- Throw error when being added to a map with no maxZoom.
- Fixes for markers not appearing after a big zoom (Reported by [@arnoldbird](https://github.com/arnoldbird)) [#216](https://github.com/Leaflet/Leaflet.markercluster/issues/216) (Reported by [@mathilde-pellerin](https://github.com/mathilde-pellerin)) [#260](https://github.com/Leaflet/Leaflet.markercluster/issues/260)
- Fix coverage polygon not being removed when a MarkerClusterGroup is removed (Reported by [@ZeusTheTrueGod](https://github.com/ZeusTheTrueGod)) [#245](https://github.com/Leaflet/Leaflet.markercluster/issues/245)
- Fix getVisibleParent when no parent is visible (Reported by [@ajbeaven](https://github.com/ajbeaven)) [#265](https://github.com/Leaflet/Leaflet.markercluster/issues/265)
- Fix spiderfied markers not hiding on a big zoom (Reported by [@Vaesive](https://github.com/Vaesive)) [#268](https://github.com/Leaflet/Leaflet.markercluster/issues/268)
- Fix clusters not hiding on a big zoom (Reported by [@versusvoid](https://github.com/versusvoid)) [#281](https://github.com/Leaflet/Leaflet.markercluster/issues/281)
- Don't fire multiple clustermouseover/off events due to child divs in the cluster marker (Reported by [@heidemn](https://github.com/heidemn)) [#252](https://github.com/Leaflet/Leaflet.markercluster/issues/252)

## 0.2 (2012-10-11)

### Improvements

- Add addLayers/removeLayers bulk add and remove functions that perform better than the individual methods
- Allow customising the polygon generated for showing the area a cluster covers (by [@yohanboniface](https://github.com/yohanboniface)) [#68](https://github.com/Leaflet/Leaflet.markercluster/issues/68)
- Add zoomToShowLayer method to zoom down to a marker then call a callback once it is visible
- Add animateAddingMarkers to allow disabling animations caused when adding/removing markers
- Add hasLayer
- Pass the L.MarkerCluster to iconCreateFunction to give more flexibility deciding the icon
- Make addLayers support geojson layers
- Allow disabling clustering at a given zoom level
- Allow styling markers that are added like they were clusters of size 1

### Bugfixes

- Support when leaflet is configured to use canvas rather than SVG
- Fix some potential crashes in zoom handlers
- Tidy up when we are removed from the map

## 0.1 (2012-08-16)

Initial Release!
