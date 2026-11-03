import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('spiderfy', () => {
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
		vi.useRealTimers();

		div = map = group = null;
	});

	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('Spiderfies 2 Markers', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayer(marker);
		group.addLayer(marker2);
		map.addLayer(group);

		marker.__parent.spiderfy();

		expect(marker._icon.parentNode).toBe(map._panes.markerPane);
		expect(marker2._icon.parentNode).toBe(map._panes.markerPane);
	});

	it('Spiderfies 2 CircleMarkers', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.CircleMarker([1.5, 1.5]);
		const marker2 = new L.CircleMarker([1.5, 1.5]);

		group.addLayer(marker);
		group.addLayer(marker2);
		map.addLayer(group);

		marker.__parent.spiderfy();

		// Leaflet 1.0.0 now uses an intermediate L.Renderer.
		// marker > _path > _rootGroup (g) > _container (svg) > pane (div)
		expect(marker._path.parentNode.parentNode.parentNode).toBe(map.getPane('overlayPane'));
		expect(marker2._path.parentNode.parentNode.parentNode).toBe(map.getPane('overlayPane'));
	});

	it('Spiderfies 2 Circles', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Circle([1.5, 1.5], 10);
		const marker2 = new L.Circle([1.5, 1.5], 10);

		group.addLayer(marker);
		group.addLayer(marker2);
		map.addLayer(group);

		marker.__parent.spiderfy();

		expect(marker._path.parentNode.parentNode.parentNode).toBe(map.getPane('overlayPane'));
		expect(marker2._path.parentNode.parentNode.parentNode).toBe(map.getPane('overlayPane'));
	});

	it('Spiderfies at current zoom if all child markers are at the exact same position', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		// Get the appropriate cluster.
		const zoom = map.getZoom();
		let cluster = marker.__parent;

		while (cluster._zoom !== zoom) {
			cluster = cluster.__parent;
		}

		expect(zoom).toBeLessThan(10);

		cluster.fireEvent('click', null, true);

		vi.advanceTimersByTime(1000);

		expect(map.getZoom()).toBe(zoom);

		expect(marker._icon.parentNode).toBe(map._panes.markerPane);
		expect(marker2._icon.parentNode).toBe(map._panes.markerPane);

	});

	it('Spiderfies at current zoom if all child markers are still within a single cluster at map maxZoom', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.50001]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		expect(marker.__parent._zoom).toBe(18);

		// Get the appropriate cluster.
		const zoom = map.getZoom();
		let cluster = marker.__parent;

		while (cluster._zoom !== zoom) {
			cluster = cluster.__parent;
		}

		expect(zoom).toBeLessThan(10);

		cluster.fireEvent('click', null, true);

		vi.advanceTimersByTime(1000);

		expect(map.getZoom()).toBe(zoom);

		expect(marker._icon.parentNode).toBe(map._panes.markerPane);
		expect(marker2._icon.parentNode).toBe(map._panes.markerPane);

	});

	it('removes all markers and spider legs when group is removed from map', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		marker.__parent.spiderfy();

		expect(map._panes.markerPane.childNodes.length).toBe(3); // The 2 markers + semi-transparent cluster.
		expect(map.getPane('overlayPane').firstChild.firstChild.childNodes.length).toBe(2); // The 2 spider legs.

	});

	it('adds then removes class "leaflet-cluster-anim" from mapPane on spiderfy', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		marker.__parent.spiderfy();

		expect(map._panes.mapPane.className).toContain('leaflet-cluster-anim');

		vi.advanceTimersByTime(1000);

		expect(map._panes.mapPane.className).not.toContain('leaflet-cluster-anim');

	});

	it('adds then removes class "leaflet-cluster-anim" from mapPane on unspiderfy', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		marker.__parent.spiderfy();

		vi.advanceTimersByTime(1000);

		marker.__parent.unspiderfy();

		expect(map._panes.mapPane.className).toContain('leaflet-cluster-anim');

		vi.advanceTimersByTime(1000);

		expect(map._panes.mapPane.className).not.toContain('leaflet-cluster-anim');

	});

	it('fires unspiderfied event on unspiderfy', () => {
		const fired = vi.fn();

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		marker.__parent.spiderfy();

		vi.advanceTimersByTime(1000);

		// Add event listener
		group.on('unspiderfied', (event) => {
			expect(event.target).toBe(group);
			expect(event.cluster).toBeInstanceOf(L.Marker);
			expect(event.markers[1]).toBe(marker);
			expect(event.markers[0]).toBe(marker2);

			fired();
		});

		marker.__parent.unspiderfy();

		vi.advanceTimersByTime(1000);
		expect(fired).toHaveBeenCalledOnce();
	});

	it('does not leave class "leaflet-cluster-anim" on mapPane when group is removed while spiderfied', () => {

		group = new L.MarkerClusterGroup();

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		group.addLayers([marker, marker2]);
		map.addLayer(group);

		marker.__parent.spiderfy();

		vi.advanceTimersByTime(1000);

		map.removeLayer(group);

		expect(map._panes.mapPane.className).not.toContain('leaflet-cluster-anim');

	});

	it('overrides spiderfy shape positions when custom function has been provided', () => {

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);

		const spiderfyShapePositionsFuntion =  vi.fn(() => [{x: 1.6, y: 1.6}, {x: 1.6, y: 1.6}]
		);

		group = new L.MarkerClusterGroup({spiderfyShapePositions: spiderfyShapePositionsFuntion});

		group.addLayer(marker);
		group.addLayer(marker2);
		map.addLayer(group);

		marker.__parent.spiderfy();

		expect(spiderfyShapePositionsFuntion).toHaveBeenCalledOnce();
	});

	describe('zoomend event listener', () => {

		it('unspiderfies correctly', () => {

			group = new L.MarkerClusterGroup();

			const marker = new L.Circle([1.5, 1.5], 10);
			const marker2 = new L.Circle([1.5, 1.5], 10);

			group.addLayer(marker);
			group.addLayer(marker2);
			map.addLayer(group);

			marker.__parent.spiderfy();

			expect(group._spiderfied).not.toBe(null);

			map.fire('zoomend');

			//We should unspiderfy with no animation, so this should be null
			expect(group._spiderfied).toBe(null);
		});

	});

	describe('spiderfied event listener', () => {
		it('Spiderfies 2 Markers', () => {
			const fired = vi.fn();

			group = new L.MarkerClusterGroup();
			const marker = new L.Marker([1.5, 1.5]);
			const marker2 = new L.Marker([1.5, 1.5]);

			group.addLayer(marker);
			group.addLayer(marker2);
			map.addLayer(group);

			// Add event listener
			group.on('spiderfied', (event) => {
				expect(event.target).toBe(group);
				expect(event.cluster).toBeInstanceOf(L.Marker);
				expect(event.markers[1]).toBe(marker);
				expect(event.markers[0]).toBe(marker2);

				fired();
			});

			marker.__parent.spiderfy();

			vi.advanceTimersByTime(200);
			expect(fired).toHaveBeenCalledOnce();
		});

		it('Spiderfies 2 Circles', () => {
			const fired = vi.fn();

			group = new L.MarkerClusterGroup();
			const marker = new L.Circle([1.5, 1.5], 10);
			const marker2 = new L.Circle([1.5, 1.5], 10);

			group.addLayer(marker);
			group.addLayer(marker2);
			map.addLayer(group);

			// Add event listener
			group.on('spiderfied', (event) => {
				expect(event.target).toBe(group);
				expect(event.cluster).toBeInstanceOf(L.Marker);
				expect(event.markers[1]).toBe(marker);
				expect(event.markers[0]).toBe(marker2);

				fired();
			});

			marker.__parent.spiderfy();

			vi.advanceTimersByTime(200);
			expect(fired).toHaveBeenCalledOnce();
		});
	});
});
