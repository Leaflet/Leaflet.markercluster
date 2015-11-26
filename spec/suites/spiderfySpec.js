describe('spiderfy', function () {
	var map, div, clock;
	beforeEach(function () {
		clock = sinon.useFakeTimers();

		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = L.map(div, { maxZoom: 18 });

		map.fitBounds(new L.LatLngBounds([
			[1, 1],
			[2, 2]
		]));
	});
	afterEach(function () {
		clock.restore();
		document.body.removeChild(div);
	});

	it('Spiderfies 2 Markers', function () {

		var group = new L.MarkerClusterGroup();
		var marker = new L.Marker([1.5, 1.5]);
		var marker2 = new L.Marker([1.5, 1.5]);

		group.addLayer(marker);
		group.addLayer(marker2);
		map.addLayer(group);

		marker.__parent.spiderfy();

		expect(marker._icon.parentNode).to.be(map._panes.markerPane);
		expect(marker2._icon.parentNode).to.be(map._panes.markerPane);
	});

	it('Spiderfies 2 CircleMarkers', function () {

		var group = new L.MarkerClusterGroup();
		var marker = new L.CircleMarker([1.5, 1.5]);
		var marker2 = new L.CircleMarker([1.5, 1.5]);

		group.addLayer(marker);
		group.addLayer(marker2);
		map.addLayer(group);

		marker.__parent.spiderfy();

		expect(marker._container.parentNode).to.be(map._pathRoot);
		expect(marker2._container.parentNode).to.be(map._pathRoot);
	});

	it('Spiderfies 2 Circles', function () {

		var group = new L.MarkerClusterGroup();
		var marker = new L.Circle([1.5, 1.5], 10);
		var marker2 = new L.Circle([1.5, 1.5], 10);

		group.addLayer(marker);
		group.addLayer(marker2);
		map.addLayer(group);

		marker.__parent.spiderfy();

		expect(marker._container.parentNode).to.be(map._pathRoot);
		expect(marker2._container.parentNode).to.be(map._pathRoot);
	});

	it('Spiderfies at current zoom if all child markers are at the exact same position', function () {

		var group = new L.MarkerClusterGroup();
		var marker = new L.Marker([1.5, 1.5]);
		var marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		// Get the appropriate cluster.
		var cluster = marker.__parent,
		    zoom = map.getZoom();

		while (cluster._zoom !== zoom) {
			cluster = cluster.__parent;
		}

		expect(zoom).to.be.lessThan(10);

		cluster.fireEvent('click');

		clock.tick(1000);

		expect(map.getZoom()).to.equal(zoom);

		expect(marker._icon.parentNode).to.be(map._panes.markerPane);
		expect(marker2._icon.parentNode).to.be(map._panes.markerPane);

	});

	it('Spiderfies at current zoom if all child markers are still within a single cluster at map maxZoom', function () {

		var group = new L.MarkerClusterGroup();
		var marker = new L.Marker([1.5, 1.50001]);
		var marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		expect(marker.__parent._zoom).to.equal(18);

		// Get the appropriate cluster.
		var cluster = marker.__parent,
		    zoom = map.getZoom();

		while (cluster._zoom !== zoom) {
			cluster = cluster.__parent;
		}

		expect(zoom).to.be.lessThan(10);

		cluster.fireEvent('click');

		clock.tick(1000);

		expect(map.getZoom()).to.equal(zoom);

		expect(marker._icon.parentNode).to.be(map._panes.markerPane);
		expect(marker2._icon.parentNode).to.be(map._panes.markerPane);

	});

	describe('zoomend event listener', function () {
		it('unspiderfies correctly', function () {

			var group = new L.MarkerClusterGroup();
			var marker = new L.Circle([1.5, 1.5], 10);
			var marker2 = new L.Circle([1.5, 1.5], 10);

			group.addLayer(marker);
			group.addLayer(marker2);
			map.addLayer(group);

			marker.__parent.spiderfy();

			expect(group._spiderfied).to.not.be(null);

			map.fire('zoomend');

			//We should unspiderfy with no animation, so this should be null
			expect(group._spiderfied).to.be(null);
		});
	});
});