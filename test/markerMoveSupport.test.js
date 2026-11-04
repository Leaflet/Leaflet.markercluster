import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';
import {parents} from '../src/MarkerCluster.js';

const isV1 = L.version.startsWith('1.');

/**
 * Starts dragging the marker's icon through Leaflet's Draggable, with pointer events (mouse events on 1.x, whose drag
 * moves on the next frame).
 */
function drag(marker) {
	const el = marker.getElement(),
		rect = el.getBoundingClientRect();
	let x = rect.left + rect.width / 2,
		y = rect.top + rect.height / 2;
	const fire = type => el.dispatchEvent(new (isV1 ? MouseEvent : PointerEvent)((isV1 ? 'mouse' : 'pointer') + type,
		{clientX: x, clientY: y, bubbles: true, button: 0, buttons: 1, pointerId: 1, isPrimary: true, pointerType: 'mouse'}));

	fire('down');
	return {
		move(offset) {
			x += offset.x;
			y += offset.y;
			fire('move');
			vi.advanceTimersToNextFrame();
		},
		end() {
			fire('up');
		}
	};
}

describe('moving markers', () => {
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


	/////////////////////////////
	// TESTS
	/////////////////////////////
	it('reclusters a marker moved on the map', () => {

		group = new MarkerClusterGroup();
		map.addLayer(group);

		const marker = new L.Marker([1.5, 1.5]);
		const marker2 = new L.Marker([1.5, 1.5]);
		group.addLayers([marker, marker2]);
		expect(group.getVisibleParent(marker)).not.toBe(marker);

		marker.setLatLng([1.1, 1.9]);

		expect(group.getVisibleParent(marker)).toBe(marker);
		expect(group.getVisibleParent(marker2)).toBe(marker2);
		expect(group._gridUnclustered[18].getNearObject(map.project([1.5, 1.5], 18))).toBe(marker2);
		expect(group.getLayers().length).toBe(2);
	});

	it('reclusters a dragged marker on dragend', () => {

		group = new MarkerClusterGroup();
		map.addLayer(group);

		const marker = new L.Marker([1.1, 1.9], {draggable: true});
		const marker2 = new L.Marker([1.5, 1.5]);
		group.addLayers([marker, marker2]);

		const dragged = drag(marker);
		dragged.move(map.latLngToContainerPoint([1.5, 1.5]).subtract(map.latLngToContainerPoint([1.1, 1.9])));
		expect(marker.getLatLng().distanceTo([1.5, 1.5])).toBeLessThan(1000);
		expect(group.getVisibleParent(marker)).toBe(marker);

		dragged.end();
		expect(group.getVisibleParent(marker)).not.toBe(marker);
		expect(group.getVisibleParent(marker)).toBe(group.getVisibleParent(marker2));
		expect(group.getLayers().length).toBe(2);
	});

	it('listens to dragend only during a drag', () => {
		group = new MarkerClusterGroup();
		map.addLayer(group);

		const marker = new L.Marker([1.1, 1.9], {draggable: true});
		group.addLayers([marker, new L.Marker([1.5, 1.5])]);
		expect(marker.listens('dragend')).toBe(false);

		const dragged = drag(marker);
		dragged.move(new L.Point(20, 0));
		expect(marker.listens('dragend')).toBe(true);
		expect(parents.get(marker)).toBe(undefined);

		dragged.end();
		expect(marker.listens('dragend')).toBe(false);
		expect(parents.get(marker)).not.toBe(undefined);
	});

	it('does not add back a marker removed during a drag', () => {
		group = new MarkerClusterGroup();
		map.addLayer(group);

		const marker = new L.Marker([1.1, 1.9], {draggable: true});
		group.addLayers([marker, new L.Marker([1.5, 1.5])]);

		const dragged = drag(marker);
		dragged.move(new L.Point(20, 0));
		group.removeLayer(marker);
		expect(marker.listens('dragend')).toBe(false);

		dragged.end();
		expect(group.hasLayer(marker)).toBe(false);
		expect(group.getLayers().length).toBe(1);
	});

	it('moves a marker that was moved while off the map', () => {

		group = new MarkerClusterGroup();

		const marker = new L.Marker([10, 10]);
		map.addLayer(group);
		group.addLayer(marker);

		map.removeLayer(group);
		marker.setLatLng([1.5, 1.5]);
		map.addLayer(group);

		expect(group.getLayers().length).toBe(1);
	});

	it('moves multiple markers that were moved while off the map', () => {

		group = new MarkerClusterGroup();
		map.addLayer(group);

		const markers = [];
		for (let i = 0; i < 10; i++) {
			const marker = new L.Marker([10, 10]);
			group.addLayer(marker);
			markers.push(marker);
		}

		map.removeLayer(group);
		for (let i = 0; i < 10; i++) {
			markers[i].setLatLng([1.5, 1.5]);
		}
		map.addLayer(group);

		expect(group.getLayers().length).toBe(10);
	});

	it('does not add back a marker moved after removeLayers', () => {
		group = new MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayers([marker]);
		group.removeLayers([marker]);
		marker.setLatLng([1.6, 1.6]);

		expect(group.hasLayer(marker)).toBe(false);
	});

	it('does not add back a marker removed while off the map and moved', () => {
		group = new MarkerClusterGroup();
		const marker = new L.Marker([1.5, 1.5]);

		map.addLayer(group);
		group.addLayer(marker);
		map.removeLayer(group);
		group.removeLayer(marker);
		marker.setLatLng([1.6, 1.6]);

		expect(group.hasLayer(marker)).toBe(false);

		map.addLayer(group);
		marker.setLatLng([1.7, 1.7]);

		expect(group.hasLayer(marker)).toBe(false);
		expect(group.getLayers()).toEqual([]);
	});

	it('keeps a dragged marker shown when zooming out during the drag', () => {
		group = new MarkerClusterGroup({animate: false, removeOutsideVisibleBounds: false});
		map.addLayer(group);

		const marker = new L.Marker([1.1, 1.9], {draggable: true}),
			others = [new L.Marker([1.5, 1.5]), new L.Marker([1.5, 1.5])];
		group.addLayers([marker, ...others]);

		const dragged = drag(marker);
		dragged.move(new L.Point(20, 0));
		expect(group.hasLayer(marker)).toBe(true);
		expect(group.getLayers().length).toBe(3);

		map.setZoom(3, {animate: false});
		expect(group.getVisibleParent(marker)).toBe(marker);
		expect(marker.getElement().isConnected).toBe(true);
		expect(group.getVisibleParent(others[0]).getChildCount()).toBe(2);

		dragged.end();
		expect(group.getVisibleParent(marker).getChildCount()).toBe(3);
		expect(group.getLayers().length).toBe(3);
	});

	it('keeps a spiderfied marker where it was dragged', () => {
		map.setView([1.5, 1.5], 18, {animate: false});
		group = new MarkerClusterGroup();
		map.addLayer(group);

		const marker = new L.Marker([1.5, 1.5], {draggable: true}),
			others = [new L.Marker([1.5, 1.5]), new L.Marker([1.5, 1.5])];
		group.addLayers([marker, ...others]);
		parents.get(marker).spiderfy();
		vi.runAllTimers();

		const dragged = drag(marker);
		dragged.move(new L.Point(100, 0));
		const latlng = marker.getLatLng();
		expect(latlng.lng).toBeGreaterThan(1.5);
		expect(group._spiders.has(marker)).toBe(false);

		dragged.end();
		vi.runAllTimers();
		expect(marker.getLatLng()).toEqual(latlng);
		expect(group.getVisibleParent(marker)).toBe(marker);
		expect(group.getVisibleParent(others[0]).getChildCount()).toBe(2);
		expect(group._spiders.size).toBe(0);
	});

	it('clusters a marker dragged when the group was removed from the map', () => {
		group = new MarkerClusterGroup();
		map.addLayer(group);

		const marker = new L.Marker([1.1, 1.9], {draggable: true});
		group.addLayers([marker, new L.Marker([1.5, 1.5])]);

		const dragged = drag(marker);
		dragged.move(new L.Point(20, 0));
		map.removeLayer(group);
		dragged.end();
		expect(marker.listens('dragend')).toBe(false);

		map.addLayer(group);
		expect(group.getLayers().length).toBe(2);
		expect(group.getVisibleParent(marker)).toBe(marker);
	});
});
