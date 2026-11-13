import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

describe('zoomToBounds', () => {
	let div, map;

	beforeEach(() => {
		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = new L.Map(div, {maxZoom: 18, trackResize: false, zoomAnimation: false}).setView([1.5, 1.5], 10);
	});

	afterEach(() => {
		map.remove();
		div.remove();
	});

	it('zooms in with padding that leaves no room for the cluster at a higher zoom', () => {
		// 70px wide: fits the 200px map at the next zoom, but not the 50px left by the padding
		const markers = [70, 135, 140].map(x => new L.Marker(map.containerPointToLatLng([x, 100])));
		const group = new MarkerClusterGroup().addLayers(markers);
		map.addLayer(group);

		const cluster = group.getVisibleParent(markers[0]);
		expect(cluster.getChildCount()).toBe(3);

		cluster.zoomToBounds({paddingBottomRight: [150, 0]});
		expect(map.getZoom()).toBe(11);
	});
});
