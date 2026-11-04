import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

describe('eachLayer', () => {
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

		const layers = [];
		group.eachLayer((l) => {
			layers.push(l);
		});

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

		const layers = [];
		group.eachLayer((l) => {
			layers.push(l);
		});

		expect(layers.length).toBe(2);
		expect(layers).toContain(marker);
		expect(layers).toContain(polygon);
	});

	it('includes a marker removed and added back while off the map', () => {
		const group = new MarkerClusterGroup().addTo(map);
		const a = new L.Marker([1.5, 1.5]), b = new L.Marker([3, 3]);
		group.addLayers([a, b]);
		map.removeLayer(group);
		group.removeLayer(a);
		group.addLayer(a);

		expect(group.hasLayer(a)).toBe(true);
		expect(group.getLayers().length).toBe(2);
		map.addLayer(group);
		expect(group.getLayers().length).toBe(2);
	});
});
