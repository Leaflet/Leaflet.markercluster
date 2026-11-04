import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

describe('map zoom range changes', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let div, map, group;

	beforeEach(() => {
		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = new L.Map(div, {minZoom: 6, maxZoom: 12, trackResize: false}).setView([1.5, 1.5], 8);
		group = new MarkerClusterGroup({animate: false, removeOutsideVisibleBounds: false});
	});

	afterEach(() => {
		map.remove();
		div.remove();
		div = map = group = null;
	});

	// markers 0.05° apart in a row, with one pair that only splits past zoom 12
	function addMarkers() {
		const markers = [];
		for (let i = 0; i < 5; i++) {
			markers.push(new L.Marker([1.5, 1.4 + i * 0.05]));
		}
		markers.push(new L.Marker([1.6, 1.6]), new L.Marker([1.6, 1.601]));
		group.addLayers(markers);
		return markers;
	}

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('clusters at a lower minZoom', () => {
		map.addLayer(group);
		const markers = addMarkers();

		map.setMinZoom(2);
		map.setZoom(2);
		expect(group.getVisibleParent(markers[0]).getChildCount()).toBe(7);

		group.removeLayer(markers[0]);
		expect(group.getVisibleParent(markers[1]).getChildCount()).toBe(6);
		expect(group.getLayers().length).toBe(6);
	});

	it('splits clusters at a higher maxZoom', () => {
		map.addLayer(group);
		const markers = addMarkers();

		map.setMaxZoom(18);
		map.setZoom(18);
		expect(group.getVisibleParent(markers[5])).toBe(markers[5]);
		expect(group.getVisibleParent(markers[6])).toBe(markers[6]);
	});

	it('follows the zoom range of tile layers', () => {
		map.remove();
		map = new L.Map(div, {trackResize: false}).setView([1.5, 1.5], 8);
		const tiles = new L.TileLayer('', {minZoom: 6, maxZoom: 12}).addTo(map);
		map.addLayer(group);
		const markers = addMarkers();

		new L.TileLayer('', {minZoom: 0, maxZoom: 18}).addTo(map);
		map.removeLayer(tiles);
		map.setZoom(0);
		expect(group.getVisibleParent(markers[0]).getChildCount()).toBe(7);
		map.setZoom(18);
		expect(group.getVisibleParent(markers[6])).toBe(markers[6]);
	});

	it('clusters again when the range changed while off the map', () => {
		map.addLayer(group);
		const markers = addMarkers();
		map.removeLayer(group);

		map.setMinZoom(2);
		map.setZoom(2);
		map.addLayer(group);
		expect(group.getVisibleParent(markers[0]).getChildCount()).toBe(7);
		expect(group.getLayers().length).toBe(7);
	});

	it('keeps the clusters when the range with clusters stays the same', () => {
		group.options.disableClusteringAtZoom = 10;
		map.addLayer(group);
		const markers = addMarkers(),
			cluster = group.getVisibleParent(markers[5]);

		map.setMaxZoom(18);
		expect(group.getVisibleParent(markers[5])).toBe(cluster);
	});
});
