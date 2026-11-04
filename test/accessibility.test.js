import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';
import {parents} from '../src/MarkerCluster.js';

const isV1 = L.version.startsWith('1.');

// Enter on a cluster: 1.x fires keypress on it, 2.0 turns keydown into a click
function pressEnter(el) {
	el.dispatchEvent(new KeyboardEvent(isV1 ? 'keypress' : 'keydown', {key: 'Enter', bubbles: true}));
}

function pressEscape(el) {
	el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
}

describe('accessibility', () => {
	let div, map, group;

	beforeEach(() => {
		vi.useFakeTimers();

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
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	function addCluster(options, latlngs = [[1.5, 1.5], [1.5, 1.5], [1.5, 1.5]]) {
		group = new MarkerClusterGroup(options).addTo(map);
		const markers = latlngs.map(latlng => new L.Marker(latlng));
		group.addLayers(markers);
		return {markers, cluster: group.getVisibleParent(markers[0])};
	}

	it('names cluster buttons with the marker count', () => {
		const {cluster} = addCluster();
		const icon = cluster.getElement();

		expect(icon.getAttribute('role')).toBe('button');
		expect(icon.getAttribute('aria-label')).toBe('3 markers');
		expect(icon.querySelector('[aria-label]')).toBe(null);

		group.addLayer(new L.Marker([1.5, 1.5]));
		expect(cluster.getElement().getAttribute('aria-label')).toBe('4 markers');
	});

	it('names cluster buttons with clusterLabel', () => {
		const {cluster} = addCluster({clusterLabel: c => `${c.getChildCount()} Markierungen`});
		expect(cluster.getElement().getAttribute('aria-label')).toBe('3 Markierungen');
	});

	it('marks clusters that spiderfy as expandable', () => {
		const {cluster} = addCluster();
		const {cluster: zooming} = addCluster(undefined, [[1.1, 1.1], [1.1, 1.102]]);

		expect(cluster.getElement().getAttribute('aria-expanded')).toBe('false');
		expect(zooming.getElement().hasAttribute('aria-expanded')).toBe(false);

		cluster.spiderfy();
		expect(cluster.getElement().getAttribute('aria-expanded')).toBe('true');
		vi.runAllTimers();

		cluster.unspiderfy();
		expect(cluster.getElement().getAttribute('aria-expanded')).toBe('false');
	});

	it('puts the spiderfied markers right after the cluster in the tab order', () => {
		const {markers, cluster} = addCluster();
		group.addLayer(new L.Marker([1.9, 1.9]));
		const icon = cluster.getElement();
		icon.focus();

		pressEnter(icon);
		expect(group._spiderfied).toBe(cluster);
		expect(document.activeElement).toBe(icon);

		const next = [];
		for (let el = icon.nextElementSibling; next.length < markers.length; el = el.nextElementSibling) next.push(el);
		expect(new Set(next)).toEqual(new Set(markers.map(m => m.getElement())));
	});

	it('takes focus from a spiderfied marker back to the cluster on Escape', () => {
		const {markers, cluster} = addCluster();
		cluster.spiderfy();
		vi.runAllTimers();
		markers[1].getElement().focus();

		pressEscape(markers[1].getElement());
		expect(group._spiderfied).toBe(null);
		expect(document.activeElement).toBe(cluster.getElement());
		vi.runAllTimers();
		expect(group.getVisibleParent(markers[0])).toBe(cluster);
	});

	it('leaves Escape to an open popup first', () => {
		const {markers, cluster} = addCluster();
		cluster.spiderfy();
		vi.runAllTimers();
		markers[0].bindPopup('hi').openPopup();

		pressEscape(markers[0].getElement());

		expect(markers[0].isPopupOpen()).toBe(false);
		// 1.x closes popups from a document listener, after ours
		expect(group._spiderfied).toBe(isV1 ? null : cluster);
	});

	it('does not move focus on a click', () => {
		const {cluster} = addCluster();
		cluster.getElement().dispatchEvent(new MouseEvent('click', {bubbles: true, detail: 1}));

		expect(group._spiderfied).toBe(cluster);
		expect(document.activeElement).toBe(document.body);
	});

	it('unspiderfies when a spiderfied cluster is activated again', () => {
		const {cluster} = addCluster();
		const icon = cluster.getElement();

		icon.dispatchEvent(new MouseEvent('click', {bubbles: true, detail: 1}));
		expect(group._spiderfied).toBe(cluster);
		vi.runAllTimers();

		icon.dispatchEvent(new MouseEvent('click', {bubbles: true, detail: 1}));
		expect(group._spiderfied).toBe(null);
	});

	it('moves focus to the map when a focused cluster is removed', () => {
		const {cluster} = addCluster(undefined, [[1.1, 1.1], [1.1, 1.102]]);
		cluster.getElement().focus();

		pressEnter(cluster.getElement());
		vi.runAllTimers();

		expect(map.hasLayer(cluster)).toBe(false);
		expect(document.activeElement).toBe(map.getContainer());
	});

	it('shows the coverage of a focused cluster', () => {
		const {cluster} = addCluster(undefined, [[1.4, 1.4], [1.4, 1.6], [1.6, 1.5]]);
		const icon = cluster.getElement();

		icon.focus();
		expect(map.hasLayer(group._shownPolygon)).toBe(true);

		icon.blur();
		expect(group._shownPolygon).toBe(null);
	});

	it('fades instead of moving markers with reduced motion', () => {
		vi.spyOn(MediaQueryList.prototype, 'matches', 'get').mockReturnValue(true);

		const {markers} = addCluster();
		parents.get(markers[0]).spiderfy();

		const animations = markers[0].getElement().getAnimations();
		expect(animations.length).toBeGreaterThan(0);
		for (const anim of animations) {
			const properties = anim.effect.getKeyframes().flatMap(Object.keys);
			expect(properties).not.toContain('translate');
		}
	});
});
