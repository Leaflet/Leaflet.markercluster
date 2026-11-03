import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('addLayer adding multiple markers', () => {
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
	it('creates a cluster when 2 overlapping markers are added before the group is added to the map', () => {

		const group = new L.MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayer(marker);
		group.addLayer(marker2);
		map.addLayer(group);

		expect(marker._icon).toBe(undefined);
		expect(marker2._icon).toBe(undefined);

		expect(map._panes.markerPane.childNodes.length).toBe(1);
	});
	it('creates a cluster when 2 overlapping markers are added after the group is added to the map', () => {

		const group = new L.MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);
		group.addLayer(marker2);

		expect(marker._icon).toBe(null); //Null as was added and then removed
		expect(marker2._icon).toBe(undefined);

		expect(map._panes.markerPane.childNodes.length).toBe(1);
	});
	it('creates a cluster with an animation when 2 overlapping markers are added after the group is added to the map', () => {

		const group = new L.MarkerClusterGroup({animateAddingMarkers: true});
		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);
		group.addLayer(marker2);

		expect(marker._icon.parentNode).toBe(map._panes.markerPane);
		expect(marker2._icon.parentNode).toBe(map._panes.markerPane);

		expect(map._panes.markerPane.childNodes.length).toBe(3);

		//Run the the animation
		vi.advanceTimersByTime(1000);

		//Then markers should be removed from map
		expect(marker._icon).toBe(null);
		expect(marker2._icon).toBe(null);

		expect(map._panes.markerPane.childNodes.length).toBe(1);
	});

	it('creates a cluster and marker when 2 overlapping markers and one non-overlapping are added before the group is added to the map', () => {

		const group = new L.MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);
		const marker3 = new L.Marker([3.0, 1.5]);

		group.addLayer(marker);
		group.addLayer(marker2);
		group.addLayer(marker3);
		map.addLayer(group);

		expect(marker._icon).toBe(undefined);
		expect(marker2._icon).toBe(undefined);
		expect(marker3._icon.parentNode).toBe(map._panes.markerPane);

		expect(map._panes.markerPane.childNodes.length).toBe(2);
	});
	it('creates a cluster and marker when 2 overlapping markers and one non-overlapping are added after the group is added to the map', () => {

		const group = new L.MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);
		const marker3 = new L.Marker([3.0, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);
		group.addLayer(marker2);
		group.addLayer(marker3);

		expect(marker._icon).toBe(null); //Null as was added and then removed
		expect(marker2._icon).toBe(undefined);
		expect(marker3._icon.parentNode).toBe(map._panes.markerPane);

		expect(map._panes.markerPane.childNodes.length).toBe(2);
	});

	it('unspiderfies before adding a new Marker', () => {

		const group = new L.MarkerClusterGroup();

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

		group.addLayer(marker3);
		//Run the the animation
		vi.advanceTimersByTime(1000);

		expect(marker._icon).toBe(null);
		expect(marker2._icon).toBe(null);
		expect(marker3._icon).toBe(undefined);
		expect(marker3.__parent._icon).not.toBe(undefined);
		expect(marker3.__parent._icon).not.toBe(null);
		expect(marker3.__parent._icon.innerText.trim()).toBe('3');
	});
});
