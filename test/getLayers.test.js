import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

describe('getLayers', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let map, div;

	beforeEach(() => {
		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = new L.Map(div, {maxZoom: 18, trackResize: false});

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
	it('hits polygons and markers before adding to map', () => {
		const group = new MarkerClusterGroup();
		const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);
		const marker = new L.Marker([1.5, 1.5]);

		group.addLayers([polygon, marker]);

		const layers = group.getLayers();

		expect(layers.length).toBe(2);
		expect(layers).toContain(marker);
		expect(layers).toContain(polygon);
	});

	it('hits polygons and markers after adding to map', () => {
		const group = new MarkerClusterGroup();
		const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);
		const marker = new L.Marker([1.5, 1.5]);

		group.addLayers([polygon, marker]);
		map.addLayer(group);

		const layers = group.getLayers();

		expect(layers.length).toBe(2);
		expect(layers).toContain(marker);
		expect(layers).toContain(polygon);
	});

	it('skips markers and polygons removed while not on the map', () => {
		const group = new MarkerClusterGroup();
		const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);
		const marker = new L.Marker([1.5, 1.5]);

		group.addLayers([polygon, marker]);

		map.addLayer(group);
		map.removeLayer(group);

		group.removeLayers([polygon, marker]);

		const layers = group.getLayers();

		expect(layers.length).toBe(0);
	});
});
