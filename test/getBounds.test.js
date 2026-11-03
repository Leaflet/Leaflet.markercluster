import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('getBounds', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let map, div;

	beforeEach(() => {
		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = L.map(div, {maxZoom: 18, trackResize: false});

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
	describe('polygon layer', () => {
		it('returns the correct bounds before adding to the map', () => {
			const group = new L.MarkerClusterGroup();
			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			group.addLayer(polygon);

			expect(group.getBounds().equals(polygon.getBounds())).toBe(true);
		});

		it('returns the correct bounds after adding to the map after adding polygon', () => {
			const group = new L.MarkerClusterGroup();
			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			group.addLayer(polygon);
			map.addLayer(group);

			expect(group.getBounds().equals(polygon.getBounds())).toBe(true);
		});

		it('returns the correct bounds after adding to the map before adding polygon', () => {
			const group = new L.MarkerClusterGroup();
			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			map.addLayer(group);
			group.addLayer(polygon);

			expect(group.getBounds().equals(polygon.getBounds())).toBe(true);
		});
	});

	describe('marker layers', () => {
		it('returns the correct bounds before adding to the map', () => {
			const group = new L.MarkerClusterGroup();
			const marker = new L.Marker([1.5, 1.5]);
			const marker2 = new L.Marker([1.0, 5.0]);
			const marker3 = new L.Marker([6.0, 2.0]);

			group.addLayers([marker, marker2, marker3]);

			expect(group.getBounds().equals(L.latLngBounds([1.0, 5.0], [6.0, 1.5]))).toBe(true);
		});

		it('returns the correct bounds after adding to the map after adding markers', () => {
			const group = new L.MarkerClusterGroup();
			const marker = new L.Marker([1.5, 1.5]);
			const marker2 = new L.Marker([1.0, 5.0]);
			const marker3 = new L.Marker([6.0, 2.0]);

			group.addLayers([marker, marker2, marker3]);
			map.addLayer(group);

			expect(group.getBounds().equals(L.latLngBounds([1.0, 5.0], [6.0, 1.5]))).toBe(true);
		});

		it('returns the correct bounds after adding to the map before adding markers', () => {
			const group = new L.MarkerClusterGroup();
			const marker = new L.Marker([1.5, 1.5]);
			const marker2 = new L.Marker([1.0, 5.0]);
			const marker3 = new L.Marker([6.0, 2.0]);

			map.addLayer(group);
			group.addLayers([marker, marker2, marker3]);

			expect(group.getBounds().equals(L.latLngBounds([1.0, 5.0], [6.0, 1.5]))).toBe(true);
		});
	});

	describe('marker and polygon layers', () => {
		it('returns the correct bounds before adding to the map', () => {
			const group = new L.MarkerClusterGroup();
			const marker = new L.Marker([6.0, 3.0]);
			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			group.addLayers([marker, polygon]);

			expect(group.getBounds().equals(L.latLngBounds([1.5, 1.5], [6.0, 3.0]))).toBe(true);
		});

		it('returns the correct bounds after adding to the map', () => {
			const group = new L.MarkerClusterGroup();
			const marker = new L.Marker([6.0, 3.0]);
			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			map.addLayer(group);
			group.addLayers([marker, polygon]);

			expect(group.getBounds().equals(L.latLngBounds([1.5, 1.5], [6.0, 3.0]))).toBe(true);
		});
	});

	describe('blank layer', () => {
		it('returns a blank bounds', () => {
			const group = new L.MarkerClusterGroup();

			expect(group.getBounds().isValid()).toBe(false);
		});
	});
});
