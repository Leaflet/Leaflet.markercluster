import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

describe('support for CircleMarker elements', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let div, map, group;

	beforeEach(() => {
		vi.useFakeTimers();

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
	});

	afterEach(() => {
		if (group instanceof MarkerClusterGroup) {
			group.clearLayers();
			map.removeLayer(group);
		}

		map.remove();
		div.remove();
		vi.useRealTimers();

		div = map = group = null;
	});

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('appears when added to the group before the group is added to the map', () => {

		group = new MarkerClusterGroup();

		const marker = new L.CircleMarker([1.5, 1.5]);

		group.addLayer(marker);
		map.addLayer(group);

		// Leaflet 1.0.0 now uses an intermediate L.Renderer.
		// marker > _path > _rootGroup (g) > _container (svg) > pane (div)
		expect(marker._path.parentNode.parentNode).not.toBe(undefined);
		expect(marker._path.parentNode.parentNode.parentNode).toBe(map.getPane('overlayPane'));

		vi.advanceTimersByTime(1000);
	});

	it('appears when added to the group after the group is added to the map', () => {

		group = new MarkerClusterGroup();

		const marker = new L.CircleMarker([1.5, 1.5]);

		group.addLayer(marker);
		map.addLayer(group);

		expect(marker._path.parentNode.parentNode).not.toBe(undefined);
		expect(marker._path.parentNode.parentNode.parentNode).toBe(map.getPane('overlayPane'));

		vi.advanceTimersByTime(1000);
	});

	it('appears animated when added to the group after the group is added to the map', () => {

		group = new MarkerClusterGroup({animateAddingMarkers: true});

		const marker = new L.CircleMarker([1.5, 1.5]);
		const marker2 = new L.CircleMarker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);
		group.addLayer(marker2);

		expect(marker._path.parentNode.parentNode.parentNode).toBe(map.getPane('overlayPane'));
		expect(marker2._path.parentNode.parentNode.parentNode).toBe(map.getPane('overlayPane'));

		vi.advanceTimersByTime(1000);

		expect(marker._path.parentNode).toBe(null);
		expect(marker2._path.parentNode).toBe(null);
	});

	it('creates a cluster when 2 overlapping markers are added before the group is added to the map', () => {

		group = new MarkerClusterGroup();

		const marker = new L.CircleMarker([1.5, 1.5]);
		const marker2 = new L.CircleMarker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		expect(marker._path).toBe(undefined);
		expect(marker2._path).toBe(undefined);

		expect(map._panes.markerPane.childNodes.length).toBe(1);

		vi.advanceTimersByTime(1000);
	});

	it('creates a cluster when 2 overlapping markers are added after the group is added to the map', () => {

		group = new MarkerClusterGroup();

		const marker = new L.CircleMarker([1.5, 1.5]);
		const marker2 = new L.CircleMarker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);
		group.addLayer(marker2);

		expect(marker._path.parentNode).toBe(null); //Removed then re-added, so null
		expect(marker2._path).toBe(undefined);

		expect(map._panes.markerPane.childNodes.length).toBe(1);

		vi.advanceTimersByTime(1000);
	});

	it('disappears when removed from the group', () => {

		group = new MarkerClusterGroup();

		const marker = new L.CircleMarker([1.5, 1.5]);

		group.addLayer(marker);
		map.addLayer(group);

		expect(marker._path.parentNode).not.toBe(undefined);
		expect(marker._path.parentNode.parentNode.parentNode).toBe(map.getPane('overlayPane'));

		group.removeLayer(marker);

		expect(marker._path.parentNode).toBe(null);

		vi.advanceTimersByTime(1000);
	});
});
