import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

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

		map = new L.Map(div, {maxZoom: 18, trackResize: false});

		// Corresponds to zoom level 8 for the above div dimensions.
		map.fitBounds(new L.LatLngBounds([
			[1, 1],
			[2, 2]
		]));
	});

	afterEach(() => {
		if (group instanceof MarkerClusterGroup) {
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
	it('reclusters a marker moved on the map', () => {

		group = new MarkerClusterGroup();
		map.addLayer(group);

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);
		group.addLayers([marker, marker2]);
		expect(group.getVisibleParent(marker)).not.toBe(marker);

		marker.setLatLng([1.1, 1.9]);

		expect(group.getVisibleParent(marker)).toBe(marker);
		expect(group.getVisibleParent(marker2)).toBe(marker2);
		expect(group._gridUnclustered[18].getNearObject(map.project([1.5, 1.5], 18))).toBe(marker2);
		expect(group.getLayers().length).toBe(2);
	});

	it('reclusters a dragged marker on dragend', () => {

		group = new MarkerClusterGroup();
		map.addLayer(group);

		const marker = new L.Marker([1.1, 1.9]);
		const marker2 = new L.Marker([1.5, 1.5]);
		group.addLayers([marker, marker2]);

		marker.fire('dragstart');
		marker.setLatLng([1.5, 1.5]);
		expect(group.getVisibleParent(marker)).toBe(marker);

		marker.fire('dragend');
		expect(group.getVisibleParent(marker)).not.toBe(marker);
		expect(group.getVisibleParent(marker)).toBe(group.getVisibleParent(marker2));
		expect(group.getLayers().length).toBe(2);
	});

	it('listens to dragend only during a drag', () => {
		group = new MarkerClusterGroup();
		map.addLayer(group);

		const marker = new L.Marker([1.5, 1.5]);
		group.addLayers([marker, new L.Marker([1.5, 1.5])]);
		expect(marker.listens('dragend')).toBe(false);

		marker.fire('dragstart');
		expect(marker.listens('dragend')).toBe(true);
		expect(marker.__parent.getAllChildMarkers(null, true)).not.toContain(marker);

		marker.fire('dragend');
		expect(marker.listens('dragend')).toBe(false);
		expect(marker.__parent.getAllChildMarkers(null, true)).toContain(marker);
	});

	it('does not add back a marker removed during a drag', () => {
		group = new MarkerClusterGroup();
		map.addLayer(group);

		const marker = new L.Marker([1.5, 1.5]);
		group.addLayers([marker, new L.Marker([1.5, 1.5])]);

		marker.fire('dragstart');
		marker.setLatLng([1.1, 1.9]);
		group.removeLayer(marker);
		expect(marker.listens('dragend')).toBe(false);

		marker.fire('dragend');
		expect(group.hasLayer(marker)).toBe(false);
		expect(group.getLayers().length).toBe(1);
	});

	it('moves a marker that was moved while off the map', () => {

		group = new MarkerClusterGroup();

		const marker = new L.Marker([10, 10]);
		map.addLayer(group);
		group.addLayer(marker);

		map.removeLayer(group);
		marker.setLatLng([1.5, 1.5]);
		map.addLayer(group);

		expect(group.getLayers().length).toBe(1);
	});

	it('moves multiple markers that were moved while off the map', () => {

		group = new MarkerClusterGroup();
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

	it('does not add back a marker moved after removeLayers', () => {
		group = new MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayers([marker]);
		group.removeLayers([marker]);
		marker.setLatLng([1.6, 1.6]);

		expect(group.hasLayer(marker)).toBe(false);
	});

	it('does not add back a marker removed while off the map and moved', () => {
		group = new MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);
		map.removeLayer(group);
		group.removeLayer(marker);
		marker.setLatLng([1.6, 1.6]);

		expect(group.hasLayer(marker)).toBe(false);

		map.addLayer(group);
		marker.setLatLng([1.7, 1.7]);

		expect(group.hasLayer(marker)).toBe(false);
		expect(group.getLayers()).toEqual([]);
	});
});
