import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

describe('onAdd', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let map, div;

	beforeEach(() => {
		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = new L.Map(div, {trackResize: false});

		map.fitBounds(new L.LatLngBounds([
			[1, 1],
			[2, 2]
		]));
	});

	afterEach(() => {
		map.remove();
		document.body.removeChild(div);

		map = div = null;
	});

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('throws an error if maxZoom is not specified', () => {

		const group = new MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);

		group.addLayer(marker);

		let ex = null;
		try {
			map.addLayer(group);
		} catch (e) {
			ex = e;
		}

		expect(ex).not.toBe(null);
	});

	it('successfully handles removing and re-adding a layer while not on the map', () => {
		map.options.maxZoom = 18;
		const group = new MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);

		map.removeLayer(group);
		group.removeLayer(marker);
		group.addLayer(marker);

		map.addLayer(group);

		expect(map.hasLayer(group)).toBe(true);
		expect(group.hasLayer(marker)).toBe(true);
	});
});
