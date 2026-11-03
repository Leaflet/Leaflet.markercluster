import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('support child markers changing icon', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let map, div;

	beforeEach(() => {
		vi.useFakeTimers();

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
		map.remove();
		document.body.removeChild(div);
		vi.useRealTimers();

		map = div = null;
	});

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('child markers end up with the right icon after becoming unclustered', () => {

		const group = new L.MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5], {icon: new L.DivIcon({html: 'Inner1Text'})});
		const marker2 = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);

		expect(marker._icon.parentNode).toBe(map._panes.markerPane);
		expect(marker._icon.innerHTML).toContain('Inner1Text');

		group.addLayer(marker2);

		expect(marker._icon).toBe(null); //Have been removed from the map

		marker.setIcon(new L.DivIcon({html: 'Inner2Text'})); //Change the icon

		group.removeLayer(marker2); //Remove the other marker, so we'll become unclustered

		expect(marker._icon.innerHTML).toContain('Inner2Text');
	});
});
