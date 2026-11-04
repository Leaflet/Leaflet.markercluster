import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

describe('addLayers adding multiple markers', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let div, map, group;

	beforeEach(() => {
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

		div = map = group = null;
	});

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('creates a cluster when 2 overlapping markers are added before the group is added to the map', () => {

		group = new MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		expect(marker._icon).toBe(undefined);
		expect(marker2._icon).toBe(undefined);

		expect(map._panes.markerPane.childNodes.length).toBe(1);
	});

	it('creates a cluster when 2 overlapping markers are added after the group is added to the map', () => {

		group = new MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayers([marker, marker2]);

		expect(marker._icon).toBe(undefined);
		expect(marker2._icon).toBe(undefined);

		expect(map._panes.markerPane.childNodes.length).toBe(1);
	});

	it('creates a cluster and marker when 2 overlapping markers and one non-overlapping are added before the group is added to the map', () => {

		group = new MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);
		const marker3 = new L.Marker([3.0, 1.5]);

		group.addLayers([marker, marker2, marker3]);
		map.addLayer(group);

		expect(marker._icon).toBe(undefined);
		expect(marker2._icon).toBe(undefined);
		expect(marker3._icon.parentNode).toBe(map._panes.markerPane);

		expect(map._panes.markerPane.childNodes.length).toBe(2);
	});

	it('creates a cluster and marker when 2 overlapping markers and one non-overlapping are added after the group is added to the map', () => {

		group = new MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);
		const marker3 = new L.Marker([3.0, 1.5]);

		map.addLayer(group);
		group.addLayers([marker, marker2, marker3]);

		expect(marker._icon).toBe(undefined);
		expect(marker2._icon).toBe(undefined);
		expect(marker3._icon.parentNode).toBe(map._panes.markerPane);

		expect(map._panes.markerPane.childNodes.length).toBe(2);
	});

	it('handles nested Layer Groups', () => {

		group = new MarkerClusterGroup();

		const marker1 = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);
		const marker3 = new L.Marker([3.0, 1.5]);
		const layerGroup = new L.LayerGroup([marker1, new L.LayerGroup([marker2])]);

		map.addLayer(group);
		group.addLayers([layerGroup, marker3]);

		expect(marker1._icon).toBe(undefined);
		expect(marker2._icon).toBe(undefined);
		expect(marker3._icon.parentNode).toBe(map._panes.markerPane);

		expect(map._panes.markerPane.childNodes.length).toBe(2);
	});

	it('unspiderfies before adding new Marker(s)', () => {

		vi.useFakeTimers();

		group = new MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);
		const marker3 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		expect(marker._icon).toBe(undefined);
		expect(marker2._icon).toBe(undefined);

		group.zoomToShowLayer(marker);
		//Run the the animation
		vi.advanceTimersByTime(1000);

		expect(marker._icon).not.toBe(undefined);
		expect(marker._icon).not.toBe(null);
		expect(marker2._icon).not.toBe(undefined);
		expect(marker2._icon).not.toBe(null);

		group.addLayers([marker3]);
		//Run the the animation
		vi.advanceTimersByTime(1000);

		expect(marker._icon).toBe(null);
		expect(marker2._icon).toBe(null);
		expect(marker3._icon).toBe(undefined);
		expect(marker3.__parent._icon).not.toBe(undefined);
		expect(marker3.__parent._icon).not.toBe(null);
		expect(marker3.__parent._icon.innerText.trim()).toBe('3');

		vi.useRealTimers();
	});

	it('finishes chunked loading when the group is removed from the map and added back', () => {
		vi.useFakeTimers();
		// every call takes 1 ms, so that each chunk stops after the first 200 markers
		let time = 0;
		vi.spyOn(performance, 'now').mockImplementation(() => time++);

		group = new MarkerClusterGroup({chunkedLoading: true, chunkInterval: 0});
		const markers = [];
		for (let i = 0; i < 1000; i++) {
			markers.push(new L.Marker([1 + i / 1000, 1 + (i % 10) / 10]));
		}

		map.addLayer(group);
		group.addLayers(markers);

		expect(group.getLayers().length).toBe(200);

		map.removeLayer(group);
		vi.runAllTimers();
		vi.restoreAllMocks();

		expect(group.getLayers().length).toBe(1000);

		map.addLayer(group);

		expect(group.getLayers().length).toBe(1000);
		expect(group.getVisibleParent(markers[999])).not.toBe(null);

		vi.useRealTimers();
	});

	it('fires layeradd while off the map, and not again when added to it', () => {
		group = new MarkerClusterGroup();
		const added = vi.fn();
		group.on('layeradd', added);
		group.addLayers([new L.Marker([1.5, 1.5]), new L.Polyline([[1.5, 1.5], [2, 2]])]);
		expect(added).toHaveBeenCalledTimes(2);

		map.addLayer(group);
		expect(added).toHaveBeenCalledTimes(2);
	});
});
