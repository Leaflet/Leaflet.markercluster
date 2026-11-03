import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('singleMarkerMode option', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let div, map, group, defaultIcon, clusterIcon, marker;

	beforeEach(() => {
		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = L.map(div, {maxZoom: 18, trackResize: false});

		// Corresponds to zoom level 8 for the above div dimensions.
		map.fitBounds(new L.LatLngBounds([
			[1, 1],
			[2, 2]
		]));

		defaultIcon = new L.Icon.Default();
		clusterIcon = new L.Icon.Default();
		marker = L.marker([1.5, 1.5]);
		marker.setIcon(defaultIcon);
	});

	afterEach(() => {
		if (group instanceof L.MarkerClusterGroup) {
			group.removeLayers(group.getLayers());
			map.removeLayer(group);
		}

		map.remove();
		div.remove();

		div = map = group = defaultIcon = clusterIcon = marker = null;
	});

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('overrides marker icons when set to true', () => {

		group = L.markerClusterGroup({
			singleMarkerMode: true,
			iconCreateFunction() {
				return clusterIcon;
			}
		}).addTo(map);

		expect(marker.options.icon).toBe(defaultIcon);

		marker.addTo(group);

		expect(marker.options.icon).toBe(clusterIcon);

	});

	it('does not modify marker icons by default (or set to false)', () => {

		group = L.markerClusterGroup({
			iconCreateFunction() {
				return clusterIcon;
			}
		}).addTo(map);

		expect(marker.options.icon).toBe(defaultIcon);

		marker.addTo(group);

		expect(marker.options.icon).toBe(defaultIcon);

	});
});
