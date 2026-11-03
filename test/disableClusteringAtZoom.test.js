import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

describe('disableClusteringAtZoom option', () => {
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

		// map zoom animation runs on requestAnimationFrame, which Leaflet grabs before fake timers can replace it
		map = new L.Map(div, {maxZoom: 18, trackResize: false, zoomAnimation: false});

		// Corresponds to zoom level 8 for the above div dimensions.
		map.fitBounds(new L.LatLngBounds([
			[1, 1],
			[2, 2]
		]));
	});

	afterEach(() => {
		group.clearLayers();
		map.removeLayer(group);
		map.remove();
		div.remove();
		vi.useRealTimers();

		div = map = group = null;
	});

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('unclusters at zoom level equal or higher', () => {

		const maxZoom = 15;

		group = new MarkerClusterGroup({
			disableClusteringAtZoom: maxZoom
		});

		group.addLayers([
			new L.Marker([1.5, 1.5]),
			new L.Marker([1.5, 1.5])
		]);
		map.addLayer(group);

		expect(group._maxZoom).toBe(maxZoom - 1);

		expect(map._panes.markerPane.childNodes.length).toBe(1); // 1 cluster.

		map.setZoom(14);
		vi.advanceTimersByTime(1000);
		expect(map._panes.markerPane.childNodes.length).toBe(1); // 1 cluster.

		map.setZoom(15);
		vi.advanceTimersByTime(1000);
		expect(map._panes.markerPane.childNodes.length).toBe(2); // 2 markers.
	});
});
