import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

describe('addLayer adding a single marker', () => {
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
	it('appears when added to the group before the group is added to the map', () => {

		group = new MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);

		group.addLayer(marker);
		map.addLayer(group);

		expect(marker._icon).not.toBe(undefined);
		expect(marker._icon.parentNode).toBe(map._panes.markerPane);
	});

	it('appears when added to the group after the group is added to the map', () => {

		group = new MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);

		expect(marker._icon).not.toBe(undefined);
		expect(marker._icon.parentNode).toBe(map._panes.markerPane);
	});

	it('appears (using animations) when added after the group is added to the map', () => {

		group = new MarkerClusterGroup({animateAddingMarkers: true});

		const marker = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);

		expect(marker._icon).not.toBe(undefined);
		expect(marker._icon.parentNode).toBe(map._panes.markerPane);
	});

	it('does not appear when too far away when added before the group is added to the map', () => {

		group = new MarkerClusterGroup();

		const marker = new L.Marker([3.5, 1.5]);

		group.addLayer(marker);
		map.addLayer(group);

		expect(marker._icon).toBe(undefined);
	});

	it('does not appear when too far away when added after the group is added to the map', () => {

		group = new MarkerClusterGroup();

		const marker = new L.Marker([3.5, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);

		expect(marker._icon).toBe(undefined);
	});

	it('passes control to addLayers when marker is a Layer Group', () => {

		group = new MarkerClusterGroup();

		const marker1 = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);
		const layerGroup = new L.LayerGroup([marker1, marker2]);

		map.addLayer(group);
		group.addLayer(layerGroup);

		expect(group._topClusterLevel.getChildCount()).toBe(2);

		expect(marker1._icon).toBe(undefined);
		expect(marker2._icon).toBe(undefined);

		expect(map._panes.markerPane.childNodes.length).toBe(1);
	});

	it('adds a marker added twice before the group is on the map once', () => {
		group = new MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);

		group.addLayer(marker);
		group.addLayer(marker);

		expect(group.getLayers()).toEqual([marker]);
	});

	it('takes a marker out of the group it was in', () => {
		const group = new MarkerClusterGroup({removeOutsideVisibleBounds: false}),
			other = new MarkerClusterGroup({removeOutsideVisibleBounds: false}),
			marker = new L.Marker([1.5, 1.5]),
			stays = new L.Marker([1.5, 1.5]),
			removed = [];

		map.addLayer(group);
		map.addLayer(other);
		group.addLayers([marker, stays]);
		group.on('layerremove', e => removed.push(e.layer));

		other.addLayer(marker);
		expect(removed).toEqual([marker]);
		expect(group.hasLayer(marker)).toBe(false);
		expect(other.hasLayer(marker)).toBe(true);

		// reclustered in the other group only
		marker.setLatLng([1.6, 1.6]);
		expect(group.getLayers()).toEqual([stays]);
		expect(group.getVisibleParent(stays)).toBe(stays);
		expect(other.getVisibleParent(marker)).toBe(marker);

		group.removeLayer(marker);
		expect(other.hasLayer(marker)).toBe(true);
		other.removeLayer(marker);
		expect(other.getLayers()).toEqual([]);
	});

	it('takes a marker out of the group it was in while off the map', () => {
		const group = new MarkerClusterGroup(),
			other = new MarkerClusterGroup(),
			marker = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);
		map.removeLayer(group);

		other.addLayers([marker]);
		expect(group.hasLayer(marker)).toBe(false);
		map.addLayer(group);
		map.addLayer(other);
		expect(group.getLayers()).toEqual([]);
		expect(other.getVisibleParent(marker)).toBe(marker);
	});
});
