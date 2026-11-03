import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import * as L from 'leaflet';
import {MarkerClusterGroup} from '../src/MarkerClusterGroup.js';
import {MarkerCluster, MarkerClusterNonAnimated} from '../src/MarkerCluster.js';

describe('animate option', () => {
	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////
	let div, map, group;

	beforeEach(() => {
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
	it('hooks animated methods version by default', () => {

		// Need to add to map so that we have the top cluster level created.
		group = new MarkerClusterGroup().addTo(map);

		let withAnimation = MarkerClusterGroup.prototype._withAnimation;

		// MCG animated methods.
		expect(group._animationStart).toBe(withAnimation._animationStart);
		expect(group._animationZoomIn).toBe(withAnimation._animationZoomIn);
		expect(group._animationZoomOut).toBe(withAnimation._animationZoomOut);
		expect(group._animationAddLayer).toBe(withAnimation._animationAddLayer);

		// MarkerCluster spiderfy animated methods
		const cluster = group._topClusterLevel;

		withAnimation = MarkerCluster.prototype;

		expect(cluster._animationSpiderfy).toBe(withAnimation._animationSpiderfy);
		expect(cluster._animationUnspiderfy).toBe(withAnimation._animationUnspiderfy);

	});

	it('hooks non-animated methods version when set to false', () => {

		// Need to add to map so that we have the top cluster level created.
		group = new MarkerClusterGroup({animate: false}).addTo(map);

		let noAnimation = MarkerClusterGroup.prototype._noAnimation;

		// MCG non-animated methods.
		expect(group._animationStart).toBe(noAnimation._animationStart);
		expect(group._animationZoomIn).toBe(noAnimation._animationZoomIn);
		expect(group._animationZoomOut).toBe(noAnimation._animationZoomOut);
		expect(group._animationAddLayer).toBe(noAnimation._animationAddLayer);

		// MarkerCluster spiderfy non-animated methods
		const cluster = group._topClusterLevel;

		noAnimation = MarkerClusterNonAnimated.prototype;

		expect(cluster._animationSpiderfy).toBe(noAnimation._animationSpiderfy);
		expect(cluster._animationUnspiderfy).toBe(noAnimation._animationUnspiderfy);

	});
});
