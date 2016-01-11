describe('events', function() {

	/**
	 * Avoid as much as possible creating and destroying objects for each test.
	 * Instead, try re-using them, except for the ones under test of course.
	 * PhantomJS does not perform garbage collection for the life of the page,
	 * i.e. during the entire test process (Karma runs all tests in a single page).
	 * http://stackoverflow.com/questions/27239708/how-to-get-around-memory-error-with-karma-phantomjs
	 *
	 * The `beforeEach` and `afterEach do not seem to cause much issue.
	 * => they can still be used to initialize some setup between each test.
	 * Using them keeps a readable spec/index.
	 *
	 * But refrain from re-creating div and map every time. Re-use those objects.
	 */

	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////

	beforeEach(function () {

		//

	});

	afterEach(function () {

		if (group instanceof L.MarkerClusterGroup) {
			group.removeLayers(group.getLayers());
			map.removeLayer(group);
		}

		// group must be thrown away since we are testing it with a potentially
		// different configuration at each test.
		group = null;

	});


	/////////////////////////////
	// PREPARATION CODE
	/////////////////////////////

	var div, map, group;

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


	/////////////////////////////
	// TESTS
	/////////////////////////////

	it('is fired for a single child marker', function () {
		var callback = sinon.spy();

		group = new L.MarkerClusterGroup();

		var marker = new L.Marker([1.5, 1.5]);

		group.on('click', callback);
		group.addLayer(marker);
		map.addLayer(group);

		// In Leaflet 1.0.0, event propagation must be explicitly set by 3rd argument.
		marker.fire('click', null, true);

		expect(callback.called).to.be(true);
	});

	it('is fired for a child polygon', function () {
		var callback = sinon.spy();

		group = new L.MarkerClusterGroup();

		var polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

		group.on('click', callback);
		group.addLayer(polygon);
		map.addLayer(group);

		polygon.fire('click', null, true);

		expect(callback.called).to.be(true);
	});

	it('is fired for a cluster click', function () {
		var callback = sinon.spy();

		group = new L.MarkerClusterGroup();

		var marker = new L.Marker([1.5, 1.5]);
		var marker2 = new L.Marker([1.5, 1.5]);

		group.on('clusterclick', callback);
		group.addLayers([marker, marker2]);
		map.addLayer(group);

		var cluster = group.getVisibleParent(marker);
		expect(cluster instanceof L.MarkerCluster).to.be(true);

		cluster.fire('click', null, true);

		expect(callback.called).to.be(true);
	});

	describe('after being added, removed, re-added from the map', function() {

		it('still fires events for nonpoint data', function() {
			var callback = sinon.spy();

			group = new L.MarkerClusterGroup();

			var polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			group.on('click', callback);
			group.addLayer(polygon);
			map.addLayer(group);
			map.removeLayer(group);
			map.addLayer(group);

			polygon.fire('click', null, true);

			expect(callback.called).to.be(true);
		});

		it('still fires events for point data', function() {
			var callback = sinon.spy();

			group = new L.MarkerClusterGroup();

			var marker = new L.Marker([1.5, 1.5]);

			group.on('click', callback);
			group.addLayer(marker);
			map.addLayer(group);
			map.removeLayer(group);
			map.addLayer(group);

			marker.fire('click', null, true);

			expect(callback.called).to.be(true);
		});

		it('still fires cluster events', function() {
			var callback = sinon.spy();

			group = new L.MarkerClusterGroup();

			var marker = new L.Marker([1.5, 1.5]);
			var marker2 = new L.Marker([1.5, 1.5]);

			group.on('clusterclick', callback);
			group.addLayers([marker, marker2]);
			map.addLayer(group);

			map.removeLayer(group);
			map.addLayer(group);

			var cluster = group.getVisibleParent(marker);
			expect(cluster instanceof L.MarkerCluster).to.be(true);

			cluster.fire('click', null, true);

			expect(callback.called).to.be(true);
		});

		it('does not break map events', function () {
			var callback = sinon.spy();

			group = new L.MarkerClusterGroup();

			map.on('zoomend', callback);
			map.addLayer(group);

			map.removeLayer(group);
			map.addLayer(group);

			map.fire('zoomend');

			expect(callback.called).to.be(true);
		});
	});

	/*
	//No normal events can be fired by a clustered marker, so probably don't need this.
	it('is fired for a clustered child marker', function() {
		var callback = sinon.spy();

		group = new L.MarkerClusterGroup();

		var marker = new L.Marker([1.5, 1.5]);
		var marker2 = new L.Marker([1.5, 1.5]);

		group.on('click', callback);
		group.addLayers([marker, marker2]);
		map.addLayer(group);

		marker.fire('click');

		expect(callback.called).to.be(true);
	});
	*/


	/////////////////////////////
	// CLEAN UP CODE
	/////////////////////////////

	map.remove();
	document.body.removeChild(div);
});