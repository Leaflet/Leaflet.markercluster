import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

describe('unspiderfy', () => {
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
			group.removeLayers(group.getLayers());
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
	it('Unspiderfies 2 Markers', () => {

		group = new MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayer(marker);
		group.addLayer(marker2);
		map.addLayer(group);

		marker.__parent.spiderfy();

		vi.advanceTimersByTime(1000);

		group.unspiderfy();

		vi.advanceTimersByTime(1000);

		expect(map.hasLayer(marker)).toBe(false);
		expect(map.hasLayer(marker2)).toBe(false);
	});

	it('Unspiderfies 2 CircleMarkers', () => {

		group = new MarkerClusterGroup();

		const marker = new L.CircleMarker([1.5, 1.5]);
		const marker2 = new L.CircleMarker([1.5, 1.5]);

		group.addLayer(marker);
		group.addLayer(marker2);
		map.addLayer(group);

		marker.__parent.spiderfy();

		vi.advanceTimersByTime(1000);

		group.unspiderfy();

		vi.advanceTimersByTime(1000);

		expect(map.hasLayer(marker)).toBe(false);
		expect(map.hasLayer(marker2)).toBe(false);
	});

	it('Unspiderfies 2 Circles', () => {

		group = new MarkerClusterGroup();

		const marker = new L.Circle([1.5, 1.5], {radius: 10});
		const marker2 = new L.Circle([1.5, 1.5], {radius: 10});

		group.addLayer(marker);
		group.addLayer(marker2);
		map.addLayer(group);

		marker.__parent.spiderfy();

		vi.advanceTimersByTime(1000);

		group.unspiderfy();

		vi.advanceTimersByTime(1000);

		expect(map.hasLayer(marker)).toBe(false);
		expect(map.hasLayer(marker2)).toBe(false);
	});

	it('fires unspiderfied event on unspiderfy', () => {
		const fired = vi.fn();

		group = new MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		marker.__parent.spiderfy();

		vi.advanceTimersByTime(1000);

		// Add event listener
		group.on('unspiderfied', (event) => {
			expect(event.target).toBe(group);
			expect(event.cluster).toBeInstanceOf(L.Marker);
			expect(event.markers[1]).toBe(marker);
			expect(event.markers[0]).toBe(marker2);

			fired();
		});

		group.unspiderfy();

		vi.advanceTimersByTime(1000);
		expect(fired).toHaveBeenCalledOnce();
	});

});
