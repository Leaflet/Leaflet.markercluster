import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';
import {MarkerCluster, latLngToNewLayerPoint} from '../src/MarkerCluster.js';

const isV1 = L.version.startsWith('1.');

describe('subclassing and extending', () => {
	let div, map;

	beforeEach(() => {
		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = new L.Map(div, {maxZoom: 18, trackResize: false});
		map.fitBounds(new L.LatLngBounds([[1, 1], [2, 2]]));
	});

	afterEach(() => {
		map.remove();
		div.remove();
	});

	function addTwoMarkers(group) {
		group.addLayers([new L.Marker([1.5, 1.5]), new L.Marker([1.5, 1.5])]);
		map.addLayer(group);
		return group._featureGroup.getLayers();
	}

	it('works as a base for ES classes', () => {
		class MyGroup extends MarkerClusterGroup {
			constructor(options) {
				super(options);
				this.mine = this._featureGroup instanceof L.FeatureGroup;
			}
		}
		const group = new MyGroup({maxClusterRadius: 10});

		expect(group.mine).toBe(true);
		expect(group.options.maxClusterRadius).toBe(10);
		expect(group.options.spiderfyOnMaxZoom).toBe(true);

		const visible = addTwoMarkers(group);
		expect(visible.length).toBe(1);
		expect(visible[0]).toBeInstanceOf(MarkerCluster);
	});

	it('runs init hooks after the constructor, without adding them to FeatureGroup', () => {
		let featureGroup;
		const hook = vi.fn(function () { featureGroup = this._featureGroup; }); // eslint-disable-line no-invalid-this
		MarkerClusterGroup.addInitHook(hook);

		const group = new MarkerClusterGroup();
		expect(new L.FeatureGroup()).toBeInstanceOf(L.FeatureGroup);

		expect(hook).toHaveBeenCalledOnce();
		expect(featureGroup).toBe(group._featureGroup);
	});

	it('keeps its default options apart from FeatureGroup', () => {
		MarkerClusterGroup.mergeOptions({customDefault: 1});

		expect(new MarkerClusterGroup().options.customDefault).toBe(1);
		expect(new L.FeatureGroup().options.customDefault).toBe(undefined);
	});

	it('takes methods with include', () => {
		MarkerClusterGroup.include({customMethod() { return this.getLayers().length; }});

		const group = new MarkerClusterGroup();
		addTwoMarkers(group);

		expect(group.customMethod()).toBe(2);
	});

	it.runIf(isV1)('works as a base for 1.x extend, with initialize calling the parent one', () => {
		const MyGroup = MarkerClusterGroup.extend({
			options: {maxClusterRadius: 10},
			initialize(options) {
				MarkerClusterGroup.prototype.initialize.call(this, options);
				this.mine = true;
			}
		});
		const hook = vi.fn();
		MyGroup.addInitHook(hook);

		const group = new MyGroup();

		expect(group.mine).toBe(true);
		expect(group.options.maxClusterRadius).toBe(10);
		expect(group.options.spiderfyOnMaxZoom).toBe(true);
		expect(hook).toHaveBeenCalledOnce();

		const visible = addTwoMarkers(group);
		expect(visible.length).toBe(1);
		expect(visible[0]).toBeInstanceOf(MarkerCluster);
	});

	it('pretends to be an icon with the Icon options', () => {
		const group = new MarkerClusterGroup();
		const [cluster] = addTwoMarkers(group);

		expect(cluster.options.icon).toBe(cluster);
		expect(cluster.options.popupAnchor).toEqual([0, 0]);
		expect(cluster.options.pane).toBe('markerPane');

		cluster.bindPopup('hi').openPopup();
		expect(cluster.isPopupOpen()).toBe(true);
	});
});

