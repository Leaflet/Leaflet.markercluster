﻿describe('removeLayers', function () {
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

	it('removes all the layer given to it', function () {

		var group = new L.MarkerClusterGroup();
		var markers = [
			new L.Marker([1.5, 1.5]),
			new L.Marker([1.5, 1.5]),
			new L.Marker([1.5, 1.5])
		];

		map.addLayer(group);

		group.addLayers(markers);

		group.removeLayers(markers);

		expect(group.hasLayer(markers[0])).to.be(false);
		expect(group.hasLayer(markers[1])).to.be(false);
		expect(group.hasLayer(markers[2])).to.be(false);

		expect(group.getLayers().length).to.be(0);
	});

	it('removes all the layer given to it', function () {

		var group = new L.MarkerClusterGroup();
		var markers = [
			new L.Marker([10, 10]),
			new L.Marker([20, 20]),
			new L.Marker([30, 30])
		];
		var len = markers.length;
		map.addLayer(group);

		group.addLayers(markers);

		markers.forEach(function (marker) {
			marker.setLatLng([1.5, 1.5]);
			group.removeLayer(marker);
			expect(group.getLayers().length).to.be(len - 1);
			group.addLayer(marker);
			expect(group.getLayers().length).to.be(len);
		});

		expect(group.getLayers().length).to.be(len);
	});

	it('doesnt break if we are spiderfied', function () {

		var group = new L.MarkerClusterGroup();
		var markers = [
			new L.Marker([1.5, 1.5]),
			new L.Marker([1.5, 1.5]),
			new L.Marker([1.5, 1.5])
		];

		map.addLayer(group);

		group.addLayers(markers);

		markers[0].__parent.spiderfy();

		group.removeLayers(markers);

		expect(group.hasLayer(markers[0])).to.be(false);
		expect(group.hasLayer(markers[1])).to.be(false);
		expect(group.hasLayer(markers[2])).to.be(false);

		expect(group.getLayers().length).to.be(0);
	});
});