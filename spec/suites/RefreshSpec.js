describe('refreshClusters', function () {
	var map, div;

	function getClusterAtZoom(marker, zoom) {
		var parent = marker.__parent;

		while (parent && parent._zoom !== zoom) {
			parent = parent.__parent;
		}

		return parent;
	}

	function expectClusterIconNeedsUpdate(marker, zoom, needsUpdate) {
		var cluster = getClusterAtZoom(marker, zoom);

		expect(cluster._iconNeedsUpdate).to.be(needsUpdate);
	}


	beforeEach(function () {
		clock = sinon.useFakeTimers();

		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = L.map(div, { maxZoom: 18 });

		// Corresponds to zoom level 8 for the above div dimensions.
		map.fitBounds(new L.LatLngBounds([
			[1, 1],
			[2, 2]
		]));
	});
	afterEach(function () {
		clock.restore();

		document.body.removeChild(div);
	});

	it('flags all non-visible parent clusters of a given marker', function () {

		var group = new L.MarkerClusterGroup();
		var marker1 = new L.Marker([1.5, 1.5]);
		var marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker1, marker2]);
		map.addLayer(group);

		var marker1cluster10 = getClusterAtZoom(marker1, 10),
		    marker1cluster2 = getClusterAtZoom(marker1, 2),
		    marker1cluster5 = getClusterAtZoom(marker1, 5);

		// First go to some zoom levels so that Leaflet initializes clusters icons.
		expect(marker1cluster10._iconNeedsUpdate).to.be.ok();
		map.setZoom(10, {animate: false});
		expect(marker1cluster10._iconNeedsUpdate).to.not.be.ok();

		expect(marker1cluster2._iconNeedsUpdate).to.be.ok();
		map.setZoom(2, {animate: false});
		expect(marker1cluster2._iconNeedsUpdate).to.not.be.ok();

		// Finish on an intermediate zoom level.
		expect(marker1cluster5._iconNeedsUpdate).to.be.ok();
		map.setZoom(5, {animate: false});
		expect(marker1cluster5._iconNeedsUpdate).to.not.be.ok();

		// Run any animation.
		clock.tick(1000);

		// Then request clusters refresh.
		// No need to actually modify the marker.
		group.refreshClusters(marker1);

		// Now check that non-visible clusters are flagged as "dirty".
		expect(marker1cluster10._iconNeedsUpdate).to.be.ok();
		expect(marker1cluster2._iconNeedsUpdate).to.be.ok();

		// Also check that visible clusters are "un-flagged" since they should be re-drawn.
		expect(marker1cluster5._iconNeedsUpdate).to.not.be.ok();

	});

	it('re-draws visible clusters', function () {

		var group = new L.MarkerClusterGroup({
			iconCreateFunction: function (cluster) {
				var markers = cluster.getAllChildMarkers();

				for(var i in markers) {
					if (markers[i].changed) {
						return new L.DivIcon({
							className: "changed"
						});
					}
				}
				return new L.DivIcon({
					className: "original"
				});
			}
		});
		var marker1 = new L.Marker([1.5, 1.5]);
		var marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker1, marker2]);
		map.addLayer(group);

		var marker1cluster9 = getClusterAtZoom(marker1, 9);

		// First go to some zoom levels so that Leaflet initializes clusters icons.
		expect(marker1cluster9._iconNeedsUpdate).to.be.ok();
		map.setZoom(9, {animate: false});
		expect(marker1cluster9._iconNeedsUpdate).to.not.be.ok();

		expect(marker1cluster9._icon.className).to.contain("original");
		expect(marker1cluster9._icon.className).to.not.contain("changed");

		// Run any animation.
		clock.tick(1000);

		// Alter the marker.
		marker1.changed = true;

		// Then request clusters refresh.
		group.refreshClusters(marker1);

		// Now check that visible clusters icon is re-drawn.
		expect(marker1cluster9._icon.className).to.contain("changed");
		expect(marker1cluster9._icon.className).to.not.contain("original");

	});

	it('does not flag clusters of other markers', function () {

		var group = new L.MarkerClusterGroup({
			maxClusterRadius: 2 // Make sure we keep distinct clusters.
		});
		var marker1 = new L.Marker([1.5, 1.5]);
		var marker2 = new L.Marker([1.5, 1.5]);
		var marker3 = new L.Marker([1.1, 1.1]);
		var marker4 = new L.Marker([1.1, 1.1]);
		var marker5 = new L.Marker([1.9, 1.9]);
		var marker6 = new L.Marker([1.9, 1.9]);

		group.addLayers([marker1, marker2, marker3, marker4, marker5, marker6]);
		map.addLayer(group);

		var marker1cluster8 = getClusterAtZoom(marker1, 8),
		    marker1cluster3 = getClusterAtZoom(marker1, 3),
		    marker1cluster5 = getClusterAtZoom(marker1, 5),
		    marker3cluster8 = getClusterAtZoom(marker3, 8),
		    marker3cluster3 = getClusterAtZoom(marker3, 3),
		    marker3cluster5 = getClusterAtZoom(marker3, 5),
		    marker5cluster8 = getClusterAtZoom(marker5, 8),
		    marker5cluster3 = getClusterAtZoom(marker5, 3),
		    marker5cluster5 = getClusterAtZoom(marker5, 5);

		// Make sure we have 3 distinct clusters up to zoom level Z (let's choose Z = 3)
		expect(marker1cluster3._childCount).to.equal(2);
		expect(marker3cluster3._childCount).to.equal(2);
		expect(marker5cluster3._childCount).to.equal(2);

		// First go to some zoom levels so that Leaflet initializes clusters icons.
		expect(marker1cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster8._iconNeedsUpdate).to.not.be.ok();

		expect(marker1cluster3._iconNeedsUpdate).to.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.be.ok();
		map.setZoom(3, {animate: false});
		expect(marker1cluster3._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.not.be.ok();

		// Finish on an intermediate zoom level.
		expect(marker1cluster5._iconNeedsUpdate).to.be.ok();
		expect(marker3cluster5._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster5._iconNeedsUpdate).to.be.ok();
		map.setZoom(5, {animate: false});
		expect(marker1cluster5._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster5._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster5._iconNeedsUpdate).to.not.be.ok();

		// Run any animation.
		clock.tick(1000);

		// Then request clusters refresh.
		// No need to actually modify the marker.
		group.refreshClusters(marker1);

		// Now check that non-visible clusters are flagged as "dirty".
		expect(marker1cluster8._iconNeedsUpdate).to.be.ok();
		expect(marker1cluster3._iconNeedsUpdate).to.be.ok();

		// Finally check that non-involved clusters are not "dirty".
		expect(marker3cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.not.be.ok();

		expect(marker5cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.not.be.ok();
	});

	it('processes itself when no argument is passed', function () {

		var group = new L.MarkerClusterGroup({
			maxClusterRadius: 2 // Make sure we keep distinct clusters.
		});
		var marker1 = new L.Marker([1.5, 1.5]);
		var marker2 = new L.Marker([1.5, 1.5]);
		var marker3 = new L.Marker([1.1, 1.1]);
		var marker4 = new L.Marker([1.1, 1.1]);
		var marker5 = new L.Marker([1.9, 1.9]);
		var marker6 = new L.Marker([1.9, 1.9]);

		group.addLayers([marker1, marker2, marker3, marker4, marker5, marker6]);
		map.addLayer(group);

		var marker1cluster8 = getClusterAtZoom(marker1, 8),
		    marker1cluster3 = getClusterAtZoom(marker1, 3),
		    marker1cluster5 = getClusterAtZoom(marker1, 5),
		    marker3cluster8 = getClusterAtZoom(marker3, 8),
		    marker3cluster3 = getClusterAtZoom(marker3, 3),
		    marker3cluster5 = getClusterAtZoom(marker3, 5),
		    marker5cluster8 = getClusterAtZoom(marker5, 8),
		    marker5cluster3 = getClusterAtZoom(marker5, 3),
		    marker5cluster5 = getClusterAtZoom(marker5, 5);

		// Make sure we have 3 distinct clusters up to zoom level Z (let's choose Z = 3)
		expect(marker1cluster3._childCount).to.equal(2);
		expect(marker3cluster3._childCount).to.equal(2);
		expect(marker5cluster3._childCount).to.equal(2);

		// First go to some zoom levels so that Leaflet initializes clusters icons.
		expect(marker1cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster8._iconNeedsUpdate).to.not.be.ok();

		expect(marker1cluster3._iconNeedsUpdate).to.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.be.ok();
		map.setZoom(3, {animate: false});
		expect(marker1cluster3._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.not.be.ok();

		// Finish on an intermediate zoom level.
		expect(marker1cluster5._iconNeedsUpdate).to.be.ok();
		expect(marker3cluster5._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster5._iconNeedsUpdate).to.be.ok();
		map.setZoom(5, {animate: false});
		expect(marker1cluster5._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster5._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster5._iconNeedsUpdate).to.not.be.ok();

		// Run any animation.
		clock.tick(1000);

		// Then request clusters refresh.
		// No need to actually modify the marker.
		group.refreshClusters();

		// Now check that non-visible clusters are flagged as "dirty".
		expect(marker1cluster8._iconNeedsUpdate).to.be.ok();
		expect(marker1cluster3._iconNeedsUpdate).to.be.ok();

		expect(marker3cluster8._iconNeedsUpdate).to.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.be.ok();

		expect(marker5cluster8._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.be.ok();

	});

	it('accepts an array of markers', function () {

		var group = new L.MarkerClusterGroup({
			maxClusterRadius: 2 // Make sure we keep distinct clusters.
		});
		var marker1 = new L.Marker([1.5, 1.5]);
		var marker2 = new L.Marker([1.5, 1.5]);
		var marker3 = new L.Marker([1.1, 1.1]);
		var marker4 = new L.Marker([1.1, 1.1]);
		var marker5 = new L.Marker([1.9, 1.9]);
		var marker6 = new L.Marker([1.9, 1.9]);

		group.addLayers([marker1, marker2, marker3, marker4, marker5, marker6]);
		map.addLayer(group);

		var marker1cluster8 = getClusterAtZoom(marker1, 8),
		    marker1cluster3 = getClusterAtZoom(marker1, 3),
		    marker1cluster5 = getClusterAtZoom(marker1, 5),
		    marker3cluster8 = getClusterAtZoom(marker3, 8),
		    marker3cluster3 = getClusterAtZoom(marker3, 3),
		    marker3cluster5 = getClusterAtZoom(marker3, 5),
		    marker5cluster8 = getClusterAtZoom(marker5, 8),
		    marker5cluster3 = getClusterAtZoom(marker5, 3),
		    marker5cluster5 = getClusterAtZoom(marker5, 5);

		// Make sure we have 3 distinct clusters up to zoom level Z (let's choose Z = 3)
		expect(marker1cluster3._childCount).to.equal(2);
		expect(marker3cluster3._childCount).to.equal(2);
		expect(marker5cluster3._childCount).to.equal(2);

		// First go to some zoom levels so that Leaflet initializes clusters icons.
		expect(marker1cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster8._iconNeedsUpdate).to.not.be.ok();

		expect(marker1cluster3._iconNeedsUpdate).to.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.be.ok();
		map.setZoom(3, {animate: false});
		expect(marker1cluster3._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.not.be.ok();

		// Finish on an intermediate zoom level.
		expect(marker1cluster5._iconNeedsUpdate).to.be.ok();
		expect(marker3cluster5._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster5._iconNeedsUpdate).to.be.ok();
		map.setZoom(5, {animate: false});
		expect(marker1cluster5._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster5._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster5._iconNeedsUpdate).to.not.be.ok();

		// Run any animation.
		clock.tick(1000);

		// Then request clusters refresh.
		// No need to actually modify the markers.
		group.refreshClusters([marker1, marker5]);
		// Clusters of marker3 and 4 shall not be flagged.

		// Now check that non-visible clusters are flagged as "dirty".
		expect(marker1cluster8._iconNeedsUpdate).to.be.ok();
		expect(marker1cluster3._iconNeedsUpdate).to.be.ok();

		expect(marker5cluster8._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.be.ok();

		// Clusters of marker3 and 4 shall not be flagged.
		expect(marker3cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.not.be.ok();

	});

	it('accepts a mapping of markers', function () {

		var group = new L.MarkerClusterGroup({
			maxClusterRadius: 2 // Make sure we keep distinct clusters.
		});
		var marker1 = new L.Marker([1.5, 1.5]);
		var marker2 = new L.Marker([1.5, 1.5]);
		var marker3 = new L.Marker([1.1, 1.1]);
		var marker4 = new L.Marker([1.1, 1.1]);
		var marker5 = new L.Marker([1.9, 1.9]);
		var marker6 = new L.Marker([1.9, 1.9]);

		group.addLayers([marker1, marker2, marker3, marker4, marker5, marker6]);
		map.addLayer(group);

		var marker1cluster8 = getClusterAtZoom(marker1, 8),
		    marker1cluster3 = getClusterAtZoom(marker1, 3),
		    marker1cluster5 = getClusterAtZoom(marker1, 5),
		    marker3cluster8 = getClusterAtZoom(marker3, 8),
		    marker3cluster3 = getClusterAtZoom(marker3, 3),
		    marker3cluster5 = getClusterAtZoom(marker3, 5),
		    marker5cluster8 = getClusterAtZoom(marker5, 8),
		    marker5cluster3 = getClusterAtZoom(marker5, 3),
		    marker5cluster5 = getClusterAtZoom(marker5, 5);

		// Make sure we have 3 distinct clusters up to zoom level Z (let's choose Z = 3)
		expect(marker1cluster3._childCount).to.equal(2);
		expect(marker3cluster3._childCount).to.equal(2);
		expect(marker5cluster3._childCount).to.equal(2);

		// First go to some zoom levels so that Leaflet initializes clusters icons.
		expect(marker1cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster8._iconNeedsUpdate).to.not.be.ok();

		expect(marker1cluster3._iconNeedsUpdate).to.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.be.ok();
		map.setZoom(3, {animate: false});
		expect(marker1cluster3._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.not.be.ok();

		// Finish on an intermediate zoom level.
		expect(marker1cluster5._iconNeedsUpdate).to.be.ok();
		expect(marker3cluster5._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster5._iconNeedsUpdate).to.be.ok();
		map.setZoom(5, {animate: false});
		expect(marker1cluster5._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster5._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster5._iconNeedsUpdate).to.not.be.ok();

		// Run any animation.
		clock.tick(1000);

		// Then request clusters refresh.
		// No need to actually modify the markers.
		group.refreshClusters({
			id1: marker1,
			id2: marker5
		}); // Clusters of marker3 and 4 shall not be flagged.

		// Now check that non-visible clusters are flagged as "dirty".
		expect(marker1cluster8._iconNeedsUpdate).to.be.ok();
		expect(marker1cluster3._iconNeedsUpdate).to.be.ok();

		expect(marker5cluster8._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.be.ok();

		// Clusters of marker3 and 4 shall not be flagged.
		expect(marker3cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.not.be.ok();

	});

	it('accepts an L.LayerGroup', function () {

		var group = new L.MarkerClusterGroup({
			maxClusterRadius: 2 // Make sure we keep distinct clusters.
		});
		var marker1 = new L.Marker([1.5, 1.5]);
		var marker2 = new L.Marker([1.5, 1.5]);
		var marker3 = new L.Marker([1.1, 1.1]);
		var marker4 = new L.Marker([1.1, 1.1]);
		var marker5 = new L.Marker([1.9, 1.9]);
		var marker6 = new L.Marker([1.9, 1.9]);

		group.addLayers([marker1, marker2, marker3, marker4, marker5, marker6]);
		map.addLayer(group);

		var marker1cluster8 = getClusterAtZoom(marker1, 8),
		    marker1cluster3 = getClusterAtZoom(marker1, 3),
		    marker1cluster5 = getClusterAtZoom(marker1, 5),
		    marker3cluster8 = getClusterAtZoom(marker3, 8),
		    marker3cluster3 = getClusterAtZoom(marker3, 3),
		    marker3cluster5 = getClusterAtZoom(marker3, 5),
		    marker5cluster8 = getClusterAtZoom(marker5, 8),
		    marker5cluster3 = getClusterAtZoom(marker5, 3),
		    marker5cluster5 = getClusterAtZoom(marker5, 5);

		// Make sure we have 3 distinct clusters up to zoom level Z (let's choose Z = 3)
		expect(marker1cluster3._childCount).to.equal(2);
		expect(marker3cluster3._childCount).to.equal(2);
		expect(marker5cluster3._childCount).to.equal(2);

		// First go to some zoom levels so that Leaflet initializes clusters icons.
		expect(marker1cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster8._iconNeedsUpdate).to.not.be.ok();

		expect(marker1cluster3._iconNeedsUpdate).to.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.be.ok();
		map.setZoom(3, {animate: false});
		expect(marker1cluster3._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.not.be.ok();

		// Finish on an intermediate zoom level.
		expect(marker1cluster5._iconNeedsUpdate).to.be.ok();
		expect(marker3cluster5._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster5._iconNeedsUpdate).to.be.ok();
		map.setZoom(5, {animate: false});
		expect(marker1cluster5._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster5._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster5._iconNeedsUpdate).to.not.be.ok();

		// Run any animation.
		clock.tick(1000);

		// Then request clusters refresh.
		// No need to actually modify the markers.
		var layerGroup = new L.LayerGroup([marker1, marker5]);
		group.refreshClusters(layerGroup);
		// Clusters of marker3 and 4 shall not be flagged.

		// Now check that non-visible clusters are flagged as "dirty".
		expect(marker1cluster8._iconNeedsUpdate).to.be.ok();
		expect(marker1cluster3._iconNeedsUpdate).to.be.ok();

		expect(marker5cluster8._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.be.ok();

		// Clusters of marker3 and 4 shall not be flagged.
		expect(marker3cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.not.be.ok();

	});

	it('accepts an L.MarkerCluster', function () {

		var group = new L.MarkerClusterGroup({
			maxClusterRadius: 2 // Make sure we keep distinct clusters.
		});
		var marker1 = new L.Marker([1.5, 1.5]);
		var marker2 = new L.Marker([1.5, 1.5]);
		var marker3 = new L.Marker([1.1, 1.1]);
		var marker4 = new L.Marker([1.1, 1.1]);
		var marker5 = new L.Marker([1.9, 1.9]);
		var marker6 = new L.Marker([1.9, 1.9]);

		group.addLayers([marker1, marker2, marker3, marker4, marker5, marker6]);
		map.addLayer(group);

		var marker1cluster8 = getClusterAtZoom(marker1, 8),
		    marker1cluster3 = getClusterAtZoom(marker1, 3),
		    marker1cluster5 = getClusterAtZoom(marker1, 5),
		    marker3cluster8 = getClusterAtZoom(marker3, 8),
		    marker3cluster3 = getClusterAtZoom(marker3, 3),
		    marker3cluster5 = getClusterAtZoom(marker3, 5),
		    marker5cluster8 = getClusterAtZoom(marker5, 8),
		    marker5cluster3 = getClusterAtZoom(marker5, 3),
		    marker5cluster5 = getClusterAtZoom(marker5, 5);

		// Make sure we have 3 distinct clusters up to zoom level Z (let's choose Z = 3)
		expect(marker1cluster3._childCount).to.equal(2);
		expect(marker3cluster3._childCount).to.equal(2);
		expect(marker5cluster3._childCount).to.equal(2);

		// First go to some zoom levels so that Leaflet initializes clusters icons.
		expect(marker1cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster8._iconNeedsUpdate).to.not.be.ok();

		expect(marker1cluster3._iconNeedsUpdate).to.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.be.ok();
		map.setZoom(3, {animate: false});
		expect(marker1cluster3._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.not.be.ok();

		// Finish on an intermediate zoom level.
		expect(marker1cluster5._iconNeedsUpdate).to.be.ok();
		expect(marker3cluster5._iconNeedsUpdate).to.be.ok();
		expect(marker5cluster5._iconNeedsUpdate).to.be.ok();
		map.setZoom(5, {animate: false});
		expect(marker1cluster5._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster5._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster5._iconNeedsUpdate).to.not.be.ok();

		// Run any animation.
		clock.tick(1000);

		// Then request clusters refresh.
		// No need to actually modify the markers.
		group.refreshClusters(marker1cluster8);
		// Clusters of marker3, 4, 5 and 6 shall not be flagged.

		// Now check that non-visible clusters are flagged as "dirty".
		expect(marker1cluster8._iconNeedsUpdate).to.be.ok();
		expect(marker1cluster3._iconNeedsUpdate).to.be.ok();

		// Clusters of marker3 and 4 shall not be flagged.
		expect(marker3cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker3cluster3._iconNeedsUpdate).to.not.be.ok();

		expect(marker5cluster8._iconNeedsUpdate).to.not.be.ok();
		expect(marker5cluster3._iconNeedsUpdate).to.not.be.ok();

	});

});
