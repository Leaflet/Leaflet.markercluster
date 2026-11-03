import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('Remember opacity', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let map, div, markers, group;

	const markerDefs = [
		{latLng: [0, 0], opts: {opacity: 0.9}},
		{latLng: [0, 1], opts: {opacity: 0.5}},
		{latLng: [0, -1], opts: {opacity: 0.5}},
		{latLng: [1, 0], opts: {opacity: 0.5}},
		{latLng: [-1, 0], opts: {opacity: 0.5}},
		{latLng: [1, 1], opts: {opacity: 0.2}},
		{latLng: [1, -1], opts: {opacity: 0.2}},
		{latLng: [-1, 1], opts: {opacity: 0.2}},
		{latLng: [-1, -1], opts: {opacity: 0.2}}
	];

	const bounds = L.latLngBounds(L.latLng(-1.1, -1.1),
		L.latLng(1.1,  1.1));

	beforeEach(() => {
		vi.useFakeTimers();

		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = L.map(div, {maxZoom: 18, trackResize: false});

		markers = [];
		for (let i = 0; i < markerDefs.length; i++) {
			markers.push(L.marker(markerDefs[i].latLng, markerDefs[i].opts));
		}
	});

	afterEach(() => {
		group.clearLayers();
		map.removeLayer(group);
		map.remove();
		document.body.removeChild(div);
		vi.useRealTimers();

		div = map = markers = group = null;
	});

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('clusters semitransparent markers into an opaque one', () => {
		map.setView(new L.LatLng(0, 0), 1);

		group = new L.MarkerClusterGroup({
			maxClusterRadius: 20
		});
		group.addLayers(markers);
		map.addLayer(group);

		const visibleClusters = group._featureGroup.getLayers();
		expect(visibleClusters.length).toBe(1);
		expect(visibleClusters[0].options.opacity).toBe(1);
	});


	it('unclusters an opaque marker into semitransparent ones', () => {
		map.setView(new L.LatLng(0, 0), 1);
		let visibleClusters;

		group = new L.MarkerClusterGroup({
			maxClusterRadius: 20
		});
		group.addLayers(markers);
		map.addLayer(group);

		map.fitBounds(bounds);
		vi.advanceTimersByTime(1000);

		visibleClusters = group._featureGroup.getLayers();
		expect(visibleClusters.length).toBe(9);
		for (let i = 0; i < 9; i++) {
			expect(visibleClusters[i].options.opacity).toBeGreaterThanOrEqual(0.2);
			expect(visibleClusters[i].options.opacity).toBeLessThanOrEqual(0.9);
		}

		// It shall also work after zooming in/out a second time.
		map.setView(new L.LatLng(0, 0), 1);
		vi.advanceTimersByTime(1000);

		map.fitBounds(bounds);
		vi.advanceTimersByTime(1000);

		visibleClusters = group._featureGroup.getLayers();
		expect(visibleClusters.length).toBe(9);
		for (let i = 0; i < 9; i++) {
			expect(visibleClusters[i].options.opacity).toBeGreaterThanOrEqual(0.2);
			expect(visibleClusters[i].options.opacity).toBeLessThanOrEqual(0.9);
		}
	});


	it('has no problems zooming in and out several times', () => {
		let visibleClusters;

		group = new L.MarkerClusterGroup({
			maxClusterRadius: 20
		});
		group.addLayers(markers);
		map.addLayer(group);

		// Zoom in and out a couple times
		for (let i = 0; i < 10; i++) {
			map.fitBounds(bounds);
			vi.advanceTimersByTime(1000);

			visibleClusters = group._featureGroup.getLayers();
			expect(visibleClusters.length).toBe(9);
			for (let i = 0; i < 9; i++) {
				expect(visibleClusters[i].options.opacity).toBeGreaterThanOrEqual(0.2);
				expect(visibleClusters[i].options.opacity).toBeLessThanOrEqual(0.9);
			}

			map.setView(new L.LatLng(0, 0), 1);
			vi.advanceTimersByTime(1000);

			visibleClusters = group._featureGroup.getLayers();
			expect(visibleClusters.length).toBe(1);
			expect(visibleClusters[0].options.opacity).toBe(1);
		}

	});

	it('retains the opacity of each individual marker', () => {
		map.setView(new L.LatLng(0, 0), 1);

		let visibleClusters;
		group = new L.MarkerClusterGroup({
			maxClusterRadius: 20
		});
		group.addLayers(markers);
		map.addLayer(group);


		// Zoom in and out a couple times
		for (let i = 0; i < 5; i++) {
			map.fitBounds(bounds);
			vi.advanceTimersByTime(1000);

			map.setView(new L.LatLng(0, 0), 1);
			vi.advanceTimersByTime(1000);
		}

		for (let i = 0; i < markerDefs.length; i++) {

			// 			console.log(markerDefs[i].latLng, markerDefs[i].opts.opacity);

			map.setView(L.latLng(markerDefs[i].latLng), 18);
			vi.advanceTimersByTime(1000);
			visibleClusters = group._featureGroup.getLayers();
			expect(visibleClusters.length).toBe(1);
			expect(visibleClusters[0].options.opacity).toBe(markerDefs[i].opts.opacity);
		}
	});

});
