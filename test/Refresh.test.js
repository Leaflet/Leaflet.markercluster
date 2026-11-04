import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';
import {parents} from '../src/MarkerCluster.js';

describe('refreshClusters', () => {
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

		map = new L.Map(div, {maxZoom: 18, trackResize: false});

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
		div.remove();
		vi.useRealTimers();

		div = map = group = null;
	});

	function getClusterAtZoom(marker, zoom) {
		let parent = parents.get(marker);

		while (parent && parent._zoom !== zoom) {
			parent = parent._parent;
		}

		return parent;
	}

	function setMapView() {
		// Now look at the markers to force cluster icons drawing.
		// Corresponds to zoom level 8 for the above div dimensions.
		map.fitBounds(new L.LatLngBounds([
			[1, 1],
			[2, 2]
		]));
	}

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('flags all non-visible parent clusters of a given marker', () => {

		group = new MarkerClusterGroup().addTo(map);

		const marker1 = new L.Marker([1.5, 1.5]).addTo(group);
		new L.Marker([1.5, 1.5]).addTo(group); // Needed to force a cluster.

		setMapView();

		const marker1cluster10 = getClusterAtZoom(marker1, 10),
			marker1cluster2 = getClusterAtZoom(marker1, 2),
			marker1cluster5 = getClusterAtZoom(marker1, 5);

		// First go to some zoom levels so that Leaflet initializes clusters icons.
		expect(marker1cluster10._iconNeedsUpdate).toBeTruthy();
		map.setZoom(10, {animate: false});
		expect(marker1cluster10._iconNeedsUpdate).toBeFalsy();

		expect(marker1cluster2._iconNeedsUpdate).toBeTruthy();
		map.setZoom(2, {animate: false});
		expect(marker1cluster2._iconNeedsUpdate).toBeFalsy();

		// Finish on an intermediate zoom level.
		expect(marker1cluster5._iconNeedsUpdate).toBeTruthy();
		map.setZoom(5, {animate: false});
		expect(marker1cluster5._iconNeedsUpdate).toBeFalsy();

		// Run any animation.
		vi.advanceTimersByTime(1000);

		// Then request clusters refresh.
		// No need to actually modify the marker.
		group.refreshClusters(marker1);

		// Now check that non-visible clusters are flagged as "dirty".
		expect(marker1cluster10._iconNeedsUpdate).toBeTruthy();
		expect(marker1cluster2._iconNeedsUpdate).toBeTruthy();

		// Also check that visible clusters are "un-flagged" since they should be re-drawn.
		expect(marker1cluster5._iconNeedsUpdate).toBeFalsy();

	});

	it('refreshes the clusters of a marker from refreshIconOptions', () => {
		group = new MarkerClusterGroup().addTo(map);
		const marker = new L.Marker([1.5, 1.5]).addTo(group);
		new L.Marker([1.5, 1.5]).addTo(group);

		map.setZoom(10, {animate: false});
		const cluster = getClusterAtZoom(marker, 10);
		expect(cluster._iconNeedsUpdate).toBeFalsy();
		map.setZoom(5, {animate: false});
		vi.advanceTimersByTime(1000);

		marker.refreshIconOptions({className: 'foo'});
		expect(cluster._iconNeedsUpdate).toBeFalsy();

		marker.refreshIconOptions({className: 'bar'}, true);
		expect(cluster._iconNeedsUpdate).toBeTruthy();
		expect(marker.options.icon.options.className).toBe('bar');
	});

	it('re-draws visible clusters', () => {

		group = new MarkerClusterGroup({
			iconCreateFunction(cluster) {
				const markers = cluster.getAllChildMarkers();

				for (const i in markers) {
					if (markers[i].changed) {
						return new L.DivIcon({
							className: 'changed'
						});
					}
				}
				return new L.DivIcon({
					className: 'original'
				});
			}
		}).addTo(map);

		const marker1 = new L.Marker([1.5, 1.5]).addTo(group);
		new L.Marker([1.5, 1.5]).addTo(group); // Needed to force a cluster.

		setMapView();

		const marker1cluster9 = getClusterAtZoom(marker1, 9);

		// First go to some zoom levels so that Leaflet initializes clusters icons.
		expect(marker1cluster9._iconNeedsUpdate).toBeTruthy();
		map.setZoom(9, {animate: false});
		expect(marker1cluster9._iconNeedsUpdate).toBeFalsy();

		expect(marker1cluster9._icon.className).toContain('original');
		expect(marker1cluster9._icon.className).not.toContain('changed');

		// Run any animation.
		vi.advanceTimersByTime(1000);

		// Alter the marker.
		marker1.changed = true;

		// Then request clusters refresh.
		group.refreshClusters(marker1);

		// Now check that visible clusters icon is re-drawn.
		expect(marker1cluster9._icon.className).toContain('changed');
		expect(marker1cluster9._icon.className).not.toContain('original');

	});

	// Shared code for the 2 below tests
	function iconCreateFunction(cluster) {
		const markers = cluster.getAllChildMarkers();

		for (const i in markers) {
			if (markers[i].changed) {
				return new L.DivIcon({
					className: 'changed'
				});
			}
		}
		return new L.DivIcon({
			className: 'original'
		});
	}

	it('re-draws markers in singleMarkerMode', () => {

		group = new MarkerClusterGroup({
			singleMarkerMode: true,
			iconCreateFunction
		}).addTo(map);

		const marker1 = new L.Marker([1.5, 1.5]).addTo(group);

		setMapView();

		expect(marker1._icon.className).toContain('original');

		// Alter the marker.
		marker1.changed = true;

		// Then request clusters refresh.
		group.refreshClusters(marker1);

		expect(marker1._icon.className).toContain('changed');
		expect(marker1._icon.className).not.toContain('original');

	});

	it('does not modify markers that do not belong to the current group (in singleMarkerMode)', () => {

		group = new MarkerClusterGroup({
			singleMarkerMode: true,
			iconCreateFunction
		}).addTo(map);

		const marker1 = new L.Marker([1.5, 1.5]).addTo(group);
		const marker2 = new L.Marker([1.5, 1.5], {
			icon: iconCreateFunction({
				getAllChildMarkers() {
					return [];
				}
			})
		}).addTo(map);

		setMapView();

		expect(marker1._icon.className).toContain('original');
		expect(marker2._icon.className).toContain('original');

		// Alter the markers.
		marker1.changed = true;
		marker2.changed = true;

		// Then request clusters refresh.
		group.refreshClusters([marker1, marker2]);

		expect(marker1._icon.className).toContain('changed');
		expect(marker1._icon.className).not.toContain('original');

		expect(marker2._icon.className).toContain('original');
		expect(marker2._icon.className).not.toContain('changed');

	});


	// Shared code for below tests.
	const marker1 = new L.Marker([1.5, 1.5]),
		marker2 = new L.Marker([1.5, 1.5]), // Needed to force a cluster.
		marker3 = new L.Marker([1.1, 1.1]),
		marker4 = new L.Marker([1.1, 1.1]), // Needed to force a cluster.
		marker5 = new L.Marker([1.9, 1.9]),
		marker6 = new L.Marker([1.9, 1.9]); // Needed to force a cluster.
	let marker1cluster8,
		marker1cluster3,
		marker1cluster5,
		marker3cluster8,
		marker3cluster3,
		marker3cluster5,
		marker5cluster8,
		marker5cluster3,
		marker5cluster5;

	function init3clusterBranches() {

		group = new MarkerClusterGroup({
			maxClusterRadius: 2 // Make sure we keep distinct clusters.
		}).addTo(map);

		// Populate Marker Cluster Group.
		marker1.addTo(group);
		marker2.addTo(group);
		marker3.addTo(group);
		marker4.addTo(group);
		marker5.addTo(group);
		marker6.addTo(group);

		setMapView();

		marker1cluster8 = getClusterAtZoom(marker1, 8);
		marker1cluster3 = getClusterAtZoom(marker1, 3);
		marker1cluster5 = getClusterAtZoom(marker1, 5);
		marker3cluster8 = getClusterAtZoom(marker3, 8);
		marker3cluster3 = getClusterAtZoom(marker3, 3);
		marker3cluster5 = getClusterAtZoom(marker3, 5);
		marker5cluster8 = getClusterAtZoom(marker5, 8);
		marker5cluster3 = getClusterAtZoom(marker5, 3);
		marker5cluster5 = getClusterAtZoom(marker5, 5);

		// Make sure we have 3 distinct clusters up to zoom level Z (let's choose Z = 3)
		expect(marker1cluster3._childCount).toBe(2);
		expect(marker3cluster3._childCount).toBe(2);
		expect(marker5cluster3._childCount).toBe(2);

		// First go to some zoom levels so that Leaflet initializes clusters icons.
		expect(marker1cluster8._iconNeedsUpdate).toBeFalsy();
		expect(marker3cluster8._iconNeedsUpdate).toBeFalsy();
		expect(marker5cluster8._iconNeedsUpdate).toBeFalsy();

		expect(marker1cluster3._iconNeedsUpdate).toBeTruthy();
		expect(marker3cluster3._iconNeedsUpdate).toBeTruthy();
		expect(marker5cluster3._iconNeedsUpdate).toBeTruthy();
		map.setZoom(3, {animate: false});
		expect(marker1cluster3._iconNeedsUpdate).toBeFalsy();
		expect(marker3cluster3._iconNeedsUpdate).toBeFalsy();
		expect(marker5cluster3._iconNeedsUpdate).toBeFalsy();

		// Finish on an intermediate zoom level.
		expect(marker1cluster5._iconNeedsUpdate).toBeTruthy();
		expect(marker3cluster5._iconNeedsUpdate).toBeTruthy();
		expect(marker5cluster5._iconNeedsUpdate).toBeTruthy();
		map.setZoom(5, {animate: false});
		expect(marker1cluster5._iconNeedsUpdate).toBeFalsy();
		expect(marker3cluster5._iconNeedsUpdate).toBeFalsy();
		expect(marker5cluster5._iconNeedsUpdate).toBeFalsy();

		// Run any animation.
		vi.advanceTimersByTime(1000);

		// Ready to refresh clusters with method of choice and assess result.
	}

	it('does not flag clusters of other markers', () => {

		init3clusterBranches();

		// Then request clusters refresh.
		// No need to actually modify the marker.
		group.refreshClusters(marker1);

		// Now check that non-visible clusters are flagged as "dirty".
		expect(marker1cluster8._iconNeedsUpdate).toBeTruthy();
		expect(marker1cluster3._iconNeedsUpdate).toBeTruthy();

		// Finally check that non-involved clusters are not "dirty".
		expect(marker3cluster8._iconNeedsUpdate).toBeFalsy();
		expect(marker3cluster3._iconNeedsUpdate).toBeFalsy();

		expect(marker5cluster8._iconNeedsUpdate).toBeFalsy();
		expect(marker5cluster3._iconNeedsUpdate).toBeFalsy();

	});

	it('processes itself when no argument is passed', () => {

		init3clusterBranches();

		// Then request clusters refresh.
		// No need to actually modify the marker.
		group.refreshClusters();

		// Now check that non-visible clusters are flagged as "dirty".
		expect(marker1cluster8._iconNeedsUpdate).toBeTruthy();
		expect(marker1cluster3._iconNeedsUpdate).toBeTruthy();

		expect(marker3cluster8._iconNeedsUpdate).toBeTruthy();
		expect(marker3cluster3._iconNeedsUpdate).toBeTruthy();

		expect(marker5cluster8._iconNeedsUpdate).toBeTruthy();
		expect(marker5cluster3._iconNeedsUpdate).toBeTruthy();

	});

	it('accepts an array of markers', () => {

		init3clusterBranches();

		// Then request clusters refresh.
		// No need to actually modify the markers.
		group.refreshClusters([marker1, marker5]);
		// Clusters of marker3 and 4 shall not be flagged.

		// Now check that non-visible clusters are flagged as "dirty".
		expect(marker1cluster8._iconNeedsUpdate).toBeTruthy();
		expect(marker1cluster3._iconNeedsUpdate).toBeTruthy();

		expect(marker5cluster8._iconNeedsUpdate).toBeTruthy();
		expect(marker5cluster3._iconNeedsUpdate).toBeTruthy();

		// Clusters of marker3 and 4 shall not be flagged.
		expect(marker3cluster8._iconNeedsUpdate).toBeFalsy();
		expect(marker3cluster3._iconNeedsUpdate).toBeFalsy();

	});

	it('accepts a mapping of markers', () => {

		init3clusterBranches();

		// Then request clusters refresh.
		// No need to actually modify the markers.
		group.refreshClusters({
			id1: marker1,
			id2: marker5
		}); // Clusters of marker3 and 4 shall not be flagged.

		// Now check that non-visible clusters are flagged as "dirty".
		expect(marker1cluster8._iconNeedsUpdate).toBeTruthy();
		expect(marker1cluster3._iconNeedsUpdate).toBeTruthy();

		expect(marker5cluster8._iconNeedsUpdate).toBeTruthy();
		expect(marker5cluster3._iconNeedsUpdate).toBeTruthy();

		// Clusters of marker3 and 4 shall not be flagged.
		expect(marker3cluster8._iconNeedsUpdate).toBeFalsy();
		expect(marker3cluster3._iconNeedsUpdate).toBeFalsy();

	});

	it('accepts an L.LayerGroup', () => {

		init3clusterBranches();

		// Then request clusters refresh.
		// No need to actually modify the markers.
		const layerGroup = new L.LayerGroup([marker1, marker5]);
		group.refreshClusters(layerGroup);
		// Clusters of marker3 and 4 shall not be flagged.

		// Now check that non-visible clusters are flagged as "dirty".
		expect(marker1cluster8._iconNeedsUpdate).toBeTruthy();
		expect(marker1cluster3._iconNeedsUpdate).toBeTruthy();

		expect(marker5cluster8._iconNeedsUpdate).toBeTruthy();
		expect(marker5cluster3._iconNeedsUpdate).toBeTruthy();

		// Clusters of marker3 and 4 shall not be flagged.
		expect(marker3cluster8._iconNeedsUpdate).toBeFalsy();
		expect(marker3cluster3._iconNeedsUpdate).toBeFalsy();

	});

	it('accepts an MarkerCluster', () => {

		init3clusterBranches();

		// Then request clusters refresh.
		// No need to actually modify the markers.
		group.refreshClusters(marker1cluster8);
		// Clusters of marker3, 4, 5 and 6 shall not be flagged.

		// Now check that non-visible clusters are flagged as "dirty".
		expect(marker1cluster8._iconNeedsUpdate).toBeTruthy();
		expect(marker1cluster3._iconNeedsUpdate).toBeTruthy();

		// Clusters of marker3 and 4 shall not be flagged.
		expect(marker3cluster8._iconNeedsUpdate).toBeFalsy();
		expect(marker3cluster3._iconNeedsUpdate).toBeFalsy();

		expect(marker5cluster8._iconNeedsUpdate).toBeFalsy();
		expect(marker5cluster3._iconNeedsUpdate).toBeFalsy();

	});
});
