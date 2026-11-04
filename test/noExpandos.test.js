import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

describe('state on markers', () => {
	let div, map;

	beforeEach(() => {
		vi.useFakeTimers();
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
		vi.useRealTimers();
	});

	it('leaves no fields on markers in clusters beyond event listeners', () => {
		const group = new MarkerClusterGroup().addTo(map);
		const markers = [new L.Marker([1.5, 1.5]), new L.Marker([1.5, 1.5]), new L.CircleMarker([1.5, 1.5]), new L.Marker([1.5, 1.5])];
		const keys = markers.map(m => Object.keys(m));

		group.addLayers(markers);
		group.addLayer(new L.Marker([1.5, 1.5]));
		group.removeLayers([markers[3]]);
		group.refreshClusters();

		// 2.0 creates _events in the constructor, 1.9 on the first listener
		markers.slice(0, 3).forEach((m, i) => {
			expect(Object.keys(m).filter(k => !keys[i].includes(k) && k !== '_events')).toEqual([]);
		});
	});
});
