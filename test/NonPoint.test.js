import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('adding non point data works', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let div, map, group;

	beforeEach(() => {
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

		div = map = group = null;
	});


	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('Allows adding a polygon before via addLayer', () => {

		group = new L.MarkerClusterGroup();

		const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

		group.addLayer(polygon);
		map.addLayer(group);

		// Leaflet 1.0.0 now uses an intermediate L.Renderer.
		// polygon > _path > _rootGroup (g) > _container (svg) > pane (div)
		expect(polygon._path).not.toBe(undefined);
		expect(polygon._path.parentNode.parentNode.parentNode).toBe(map.getPane('overlayPane'));

		expect(group.hasLayer(polygon));
	});

	it('Allows adding a polygon before via addLayers([])', () => {

		group = new L.MarkerClusterGroup();

		const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

		group.addLayers([polygon]);
		map.addLayer(group);

		expect(polygon._path).not.toBe(undefined);
		expect(polygon._path.parentNode.parentNode.parentNode).toBe(map.getPane('overlayPane'));
	});

	it('Removes polygons from map when removed', () => {

		group = new L.MarkerClusterGroup();

		const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

		group.addLayer(polygon);
		map.addLayer(group);
		map.removeLayer(group);

		expect(polygon._path.parentNode).toBe(null);
	});

	describe('hasLayer', () => {

		it('returns false when not added', () => {
			group = new L.MarkerClusterGroup();

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			expect(group.hasLayer(polygon)).toBe(false);

			map.addLayer(group);

			expect(group.hasLayer(polygon)).toBe(false);

			map.addLayer(polygon);

			expect(group.hasLayer(polygon)).toBe(false);
		});

		it('returns true before adding to map', () => {
			group = new L.MarkerClusterGroup();

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			group.addLayers([polygon]);

			expect(group.hasLayer(polygon)).toBe(true);
		});

		it('returns true after adding to map after adding polygon', () => {
			group = new L.MarkerClusterGroup();

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			group.addLayer(polygon);
			map.addLayer(group);

			expect(group.hasLayer(polygon)).toBe(true);
		});

		it('returns true after adding to map before adding polygon', () => {
			group = new L.MarkerClusterGroup();

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			map.addLayer(group);
			group.addLayer(polygon);

			expect(group.hasLayer(polygon)).toBe(true);
		});

	});

	describe('removeLayer', () => {

		it('removes before adding to map', () => {
			group = new L.MarkerClusterGroup();

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			group.addLayer(polygon);
			expect(group.hasLayer(polygon)).toBe(true);

			group.removeLayer(polygon);
			expect(group.hasLayer(polygon)).toBe(false);
		});

		it('removes before adding to map', () => {
			group = new L.MarkerClusterGroup();

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			group.addLayers([polygon]);
			expect(group.hasLayer(polygon)).toBe(true);

			group.removeLayer(polygon);
			expect(group.hasLayer(polygon)).toBe(false);
		});

		it('removes after adding to map after adding polygon', () => {
			group = new L.MarkerClusterGroup();

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			group.addLayer(polygon);
			map.addLayer(group);
			expect(group.hasLayer(polygon)).toBe(true);

			group.removeLayer(polygon);
			expect(group.hasLayer(polygon)).toBe(false);
		});

		it('removes after adding to map before adding polygon', () => {
			group = new L.MarkerClusterGroup();

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			map.addLayer(group);
			group.addLayer(polygon);
			expect(group.hasLayer(polygon)).toBe(true);

			group.removeLayer(polygon);
			expect(group.hasLayer(polygon)).toBe(false);
		});

	});

	describe('removeLayers', () => {

		it('removes before adding to map', () => {
			group = new L.MarkerClusterGroup();

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			group.addLayer(polygon);
			expect(group.hasLayer(polygon)).toBe(true);

			group.removeLayers([polygon]);
			expect(group.hasLayer(polygon)).toBe(false);
		});

		it('removes before adding to map', () => {
			group = new L.MarkerClusterGroup();

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			group.addLayers([polygon]);
			expect(group.hasLayer(polygon)).toBe(true);

			group.removeLayers([polygon]);
			expect(group.hasLayer(polygon)).toBe(false);
		});

		it('removes after adding to map after adding polygon', () => {
			group = new L.MarkerClusterGroup();

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			group.addLayer(polygon);
			map.addLayer(group);
			expect(group.hasLayer(polygon)).toBe(true);

			group.removeLayers([polygon]);
			expect(group.hasLayer(polygon)).toBe(false);
		});

		it('removes after adding to map before adding polygon', () => {
			group = new L.MarkerClusterGroup();

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			map.addLayer(group);
			group.addLayer(polygon);
			expect(group.hasLayer(polygon)).toBe(true);

			group.removeLayers([polygon]);
			expect(group.hasLayer(polygon)).toBe(false);
		});

	});
});
