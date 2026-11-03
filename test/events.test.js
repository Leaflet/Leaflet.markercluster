import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('events', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let div, map, group;

	beforeEach(() => {
		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = L.map(div, {maxZoom: 18, trackResize: false});

		// Corresponds to zoom level 8 for the above div dimensions.
		map.fitBounds(new L.LatLngBounds([
			[1, 1],
			[2, 2]
		]));
	});

	afterEach(() => {
		if (group instanceof L.MarkerClusterGroup) {
			group.removeLayers(group.getLayers());
			map.removeLayer(group);
		}

		map.remove();
		div.remove();

		div = map = group = null;
	});

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('is fired for a single child marker', () => {
		const callback = vi.fn();

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);

		group.on('click', callback);
		group.addLayer(marker);
		map.addLayer(group);

		// In Leaflet 1.0.0, event propagation must be explicitly set by 3rd argument.
		marker.fire('click', null, true);

		expect(callback).toHaveBeenCalled();
	});

	it('is fired for a child polygon', () => {
		const callback = vi.fn();

		group = new L.MarkerClusterGroup();

		const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

		group.on('click', callback);
		group.addLayer(polygon);
		map.addLayer(group);

		polygon.fire('click', null, true);

		expect(callback).toHaveBeenCalled();
	});

	it('is fired for a cluster click', () => {
		const callback = vi.fn();

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.on('clusterclick', callback);
		group.addLayers([marker, marker2]);
		map.addLayer(group);

		const cluster = group.getVisibleParent(marker);
		expect(cluster instanceof L.MarkerCluster).toBe(true);

		cluster.fire('click', null, true);

		expect(callback).toHaveBeenCalled();
	});

	describe('after being added, removed, re-added from the map', () => {

		it('still fires events for nonpoint data', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup();

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);

			group.on('click', callback);
			group.addLayer(polygon);
			map.addLayer(group);
			map.removeLayer(group);
			map.addLayer(group);

			polygon.fire('click', null, true);

			expect(callback).toHaveBeenCalled();
		});

		it('still fires events for point data', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup();

			const marker = new L.Marker([1.5, 1.5]);

			group.on('click', callback);
			group.addLayer(marker);
			map.addLayer(group);
			map.removeLayer(group);
			map.addLayer(group);

			marker.fire('click', null, true);

			expect(callback).toHaveBeenCalled();
		});

		it('still fires cluster events', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup();

			const marker = new L.Marker([1.5, 1.5]);
			const marker2 = new L.Marker([1.5, 1.5]);

			group.on('clusterclick', callback);
			group.addLayers([marker, marker2]);
			map.addLayer(group);

			map.removeLayer(group);
			map.addLayer(group);

			const cluster = group.getVisibleParent(marker);
			expect(cluster instanceof L.MarkerCluster).toBe(true);

			cluster.fire('click', null, true);

			expect(callback).toHaveBeenCalled();
		});

		it('does not break map events', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup();

			map.on('zoomend', callback);
			map.addLayer(group);

			map.removeLayer(group);
			map.addLayer(group);

			map.fire('zoomend');

			expect(callback).toHaveBeenCalled();
		});

		//layeradd
		it('fires layeradd when markers are added while not on the map', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup();
			group.on('layeradd', callback);

			const marker = new L.Marker([1.5, 1.5]);
			group.addLayer(marker);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('fires layeradd when vectors are added while not on the map', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup();
			group.on('layeradd', callback);

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);
			group.addLayer(polygon);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('fires layeradd when markers are added while on the map', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup();
			group.on('layeradd', callback);
			map.addLayer(group);

			const marker = new L.Marker([1.5, 1.5]);
			group.addLayer(marker);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('fires layeradd when vectors are added while on the map', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup();
			group.on('layeradd', callback);
			map.addLayer(group);

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);
			group.addLayer(polygon);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('fires layeradd when markers are added using addLayers while on the map with chunked loading', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup({chunkedLoading: true});
			group.on('layeradd', callback);
			map.addLayer(group);

			const marker = new L.Marker([1.5, 1.5]);
			group.addLayers([marker]);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('fires layeradd when vectors are added using addLayers while on the map with chunked loading', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup({chunkedLoading: true});
			group.on('layeradd', callback);
			map.addLayer(group);

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);
			group.addLayers([polygon]);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		//layerremove
		it('fires layerremove when a marker is removed while not on the map', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup();
			group.on('layerremove', callback);

			const marker = new L.Marker([1.5, 1.5]);
			group.addLayer(marker);
			group.removeLayer(marker);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('fires layerremove when a vector is removed while not on the map', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup();
			group.on('layerremove', callback);

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);
			group.addLayer(polygon);
			group.removeLayer(polygon);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('fires layerremove when a marker is removed while on the map', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup();
			group.on('layerremove', callback);
			map.addLayer(group);

			const marker = new L.Marker([1.5, 1.5]);
			group.addLayer(marker);
			group.removeLayer(marker);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('fires layerremove when a vector is removed while on the map', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup();
			group.on('layerremove', callback);
			map.addLayer(group);

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);
			group.addLayer(polygon);
			group.removeLayer(polygon);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('fires layerremove when a marker is removed using removeLayers while on the map with chunked loading', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup({chunkedLoading: true});
			group.on('layerremove', callback);
			map.addLayer(group);

			const marker = new L.Marker([1.5, 1.5]);
			group.addLayers([marker]);
			group.removeLayers([marker]);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('fires layerremove when a vector is removed using removeLayers while on the map with chunked loading', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup({chunkedLoading: true});
			group.on('layerremove', callback);
			map.addLayer(group);

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);
			group.addLayers([polygon]);
			group.removeLayers([polygon]);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('fires layerremove when a marker is removed using removeLayers while not on the map with chunked loading', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup({chunkedLoading: true});
			group.on('layerremove', callback);

			const marker = new L.Marker([1.5, 1.5]);
			group.addLayers([marker]);
			group.removeLayers([marker]);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('fires layerremove when a vector is removed using removeLayers while not on the map with chunked loading', () => {
			const callback = vi.fn();

			group = new L.MarkerClusterGroup({chunkedLoading: true});
			group.on('layerremove', callback);

			const polygon = new L.Polygon([[1.5, 1.5], [2.0, 1.5], [2.0, 2.0], [1.5, 2.0]]);
			group.addLayers([polygon]);
			group.removeLayers([polygon]);

			expect(callback).toHaveBeenCalledTimes(1);
		});
	});

	/*
	//No normal events can be fired by a clustered marker, so probably don't need this.
	it('is fired for a clustered child marker', function() {
		var callback = vi.fn();

		group = new L.MarkerClusterGroup();

		var marker = new L.Marker([1.5, 1.5]);
		var marker2 = new L.Marker([1.5, 1.5]);

		group.on('click', callback);
		group.addLayers([marker, marker2]);
		map.addLayer(group);

		marker.fire('click');

		expect(callback).toHaveBeenCalled();
	});
	*/
});
