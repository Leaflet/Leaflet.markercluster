import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('moving markers', () => {
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

		map = L.map(div, {maxZoom: 18, trackResize: false});

		// Corresponds to zoom level 8 for the above div dimensions.
		map.fitBounds(new L.LatLngBounds([
			[1, 1],
			[2, 2]
		]));
	});

	afterEach(() => {
		if (group instanceof L.MarkerClusterGroup) {
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
	it('moves a marker that was moved while off the map', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([10, 10]);
		map.addLayer(group);
		group.addLayer(marker);

		map.removeLayer(group);
		marker.setLatLng([1.5, 1.5]);
		map.addLayer(group);

		expect(group.getLayers().length).toBe(1);
	});

	it('moves multiple markers that were moved while off the map', () => {

		group = new L.MarkerClusterGroup();
		map.addLayer(group);

		const markers = [];
		for (let i = 0; i < 10; i++) {
			const marker = new L.Marker([10, 10]);
			group.addLayer(marker);
			markers.push(marker);
		}

		map.removeLayer(group);
		for (let i = 0; i < 10; i++) {
			markers[i].setLatLng([1.5, 1.5]);
		}
		map.addLayer(group);

		expect(group.getLayers().length).toBe(10);
	});
});
