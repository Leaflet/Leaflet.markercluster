import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';

describe('zoomAnimation', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let div, map, group;

	beforeEach(() => {
		vi.useFakeTimers();

		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		// map zoom animation runs on requestAnimationFrame, which Leaflet grabs before fake timers can replace it
		map = new L.Map(div, {maxZoom: 18, trackResize: false, zoomAnimation: false});

		// Corresponds to zoom level 8 for the above div dimensions.
		map.fitBounds(new L.LatLngBounds([
			[1, 1],
			[2, 2]
		]));
	});

	afterEach(() => {
		if (group instanceof MarkerClusterGroup) {
			group.clearLayers();
			map.removeLayer(group);
		}

		map.remove();
		document.body.removeChild(div);
		vi.useRealTimers();

		div = map = group = null;
	});

	// a computed translate value ('10px 5px', or '10px' when y is 0) as a point
	function toPoint(translate) {
		const [x, y = 0] = translate.split(' ').map(parseFloat);
		return new L.Point(x, y);
	}

	// the group skips padding the visible bounds for coarse pointers
	function setBrowserToMobile() {
		vi.stubGlobal('matchMedia', () => ({matches: true}));
	}

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('animates zooming in and out without moving the markers', () => {
		group = new MarkerClusterGroup();
		const markers = [new L.Marker([1.4, 1.4]), new L.Marker([1.6, 1.6])];
		const move = vi.fn();
		for (const m of markers) {
			m.on('move', move);
		}
		group.addLayers(markers);
		map.addLayer(group);

		const cluster = markers[0].__parent;
		expect(markers[1].__parent).toBe(cluster);
		expect(map.hasLayer(cluster)).toBe(true);

		/** @param {L.Marker} m */
		const translate = m => m.getElement().getAnimations()
			.map(a => a.effect.getKeyframes())
			.find(k => 'translate' in k[0])
			.map(k => toPoint(k.translate));
		const zero = new L.Point(0, 0);

		map.setZoom(map.getZoom() + 2);

		let clusterPos = map.latLngToLayerPoint(cluster.getLatLng()).round();
		for (const m of markers) {
			const pos = map.latLngToLayerPoint(m.getLatLng()).round();
			expect(translate(m)).toEqual([clusterPos.subtract(pos), zero]);
			expect(m.getElement().style.opacity).not.toBe('0');
		}
		vi.advanceTimersByTime(1000);
		expect(map.hasLayer(cluster)).toBe(false);

		for (const m of markers) {
			m.getElement().getAnimations().forEach(a => a.cancel());
		}
		map.setZoom(map.getZoom() - 2);

		clusterPos = map.latLngToLayerPoint(cluster.getLatLng()).round();
		for (const m of markers) {
			const pos = map.latLngToLayerPoint(m.getLatLng()).round();
			expect(translate(m)).toEqual([zero, clusterPos.subtract(pos)]);
			expect(m.getElement().style.opacity).toBe('0');
		}
		vi.advanceTimersByTime(1000);
		expect(map.hasLayer(cluster)).toBe(true);
		expect(map.hasLayer(markers[0])).toBe(false);

		expect(move).not.toHaveBeenCalled();
		expect(markers[0].getLatLng()).toEqual(new L.LatLng(1.4, 1.4));
	});

	it('adds the visible marker to the map when zooming in', () => {
		map.setView(new L.LatLng(-37.36142550190516, 174.254150390625), 7);

		group = new MarkerClusterGroup({
			showCoverageOnHover: true,
			maxClusterRadius: 20,
			disableClusteringAtZoom: 15
		});
		const marker = new L.Marker([-37.77852090603777, 175.3103667497635]);
		group.addLayer(marker); //The one we zoom in on
		group.addLayer(new L.Marker([-37.711800591811055, 174.5003479003906])); //Marker that we cluster with at the top zoom level, but not 1 level down
		map.addLayer(group);

		vi.advanceTimersByTime(1000);
		map.setView([-37.77852090603777, 175.3103667497635], 15);

		//Run the the animation
		vi.advanceTimersByTime(1000);

		expect(marker._icon).not.toBe(undefined);
		expect(marker._icon).not.toBe(null);
	});

	it('adds the visible marker to the map when jumping around', () => {

		group = new MarkerClusterGroup();
		const marker1 = new L.Marker([48.858280181884766, 2.2945759296417236]);
		const marker2 = new L.Marker([16.02359962463379, -61.70280075073242]);
		group.addLayer(marker1); //The one we zoom in on first
		group.addLayer(marker2); //Marker that we cluster with at the top zoom level, but not 1 level down
		map.addLayer(group);

		//show the first
		map.fitBounds(new L.LatLngBounds(new L.LatLng(41.371582, -5.142222), new L.LatLng(51.092804, 9.561556)));

		vi.advanceTimersByTime(1000);

		map.fitBounds(new L.LatLngBounds(new L.LatLng(15.830972671508789, -61.807167053222656), new L.LatLng(16.516849517822266, -61.0)));

		//Run the the animation
		vi.advanceTimersByTime(1000);

		//Now the second one should be visible on the map
		expect(marker2._icon).not.toBe(undefined);
		expect(marker2._icon).not.toBe(null);
	});

	it('adds the visible markers to the map, but not parent clusters when jumping around', () => {

		group = new MarkerClusterGroup();

		const marker1 = new L.Marker([59.9520, 30.3307]),
			marker2 = new L.Marker([59.9516, 30.3308]),
			marker3 = new L.Marker([59.9513, 30.3312]);

		group.addLayer(marker1);
		group.addLayer(marker2);
		group.addLayer(marker3);
		map.addLayer(group);

		//Show none of them
		map.setView([53.0676, 170.6835], 16);

		vi.advanceTimersByTime(1000);

		//Zoom so that all the markers will be visible (Same as zoomToShowLayer)
		map.setView(marker1.getLatLng(), 18);

		//Run the the animation
		vi.advanceTimersByTime(1000);

		//Now the markers should all be visible, and there should be no visible clusters
		expect(marker1._icon.parentNode).toBe(map._panes.markerPane);
		expect(marker2._icon.parentNode).toBe(map._panes.markerPane);
		expect(marker3._icon.parentNode).toBe(map._panes.markerPane);
		expect(map._panes.markerPane.childNodes.length).toBe(3);
	});

	it('removes clicked clusters on the edge of a mobile screen', () => {
		setBrowserToMobile();

		try {
			// Corresponds to zoom level 8 for the above div dimensions.
			map.fitBounds(new L.LatLngBounds([
				[1, 1],
				[2, 2]
			]));

			group = new MarkerClusterGroup({
				maxClusterRadius: 80
			}).addTo(map);

			// Add a marker 1 pixel below the initial screen bottom edge.
			const bottomPoint = map.getPixelBounds().max.add([0, 1]),
				bottomLatLng = map.unproject(bottomPoint),
				centerLng = map.getCenter().lng,
				bottomPosition = new L.LatLng(
					bottomLatLng.lat,
					centerLng
				),
				bottomMarker = new L.Marker(bottomPosition).addTo(group),
				initialZoom = map.getZoom();

			expect(bottomMarker._icon).toBe(undefined);

			// Add many markers 79 pixels above the first one, so they cluster with it.
			const newPoint = bottomPoint.add([0, -79]),
				newLatLng = new L.LatLng(
					map.unproject(newPoint).lat,
					centerLng
				);

			for (let i = 0; i < 10; i += 1) {
				group.addLayer(new L.Marker(newLatLng));
			}

			const parentCluster = bottomMarker.__parent;

			expect(parentCluster._icon.parentNode).toBe(map._panes.markerPane);

			parentCluster.fire('click', null, true);

			//Run the the animation
			vi.advanceTimersByTime(1000);

			expect(map.getZoom()).toBe(initialZoom + 1); // The fitBounds with 200px height should result in zooming 1 level in.

			// Finally make sure that the cluster has been removed from map.
			expect(parentCluster._icon).toBe(null);
			expect(map._panes.markerPane.childNodes.length).toBe(2); // The bottomMarker + cluster for the 10 above markers.
		} finally {
			vi.unstubAllGlobals();
		}
	});

	describe('zoomToShowLayer', () => {

		it('zoom to single marker inside map view', () => {
			group = new MarkerClusterGroup();

			const marker = new L.Marker([59.9520, 30.3307]);

			group.addLayer(marker);
			map.addLayer(group);

			const zoomCallbackSpy = vi.fn();

			map.setView(marker.getLatLng(), 10);

			vi.advanceTimersByTime(1000);

			const initialCenter = map.getCenter();
			const initialZoom = map.getZoom();

			group.zoomToShowLayer(marker, zoomCallbackSpy);

			//Run the the animation
			vi.advanceTimersByTime(1000);

			//Marker should be visible, map center and zoom level should stay the same, callback called once
			expect(marker._icon).not.toBe(undefined);
			expect(marker._icon).not.toBe(null);
			expect(map.getBounds().contains(marker.getLatLng())).toBe(true);
			expect(map.getCenter()).toEqual(initialCenter);
			expect(map.getZoom()).toBe(initialZoom);
			expect(zoomCallbackSpy).toHaveBeenCalledOnce();
		});

		it('pan map to single marker outside map view', () => {
			group = new MarkerClusterGroup();

			const marker = new L.Marker([59.9520, 30.3307]);

			group.addLayer(marker);
			map.addLayer(group);

			const zoomCallbackSpy = vi.fn();

			//Show none of them
			map.setView([53.0676, 170.6835], 16);

			vi.advanceTimersByTime(1000);

			const initialZoom = map.getZoom();

			group.zoomToShowLayer(marker, zoomCallbackSpy);

			//Run the the animation
			vi.advanceTimersByTime(1000);

			//Marker should be visible, map center should be equal to marker center,
			//zoom level should stay the same, callback called once
			expect(marker._icon).not.toBe(undefined);
			expect(marker._icon).not.toBe(null);
			expect(map.getBounds().contains(marker.getLatLng())).toBe(true);
			expect(map.getCenter()).toEqual(marker.getLatLng());
			expect(map.getZoom()).toBe(initialZoom);
			expect(zoomCallbackSpy).toHaveBeenCalledOnce();
		});

		it('change view and zoom to marker in cluster inside map view', () => {
			group = new MarkerClusterGroup();

			const marker1 = new L.Marker([59.9520, 30.3307]);
			const marker2 = new L.Marker([59.9516, 30.3308]);
			const marker3 = new L.Marker([59.9513, 30.3312]);

			group.addLayer(marker1);
			group.addLayer(marker2);
			group.addLayer(marker3);
			map.addLayer(group);

			const zoomCallbackSpy = vi.fn();

			map.setView(marker1.getLatLng(), 16);

			vi.advanceTimersByTime(1000);

			group.zoomToShowLayer(marker1, zoomCallbackSpy);

			//Run the the animation
			vi.advanceTimersByTime(1000);

			//Now the markers should all be visible, there should be no visible clusters, and callback called once
			expect(marker1._icon.parentNode).toBe(map._panes.markerPane);
			expect(marker2._icon.parentNode).toBe(map._panes.markerPane);
			expect(marker3._icon.parentNode).toBe(map._panes.markerPane);
			expect(map._panes.markerPane.childNodes.length).toBe(3);
			expect(map.getBounds().contains(marker1.getLatLng())).toBe(true);
			expect(zoomCallbackSpy).toHaveBeenCalledOnce();
		});

		it('change view and zoom to marker in cluster outside map view', () => {
			group = new MarkerClusterGroup();

			const marker1 = new L.Marker([59.9520, 30.3307]);
			const marker2 = new L.Marker([59.9516, 30.3308]);
			const marker3 = new L.Marker([59.9513, 30.3312]);

			group.addLayer(marker1);
			group.addLayer(marker2);
			group.addLayer(marker3);
			map.addLayer(group);

			const zoomCallbackSpy = vi.fn();

			//Show none of them
			map.setView([53.0676, 170.6835], 16);

			vi.advanceTimersByTime(1000);

			group.zoomToShowLayer(marker1, zoomCallbackSpy);

			//Run the the animation
			vi.advanceTimersByTime(1000);

			//Now the markers should all be visible, there should be no visible clusters, and callback called once
			expect(marker1._icon.parentNode).toBe(map._panes.markerPane);
			expect(marker2._icon.parentNode).toBe(map._panes.markerPane);
			expect(marker3._icon.parentNode).toBe(map._panes.markerPane);
			expect(map._panes.markerPane.childNodes.length).toBe(3);
			expect(map.getBounds().contains(marker1.getLatLng())).toBe(true);
			expect(zoomCallbackSpy).toHaveBeenCalledOnce();
		});

		it('spiderfy overlapping markers', () => {
			group = new MarkerClusterGroup();

			const marker1 = new L.Marker([59.9520, 30.3307]);
			const marker2 = new L.Marker([59.9520, 30.3307]);
			const marker3 = new L.Marker([59.9520, 30.3307]);

			group.addLayer(marker1);
			group.addLayer(marker2);
			group.addLayer(marker3);
			map.addLayer(group);

			const zoomCallbackSpy = vi.fn();

			//Show none of them
			map.setView([53.0676, 170.6835], 16);

			vi.advanceTimersByTime(1000);

			group.zoomToShowLayer(marker1, zoomCallbackSpy);

			//Run the the animation
			vi.advanceTimersByTime(1000);

			//Now the markers should all be visible, parent cluster should be spiderfied, and callback called once
			expect(marker1._icon.parentNode).toBe(map._panes.markerPane);
			expect(marker2._icon.parentNode).toBe(map._panes.markerPane);
			expect(marker3._icon.parentNode).toBe(map._panes.markerPane);
			expect(map._panes.markerPane.childNodes.length).toBe(4);//3 markers + spiderfied parent cluster
			expect(zoomCallbackSpy).toHaveBeenCalledOnce();
		});

		it('zoom or spiderfy markers if they visible on next level of zoom', () => {
			group = new MarkerClusterGroup();

			const marker1 = new L.Marker([59.9520, 30.3307]);
			const marker2 = new L.Marker([59.9516, 30.3308]);
			const marker3 = new L.Marker([59.9513, 30.3312]);

			group.addLayer(marker1);
			group.addLayer(marker2);
			group.addLayer(marker3);
			map.addLayer(group);

			const zoomCallbackSpy = vi.fn();

			//Markers will be visible on zoom 18
			map.setView([59.9520, 30.3307], 17);

			vi.advanceTimersByTime(1000);

			group.zoomToShowLayer(marker1, zoomCallbackSpy);

			//Run the the animation
			vi.advanceTimersByTime(1000);

			//Now the markers should all be visible (zoomed or spiderfied), and callback called once
			expect(marker1._icon).not.toBe(undefined);
			expect(marker1._icon).not.toBe(null);
			expect(marker2._icon).not.toBe(undefined);
			expect(marker2._icon).not.toBe(null);
			expect(marker3._icon).not.toBe(undefined);
			expect(marker3._icon).not.toBe(null);
			expect(zoomCallbackSpy).toHaveBeenCalledOnce();
		});

		it('zoom and executes callback even for non-icon-based Marker', () => {
			group = new MarkerClusterGroup();

			const marker1 = new L.CircleMarker([59.9520, 30.3307]);
			const marker2 = new L.CircleMarker([59.9516, 30.3308]);
			const marker3 = new L.CircleMarker([59.9513, 30.3312]);

			group.addLayer(marker1);
			group.addLayer(marker2);
			group.addLayer(marker3);
			map.addLayer(group);

			const zoomCallbackSpy = vi.fn();

			//Markers will be visible on zoom 18
			map.setView([59.9520, 30.3307], 16);

			vi.advanceTimersByTime(1000);

			expect(map.hasLayer(marker1)).toBe(false);
			expect(map.hasLayer(marker2)).toBe(false);
			expect(map.hasLayer(marker3)).toBe(false);

			group.zoomToShowLayer(marker1, zoomCallbackSpy);

			//Run the the animation
			vi.advanceTimersByTime(1000);

			//Now the markers should all be visible (zoomed or spiderfied), and callback called once
			expect(map.hasLayer(marker1)).toBe(true);
			expect(map.hasLayer(marker2)).toBe(true);
			expect(map.hasLayer(marker3)).toBe(true);
			expect(zoomCallbackSpy).toHaveBeenCalledOnce();
		});
	});
});
