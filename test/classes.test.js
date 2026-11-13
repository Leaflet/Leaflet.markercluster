import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';
import {MarkerCluster, parents} from '../src/MarkerCluster.js';

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

		// 1.x fires keypress on the cluster, 2.0 turns keydown into a click
		const type = isV1 ? 'keypress' : 'keydown';
		cluster._icon.dispatchEvent(new KeyboardEvent(type, {key: 'Enter', bubbles: true}));

		expect(zoomToBounds).toHaveBeenCalledOnce();
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

	it('unspiderfies when the map zooms out with animation', async () => {
		const group = new MarkerClusterGroup();
		const markers = [new L.Marker([1.5, 1.5]), new L.Marker([1.5, 1.5]), new L.Marker([1.5, 1.5])];
		group.addLayers(markers);
		map.addLayer(group);

		const cluster = parents.get(markers[0]);
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
			expect(group._spiders.has(marker)).toBe(false);
		}
		expect(group._spiderfied).toBe(null);
	});

	async function spiderfyThree(latlngs = [[1.5, 1.5], [1.55, 1.5], [1.5, 1.55]]) {
		const group = new MarkerClusterGroup();
		const markers = latlngs.map(latlng => new L.Marker(latlng));
		group.addLayers(markers);
		map.addLayer(group);

		const cluster = group.getVisibleParent(markers[0]);
		const spiderfied = new Promise((resolve) => { group.once('spiderfied', resolve); });
		cluster.spiderfy();
		await spiderfied;
		return {group, markers, cluster};
	}

	// CSS zoom animations fire zoomanim right after zoomstart, live zooms fire zoom on every frame instead
	function nextZoomEvent() {
		return new Promise((resolve) => {
			map.once('zoomstart', () => {
				const done = (/** @type {{type: string}} */ e) => {
					map.off('zoomanim zoom', done);
					resolve(e.type);
				};
				map.on('zoomanim zoom', done);
			});
		});
	}

	it('unspiderfies along with a zoom animation, moving markers to the cluster from where the zoom takes them', async ({skip}) => {
		const {markers, cluster} = await spiderfyThree();

		const zoomEvent = nextZoomEvent();
		const zoomend = new Promise((resolve) => { map.once('zoomend', resolve); });
		map.setZoom(map.getZoom() + 1);
		if (await zoomEvent !== 'zoomanim') {
			skip('Leaflet zooms live');
		}
		await Promise.resolve();

		// the map is at the new zoom now, and the marker at its real latlng, which the zoom transition moves it to
		const el = markers[0].getElement();
		const [move] = el.getAnimations().map(a => a.effect.getKeyframes()).filter(k => k[0].translate);
		const [from, to] = move.map(k => k.translate.split(' ').map(parseFloat)).map(([x, y = 0]) => new L.Point(x, y));
		const offset = map.latLngToLayerPoint(cluster.getLatLng()).round()
			.subtract(map.latLngToLayerPoint(markers[0].getLatLng()).round());

		expect(markers[0].getLatLng()).toEqual(new L.LatLng(1.5, 1.5));
		expect(cluster).toBeInstanceOf(MarkerCluster);
		expect(offset.x).toBeGreaterThan(0);
		expect(from).toEqual(new L.Point(0, 0));
		expect(to).toEqual(offset);
		await zoomend; // 1.x doesn't cancel the end of a zoom animation on remove()
	});

	it('fades the spider out in place during a live zoom, and removes it on zoomend', async () => {
		const {group, markers, cluster} = await spiderfyThree();
		const spiderLatLng = markers[0].getLatLng();

		// flyTo zooms live in every version
		const zoomEvent = nextZoomEvent();
		const moveend = new Promise((resolve) => { map.once('moveend', resolve); });
		map.flyTo(map.getCenter(), map.getZoom() - 1, {duration: 0.3});
		expect(await zoomEvent).toBe('zoom');

		const el = markers[0].getElement();
		const leg = group._spiders.get(markers[0]).leg;
		expect(group._spiderfied).toBe(cluster);
		expect(markers[0].getLatLng()).toEqual(spiderLatLng);
		expect(el.style.opacity).toBe('0');
		expect(el.getAnimations().some(a => a.effect.getKeyframes()[0].opacity === '1')).toBe(true);
		expect(el.getAnimations().some(a => a.effect.getKeyframes().some(k => k.translate))).toBe(false);
		expect(leg.options.opacity).toBe(0);

		await moveend;
		expect(group._spiderfied).toBe(null);
		expect(map.hasLayer(leg)).toBe(false);
		for (const marker of markers) {
			expect(group._spiders.has(marker)).toBe(false);
			expect(map.hasLayer(marker)).toBe(false);
		}
		expect(markers[0].getLatLng()).toEqual(new L.LatLng(1.5, 1.5));
		expect(el.style.opacity).toBe('1');
		expect(el.getAnimations()).toEqual([]);
	});

	it('removes the fading spider right away when its cluster is clicked during a live zoom', async () => {
		const {group, markers, cluster} = await spiderfyThree();

		const zoomEvent = nextZoomEvent();
		const moveend = new Promise((resolve) => { map.once('moveend', resolve); });
		map.flyTo(map.getCenter(), map.getZoom() - 1, {duration: 0.3});
		await zoomEvent;

		const leg = group._spiders.get(markers[0]).leg;
		cluster.fire('click', null, true);
		expect(group._spiderfied).toBe(null);
		expect(cluster._fading).toBe(false);
		expect(map.hasLayer(leg)).toBe(false);
		expect(markers[0].getLatLng()).toEqual(new L.LatLng(1.5, 1.5));
		await moveend;
	});

	it('shows spiderfied markers on their own when a zoom splits their cluster', async () => {
		const {group, markers} = await spiderfyThree([[1.5, 1.5], [1.5, 1.7], [1.7, 1.5]]);

		const animationend = new Promise((resolve) => { group.once('animationend', resolve); });
		map.setZoom(map.getZoom() + 3, {animate: false});
		expect(group._spiderfied).toBe(null);
		await animationend; // the split animation

		const elements = markers.map(m => m.getElement());
		await Promise.all(elements.flatMap(el => el.getAnimations().map(a => a.finished)));
		for (const marker of markers) {
			expect(group.getVisibleParent(marker)).toBe(marker);
			expect(map.hasLayer(marker)).toBe(true);
			expect(getComputedStyle(marker.getElement()).opacity).toBe('1');
		}
	});
});
