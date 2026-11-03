import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('removeLayers', () => {
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
	it('removes all the layer given to it', () => {

		group = new L.MarkerClusterGroup();

		const markers = [
			new L.Marker([1.5, 1.5]),
			new L.Marker([1.5, 1.5]),
			new L.Marker([1.5, 1.5])
		];

		map.addLayer(group);

		group.addLayers(markers);

		group.removeLayers(markers);

		expect(group.hasLayer(markers[0])).toBe(false);
		expect(group.hasLayer(markers[1])).toBe(false);
		expect(group.hasLayer(markers[2])).toBe(false);

		expect(group.getLayers().length).toBe(0);
	});

	it('removes all the layer given to it even though they move', () => {

		group = new L.MarkerClusterGroup();

		const markers = [
			new L.Marker([10, 10]),
			new L.Marker([20, 20]),
			new L.Marker([30, 30])
		];
		const len = markers.length;
		map.addLayer(group);

		group.addLayers(markers);

		markers.forEach((marker) => {
			marker.setLatLng([1.5, 1.5]);
			group.removeLayer(marker);
			expect(group.getLayers().length).toBe(len - 1);
			group.addLayer(marker);
			expect(group.getLayers().length).toBe(len);
		});

		expect(group.getLayers().length).toBe(len);
	});

	it('removes all the layer given to it even if the group is not on the map', () => {

		group = new L.MarkerClusterGroup();

		const markers = [
			new L.Marker([1.5, 1.5]),
			new L.Marker([1.5, 1.5]),
			new L.Marker([1.5, 1.5])
		];

		map.addLayer(group);
		group.addLayers(markers);
		map.removeLayer(group);
		group.removeLayers(markers);
		map.addLayer(group);

		expect(group.hasLayer(markers[0])).toBe(false);
		expect(group.hasLayer(markers[1])).toBe(false);
		expect(group.hasLayer(markers[2])).toBe(false);

		expect(group.getLayers().length).toBe(0);
	});

	it('doesnt break if we are spiderfied', () => {

		group = new L.MarkerClusterGroup();

		const markers = [
			new L.Marker([1.5, 1.5]),
			new L.Marker([1.5, 1.5]),
			new L.Marker([1.5, 1.5])
		];

		map.addLayer(group);

		group.addLayers(markers);

		markers[0].__parent.spiderfy();

		// We must wait for the spiderfy animation to timeout
		vi.advanceTimersByTime(200);

		group.removeLayers(markers);

		expect(group.hasLayer(markers[0])).toBe(false);
		expect(group.hasLayer(markers[1])).toBe(false);
		expect(group.hasLayer(markers[2])).toBe(false);

		expect(group.getLayers().length).toBe(0);

		group.on('spiderfied', () => {
			expect(group._spiderfied).toBe(null);
		});
	});

	it('handles nested Layer Groups', () => {

		group = new L.MarkerClusterGroup();

		const marker1 = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);
		const marker3 = new L.Marker([1.5, 1.5]);

		map.addLayer(group);

		group.addLayers([marker1, marker2, marker3]);

		expect(group.hasLayer(marker1)).toBe(true);
		expect(group.hasLayer(marker2)).toBe(true);
		expect(group.hasLayer(marker3)).toBe(true);

		group.removeLayers([
			marker1,
			new L.LayerGroup([
				marker2, new L.LayerGroup([
					marker3
				])
			])
		]);

		expect(group.hasLayer(marker1)).toBe(false);
		expect(group.hasLayer(marker2)).toBe(false);
		expect(group.hasLayer(marker3)).toBe(false);

		expect(group.getLayers().length).toBe(0);
	});

	it('chunked loading zoom out', () => {
		//See #743 for more details
		const markers = [];

		group = new L.MarkerClusterGroup({
			chunkedLoading: true, chunkProgress() {
				//Before this provoked an "undefined" exception
				map.zoomOut();
				group.removeLayers(markers);
			}
		});

		for (let i = 1; i < 1000; i++) {
			markers.push(new L.Marker([1.0 + (.0001 * i), 1.0 + (.0001 * i)]));
		}

		map.addLayer(group);

		group.addLayers(markers);
	});
});
