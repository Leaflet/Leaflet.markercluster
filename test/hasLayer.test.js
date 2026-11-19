import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

describe('hasLayer', () => {
	let map, div;

	beforeEach(() => {
		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = new L.Map(div, {maxZoom: 18, trackResize: false});
		map.fitBounds(new L.LatLngBounds([[1, 1], [2, 2]]));
	});

	afterEach(() => {
		map.remove();
		div.remove();
	});

	it('finds layers by id', () => {
		const group = new MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);
		group.addLayer(marker);

		expect(group.hasLayer(L.Util.stamp(marker))).toBe(true);
		expect(group.hasLayer(L.Util.stamp(new L.Marker([1.5, 1.5])))).toBe(false);
	});

	it.each([false, true])('has an added GeoJSON group as long as it has all its layers (on the map: %s)', (onMap) => {
		const group = new MarkerClusterGroup();
		if (onMap) {
			map.addLayer(group);
		}
		const geojson = new L.GeoJSON({type: 'FeatureCollection', features: [
			{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [1.5, 1.5]}},
			{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [1.6, 1.6]}},
			{type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[1, 1], [2, 2]]}}
		]});

		expect(group.hasLayer(geojson)).toBe(false);
		group.addLayer(geojson);
		expect(group.hasLayer(geojson)).toBe(true);

		group.removeLayer(geojson.getLayers()[0]);
		expect(group.hasLayer(geojson)).toBe(false);

		group.addLayer(geojson.getLayers()[0]);
		group.removeLayer(geojson.getLayers()[2]);
		expect(group.hasLayer(geojson)).toBe(false);
	});

	it('has nested groups, but not empty ones', () => {
		const group = new MarkerClusterGroup();
		const inner = new L.LayerGroup([new L.Marker([1.5, 1.5])]);
		const outer = new L.LayerGroup([inner, new L.Marker([1.6, 1.6])]);
		group.addLayer(outer);

		expect(group.hasLayer(outer)).toBe(true);
		expect(group.hasLayer(inner)).toBe(true);
		expect(group.hasLayer(new L.LayerGroup())).toBe(false);
	});
});