describe('cluster DOM events', () => {
	let div, map, group, cluster;

	beforeEach(() => {
		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = new L.Map(div, {maxZoom: 18, trackResize: false, zoomAnimation: false});
		map.fitBounds(new L.LatLngBounds([[1, 1], [2, 2]]));

		group = new MarkerClusterGroup();
		group.addLayers([
			new L.Marker([1.5, 1.5]),
			new L.Marker([1.5, 1.51]),
			new L.Marker([1.51, 1.5])
		]);
		map.addLayer(group);
		cluster = group._featureGroup.getLayers()[0];
	});

	afterEach(() => {
		map.remove();
		div.remove();
	});

	it('zooms to bounds once on Enter', () => {
		const zoomToBounds = vi.spyOn(cluster, 'zoomToBounds');
		const focus = vi.spyOn(map.getContainer(), 'focus');

		// 1.x fires keypress on the cluster, 2.0 turns keydown into a click
		const type = isV1 ? 'keypress' : 'keydown';
		cluster._icon.dispatchEvent(new KeyboardEvent(type, {key: 'Enter', bubbles: true}));

		expect(zoomToBounds).toHaveBeenCalledOnce();
		expect(focus).toHaveBeenCalled();
	});

	it.runIf(isV1)('ignores keys other than Enter on 1.x', () => {
		const zoomToBounds = vi.spyOn(cluster, 'zoomToBounds');
		cluster._icon.dispatchEvent(new KeyboardEvent('keypress', {key: 'a', bubbles: true}));
		expect(zoomToBounds).not.toHaveBeenCalled();
	});

	it('zooms to bounds on a click without refocusing the map', () => {
		const zoomToBounds = vi.spyOn(cluster, 'zoomToBounds');
		const focus = vi.spyOn(map.getContainer(), 'focus');

		cluster._icon.dispatchEvent(new MouseEvent('click', {bubbles: true, detail: 1}));

		expect(zoomToBounds).toHaveBeenCalledOnce();
		expect(focus).not.toHaveBeenCalled();
	});

	it('fires clustermouseover and clustermouseout and shows the coverage on hover', () => {
		const over = vi.fn();
		const out = vi.fn();
		group.on('clustermouseover', over);
		group.on('clustermouseout', out);

		const Event = isV1 ? MouseEvent : PointerEvent;
		cluster._icon.dispatchEvent(new Event(isV1 ? 'mouseover' : 'pointerover', {bubbles: true}));

		expect(over).toHaveBeenCalledOnce();
		expect(over.mock.calls[0][0].layer).toBe(cluster);
		expect(map.hasLayer(group._shownPolygon)).toBe(true);

		cluster._icon.dispatchEvent(new Event(isV1 ? 'mouseout' : 'pointerout', {bubbles: true}));

		expect(out).toHaveBeenCalledOnce();
		expect(group._shownPolygon).toBe(null);
	});

	it('ignores hover events between elements of the same cluster icon', () => {
		const over = vi.fn();
		const out = vi.fn();
		group.on('clustermouseover', over);
		group.on('clustermouseout', out);

		const Event = isV1 ? MouseEvent : PointerEvent;
		const icon = cluster._icon;
		const inner = icon.firstChild;
		icon.dispatchEvent(new Event(isV1 ? 'mouseout' : 'pointerout', {bubbles: true, relatedTarget: inner}));
		inner.dispatchEvent(new Event(isV1 ? 'mouseover' : 'pointerover', {bubbles: true, relatedTarget: icon}));

		expect(over).not.toHaveBeenCalled();
		expect(out).not.toHaveBeenCalled();
	});
});

describe('animated zoom', () => {
	let div, map;

	beforeEach(() => {
		div = document.createElement('div');
		div.style.width = '200px';
		div.style.height = '200px';
		document.body.appendChild(div);

		map = new L.Map(div, {maxZoom: 18, trackResize: false});
		map.fitBounds(new L.LatLngBounds([[1, 1], [2, 2]]));
	});

	afterEach(() => {
		map.remove();
		div.remove();
	});

	it('finds layer points after a zoom like the map does', () => {
		map.panBy([37, -21], {animate: false});
		const latlng = new L.LatLng(1.3, 1.7);

		for (const [zoom, center] of [[9, new L.LatLng(1.5, 1.5)], [6, new L.LatLng(1.1, 2.2)], [8.5, map.getCenter()]]) {
			expect(latLngToNewLayerPoint(map, latlng, zoom, center)).toEqual(map._latLngToNewLayerPoint(latlng, zoom, center));
		}
	});

	it('unspiderfies when the map zooms out with animation', async () => {
		const group = new MarkerClusterGroup();
		const markers = [new L.Marker([1.5, 1.5]), new L.Marker([1.5, 1.5]), new L.Marker([1.5, 1.5])];
		group.addLayers(markers);
		map.addLayer(group);

		const cluster = markers[0].__parent;
		const spiderfied = new Promise((resolve) => { group.once('spiderfied', resolve); });
		cluster.spiderfy();
		await spiderfied;
		expect(markers[0].getLatLng()).not.toEqual(new L.LatLng(1.5, 1.5));

		const unspiderfied = new Promise((resolve) => { group.once('unspiderfied', resolve); });
		const zoomed = new Promise((resolve) => { map.once('zoomend', resolve); });
		map.setZoom(map.getZoom() - 1);
		await Promise.all([unspiderfied, zoomed]);

		for (const marker of markers) {
			expect(marker.getLatLng()).toEqual(new L.LatLng(1.5, 1.5));
			expect(marker._spiderLeg).toBe(undefined);
		}
		expect(group._spiderfied).toBe(null);
	});
});
