import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

describe('getParent', () => {
	let group, map, div;

	beforeEach(() => {
		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = new L.Map(div, {maxZoom: 18, trackResize: false});
		map.fitBounds(new L.LatLngBounds([[1, 1], [2, 2]]));
		group = new MarkerClusterGroup();
	});

	afterEach(() => {
		group.clearLayers();
		map.removeLayer(group);
		map.remove();
		div.remove();

		group = map = div = null;
	});

	it('walks up from a marker to the cluster at the lowest zoom', () => {
		const marker = new L.Marker([1.5, 1.5]),
			marker2 = new L.Marker([1.5, 1.5]);
		group.addLayers([marker, marker2]);
		map.addLayer(group);

		let cluster = group.getParent(marker);
		expect(cluster._zoom).toBe(18);
		expect(cluster.getAllChildMarkers()).toContain(marker);

		const zooms = [];
		while (cluster) {
			zooms.push(cluster._zoom);
			cluster = group.getParent(cluster);
		}
		expect(zooms).toEqual(Array.from({length: 19}, (_, i) => 18 - i));
	});

	it('returns null for a marker that is not in a cluster', () => {
		const lone = new L.Marker([1.5, 1.5]),
			pending = new L.Marker([1.5, 1.5]),
			other = new L.Marker([1.5, 1.5]);
		group.addLayer(lone);
		map.addLayer(group);
		new MarkerClusterGroup().addLayers([other, new L.Marker([1.5, 1.5])]);
		map.removeLayer(group);
		group.addLayer(pending);

		expect(group.getParent(lone)).toBe(null);
		expect(group.getParent(pending)).toBe(null);
		expect(group.getParent(other)).toBe(null);
		map.addLayer(group);
		expect(group.getParent(pending)).not.toBe(null);
	});
});
