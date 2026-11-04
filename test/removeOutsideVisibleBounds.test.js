import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';
import {parents} from '../src/MarkerCluster.js';

describe('Option removeOutsideVisibleBounds', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let marker1, marker2, marker3, marker4, marker5, markers, div, map, group;

	beforeEach(() => {
		vi.useFakeTimers();

		marker1 = new L.Marker([1.5, -0.4]); // 2 screens width away.
		marker2 = new L.Marker([1.5, 0.6]); // 1 screen width away.
		marker3 = new L.Marker([1.5, 1.5]); // In view port.
		marker4 = new L.Marker([1.5, 2.4]); // 1 screen width away.
		marker5 = new L.Marker([1.5, 3.4]); // 2 screens width away.
		markers = [marker1, marker2, marker3, marker4, marker5];

		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = new L.Map(div, {maxZoom: 18, trackResize: false});

		// Corresponds to zoom level 8 for the above div dimensions.
		map.fitBounds(new L.LatLngBounds([
			[1, 1],
			[2, 2]
		]));

		// Add all markers once to map then remove them immediately so that their icon is null (instead of undefined).
		for (let i = 0; i < markers.length; i++) {
			map.removeLayer(markers[i].addTo(map));
		}
	});

	afterEach(() => {
		if (group instanceof MarkerClusterGroup) {
			//group.removeLayers(group.getLayers());
			group.clearLayers();
			map.removeLayer(group);
		}

		map.remove();
		div.remove();
		vi.useRealTimers();

		marker1 = marker2 = marker3 = marker4 = marker5 = markers = div = map = group = null;
	});

	function prepareGroup() {
		// "group" should be assigned with a Marker Cluster Group before calling this function.
		group.addTo(map);

		group.addLayers(markers);
	}

	// the group skips padding the visible bounds for coarse pointers
	function setBrowserToMobile() {
		vi.stubGlobal('matchMedia', () => ({matches: true}));
	}

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('removes objects more than 1 screen away from view port by default', () => {

		group = new MarkerClusterGroup();

		prepareGroup();

		expect(marker1._icon).toBe(null);
		expect(map._panes.markerPane.childNodes.length).toBe(3); // markers 2, 3 and 4.
		expect(marker5._icon).toBe(null);

	});

	it('removes objects out of view port by default for mobile device', () => {
		setBrowserToMobile();
		try {
			group = new MarkerClusterGroup();

			prepareGroup();

			expect(marker1._icon).toBe(null);
			expect(marker2._icon).toBe(null);
			expect(map._panes.markerPane.childNodes.length).toBe(1); // marker 3 only.
			expect(marker4._icon).toBe(null);
			expect(marker5._icon).toBe(null);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('leaves all objects on map when set to false', () => {

		group = new MarkerClusterGroup({
			removeOutsideVisibleBounds: false
		});

		prepareGroup();

		expect(map._panes.markerPane.childNodes.length).toBe(5); // All 5 markers.

	});


	// Following tests need markers at very high latitude.
	// They test the _checkBoundsMaxLat method against the default Web/Spherical Mercator projection maximum latitude (85.0511287798).
	// The actual map view should be '-1.0986328125,84.92929204957956,1.0986328125,85.11983467698401'
	// The expanded bounds without correction should be '-3.2958984375,84.7387494221751,3.2958984375,85.31037730438847'
	const latLngsMaxLatDefault = [
		[100, 3], // Impossible in real world, but nothing prevents the user from entering such latitude, and  Web/Spherical Mercator projection will still display it at 85.0511287798
		[85.2, 1.5], // 1 "screen" heights away.
		[85, 0], // In center of view.
		[84.8, -1.5], // 1 "screen" height away.
		[84.6, -3] // 2 "screens" height away.
	];

	function moveMarkersAndMapToMaxLat(latLngs, isSouth) {
		for (let i = 0; i < markers.length; i++) {
			if (isSouth) {
				markers[i].setLatLng([-latLngs[i][0], latLngs[i][1]]);
			} else {
				markers[i].setLatLng(latLngs[i]);
			}
		}

		map.fitBounds([
			[isSouth ? -86 : 85, -1],
			[isSouth ? -85 : 86, 1] // The actual map view longitude span will be wider. '-1.0986328125,84.92929204957956,1.0986328125,85.11983467698401'
		]);
	}

	function checkProjection() {
		expect(map.options.crs.projection.MAX_LATITUDE).toBeCloseTo(85.0511287798);

		const mapZoom = map.getZoom();

		for (let i = 0; i < markers.length; i++) {
			try {
				expect(parents.get(markers[i])._zoom).toBeLessThan(mapZoom);
			} catch (e) {
				console.log(`Failed marker: ${  i + 1}`);
				throw e;
			}
		}
	}

	it('includes objects above the Web Mercator projection maximum limit by default', () => {

		moveMarkersAndMapToMaxLat(latLngsMaxLatDefault);

		group = new MarkerClusterGroup();

		prepareGroup();

		checkProjection(latLngsMaxLatDefault);

		expect(map._panes.markerPane.childNodes.length).toBe(4); // Markers 1, 2, 3 and 4.
		expect(marker5._icon).toBe(null);

	});

	it('includes objects below the Web Mercator projection minimum limit by default', () => {

		moveMarkersAndMapToMaxLat(latLngsMaxLatDefault, true);

		// Make sure we are really in Southern hemisphere.
		expect(map.getBounds().getNorth()).toBeLessThan(-80);

		group = new MarkerClusterGroup();

		prepareGroup();

		checkProjection(latLngsMaxLatDefault);

		vi.advanceTimersByTime(1000);

		expect(map._panes.markerPane.childNodes.length).toBe(4); // Markers 1, 2, 3 and 4.
		expect(marker5._icon).toBe(null);

	});


	// The actual map view should be '-1.0986328125,84.92929204957956,1.0986328125,85.11983467698401'
	const latLngsMaxLatMobile = [
		[100, 1], // Impossible in real world, but nothing prevents the user from entering such latitude, and  Web/Spherical Mercator projection will still display it at 85.0511287798
		[85.2, 0.5], // 1 "screen" heights away, but should be included by the correction.
		[85, 0], // In center of view.
		[84.9, -1], // 1 "screen" height away.
		[84.8, -1.5] // 2 "screens" height away.
	];

	it('includes objects above the Web Mercator projection maximum limit for mobile device', () => {
		setBrowserToMobile();
		try {
			moveMarkersAndMapToMaxLat(latLngsMaxLatMobile);

			group = new MarkerClusterGroup({
				maxClusterRadius: 10
			});

			prepareGroup();

			checkProjection(latLngsMaxLatMobile);

			expect(map._panes.markerPane.childNodes.length).toBe(3); // Markers 1, 2 and 3.
			expect(marker4._icon).toBe(null);
			expect(marker5._icon).toBe(null);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('includes objects below the Web Mercator projection minimum limit for mobile device', () => {
		setBrowserToMobile();
		try {
			moveMarkersAndMapToMaxLat(latLngsMaxLatMobile, true);

			// Make sure we are really in Southern hemisphere.
			expect(map.getBounds().getNorth()).toBeLessThan(-80);

			group = new MarkerClusterGroup({
				maxClusterRadius: 10
			});

			prepareGroup();

			checkProjection(latLngsMaxLatMobile);

			expect(map._panes.markerPane.childNodes.length).toBe(3); // Markers 1, 2 and 3.
			expect(marker4._icon).toBe(null);
			expect(marker5._icon).toBe(null);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
