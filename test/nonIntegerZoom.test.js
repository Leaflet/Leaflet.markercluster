import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('non-integer min/max zoom', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let map, div;

	beforeEach(() => {
		vi.useFakeTimers();

		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = L.map(div, {minZoom: 0.5, maxZoom: 18.5, trackResize: false});

		map.fitBounds(new L.LatLngBounds([
			[1, 1],
			[2, 2]
		]));
	});

	afterEach(() => {
		map.remove();
		document.body.removeChild(div);
		vi.useRealTimers();
	});

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('dont break adding and removing markers', () => {
		const group = new L.MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);
		const marker3 = new L.Marker([1.5, 1.5]);

		group.addLayer(marker);
		group.addLayer(marker2);
		map.addLayer(group);

		group.addLayer(marker3);

		expect(marker._icon).toBe(undefined);
		expect(marker2._icon).toBe(undefined);
		expect(marker3._icon).toBe(undefined);

		expect(map._panes.markerPane.childNodes.length).toBe(1);

		group.removeLayer(marker2);
	});
});
