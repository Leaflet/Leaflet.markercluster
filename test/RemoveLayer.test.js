import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('removeLayer', () => {
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
	it('removes a layer that was added to it', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);

		map.addLayer(group);

		group.addLayer(marker);

		expect(marker._icon.parentNode).toBe(map._panes.markerPane);

		group.removeLayer(marker);

		expect(marker._icon).toBe(null);
	});

	it('doesnt remove a layer not added to it', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);

		map.addLayer(group);

		map.addLayer(marker);

		expect(marker._icon.parentNode).toBe(map._panes.markerPane);

		group.removeLayer(marker);

		expect(marker._icon.parentNode).toBe(map._panes.markerPane);
	});

	it('removes a layer that was added to it (before being on the map) that is shown in a cluster', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		group.removeLayer(marker);

		expect(marker._icon).toBe(undefined);
		expect(marker2._icon.parentNode).toBe(map._panes.markerPane);
	});

	it('removes a layer that was added to it (after being on the map) that is shown in a cluster', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);
		group.addLayer(marker2);

		group.removeLayer(marker);

		expect(marker._icon).toBe(null);
		expect(marker2._icon.parentNode).toBe(map._panes.markerPane);
	});

	it('removes a layer that was added to it (before being on the map) that is individually', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1, 1.5]);
		const marker2 = new L.Marker([3, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);
		group.addLayer(marker2);

		expect(marker._icon.parentNode).toBe(map._panes.markerPane);
		expect(marker2._icon.parentNode).toBe(map._panes.markerPane);

		group.removeLayer(marker);

		expect(marker._icon).toBe(null);
		expect(marker2._icon.parentNode).toBe(map._panes.markerPane);
	});

	it('removes a layer (with animation) that was added to it (after being on the map) that is shown in a cluster', () => {

		group = new L.MarkerClusterGroup({animateAddingMarkers: true});

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);
		group.addLayer(marker2);

		//Run the the animation
		vi.advanceTimersByTime(1000);

		expect(marker._icon).toBe(null);
		expect(marker2._icon).toBe(null);

		group.removeLayer(marker);

		//Run the the animation
		vi.advanceTimersByTime(1000);

		expect(marker._icon).toBe(null);
		expect(marker2._icon.parentNode).toBe(map._panes.markerPane);
	});

	it('removes the layers that are in the given LayerGroup', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayers([marker, marker2]);

		const layer = L.layerGroup();
		layer.addLayer(marker2);
		group.removeLayer(layer);

		expect(marker._icon).not.toBe(undefined);
		expect(marker2._icon).toBe(undefined);
	});

	it('removes the layers that are in the given LayerGroup when not on the map', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);

		const layer = L.layerGroup();
		layer.addLayer(marker2);
		group.removeLayer(layer);

		expect(group.hasLayer(marker)).toBe(true);
		expect(group.hasLayer(marker2)).toBe(false);
	});

	it('passes control to removeLayers when marker is a Layer Group', () => {

		group = new L.MarkerClusterGroup();

		const marker1 = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker1, marker2]);

		const layer = L.layerGroup();
		layer.addLayer(marker2);
		group.removeLayer(new L.LayerGroup([layer]));

		expect(group.hasLayer(marker1)).toBe(true);
		expect(group.hasLayer(marker2)).toBe(false);
	});
});
