describe('Option removeOutsideVisibleBounds', function () {
	var map, div;

	/*var marker1 = new L.Marker([1.5, -0.4]), // 2 screens width away.
	    marker2 = new L.Marker([1.5, 0.6]), // 1 screen width away.
	    marker3 = new L.Marker([1.5, 1.5]), // In view port.
	    marker4 = new L.Marker([1.5, 2.4]), // 1 screen width away.
	    marker5 = new L.Marker([1.5, 3.4]), // 2 screens width away.
	    markers = [marker1, marker2, marker3, marker4, marker5],
		group,
		previousMobileValue = L.Browser.mobile;*/

	function centerMapView() {
		// Corresponds to zoom level 8 for the above div dimensions.
		map.fitBounds(new L.LatLngBounds([
			[1, 1],
			[2, 2]
		]));
	}

	beforeEach(function () {
		clock = sinon.useFakeTimers();

		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = L.map(div, { maxZoom: 18 });
	});

	afterEach(function () {
		clock.restore();

		document.body.removeChild(div);
	});

	it('removes objects more than 1 screen away from view port by default', function () {

		centerMapView();

		var marker1 = new L.Marker([1.5, -0.4]), // 2 screens width away.
		    marker2 = new L.Marker([1.5, 0.6]), // 1 screen width away.
		    marker3 = new L.Marker([1.5, 1.5]), // In view port.
		    marker4 = new L.Marker([1.5, 2.4]), // 1 screen width away.
		    marker5 = new L.Marker([1.5, 3.4]), // 2 screens width away.
		    markers = [marker1, marker2, marker3, marker4, marker5],
		    group = L.markerClusterGroup().addTo(map);

		group.addLayers(markers);

		expect(marker1._icon).to.be(undefined);
		expect(map._panes.markerPane.childNodes.length).to.be(3); // markers 2, 3 and 4.
		expect(marker5._icon).to.be(undefined);

	});

	it('removes objects out of view port by default for mobile device', function () {

		// Fool Leaflet
		var previous = L.Browser.mobile;
		L.Browser.mobile = true;

		centerMapView();

		var marker1 = new L.Marker([1.5, -0.4]), // 2 screens width away.
		    marker2 = new L.Marker([1.5, 0.6]), // 1 screen width away.
		    marker3 = new L.Marker([1.5, 1.5]), // In view port.
		    marker4 = new L.Marker([1.5, 2.4]), // 1 screen width away.
		    marker5 = new L.Marker([1.5, 3.4]), // 2 screens width away.
		    markers = [marker1, marker2, marker3, marker4, marker5],
		    group = L.markerClusterGroup().addTo(map);

		group.addLayers(markers);

		expect(marker1._icon).to.be(undefined);
		expect(marker2._icon).to.be(undefined);
		expect(map._panes.markerPane.childNodes.length).to.be(1); // marker 3 only.
		expect(marker4._icon).to.be(undefined);
		expect(marker5._icon).to.be(undefined);

		L.Browser.mobile = previous;

	});

	it('leaves all objects on map when set to false', function () {

		centerMapView();

		var marker1 = new L.Marker([1.5, -0.4]), // 2 screens width away.
		    marker2 = new L.Marker([1.5, 0.6]), // 1 screen width away.
		    marker3 = new L.Marker([1.5, 1.5]), // In view port.
		    marker4 = new L.Marker([1.5, 2.4]), // 1 screen width away.
		    marker5 = new L.Marker([1.5, 3.4]), // 2 screens width away.
		    markers = [marker1, marker2, marker3, marker4, marker5],
		    group = L.markerClusterGroup({removeOutsideVisibleBounds: false}).addTo(map);

		group.addLayers(markers);

		expect(map._panes.markerPane.childNodes.length).to.be(5); // All 5 markers.

	});

});
