import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('getVisibleParent', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let group, map, div;

	beforeEach(() => {
		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = L.map(div, {maxZoom: 18, trackResize: false});

		map.fitBounds(new L.LatLngBounds([
			[1, 1],
			[2, 2]
		]));
	});

	afterEach(() => {
		group.clearLayers();
		map.removeLayer(group);
		map.remove();
		document.body.removeChild(div);

		group = map = div = null;
	});

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('gets the marker if the marker is visible', () => {
		group = new L.MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);

		group.addLayer(marker);
		map.addLayer(group);

		const vp = group.getVisibleParent(marker);

		expect(vp).toBe(marker);
	});

	it('gets the visible cluster if it is clustered', () => {
		group = new L.MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		const vp = group.getVisibleParent(marker);

		expect(vp).toBeInstanceOf(L.MarkerCluster);
		expect(vp._icon).not.toBe(null);
		expect(vp._icon).not.toBe(undefined);
	});

	it('returns null if the marker and parents are all not visible', () => {
		group = new L.MarkerClusterGroup();
		const marker = new L.Marker([5.5, 1.5]);
		const marker2 = new L.Marker([5.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		const vp = group.getVisibleParent(marker);

		expect(vp).toBe(null);
	});
});
