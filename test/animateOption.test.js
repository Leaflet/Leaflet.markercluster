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

		// MCG animated methods are the class methods.
		const groupProto = MarkerClusterGroup.prototype;
		expect(group._animationStart).toBe(groupProto._animationStart);
		expect(group._animationZoomIn).toBe(groupProto._animationZoomIn);
		expect(group._animationZoomOut).toBe(groupProto._animationZoomOut);
		expect(group._animationAddLayer).toBe(groupProto._animationAddLayer);

		// MarkerCluster spiderfy animated methods
		const cluster = group._topClusterLevel,
			clusterProto = MarkerCluster.prototype;

		expect(cluster).not.toBeInstanceOf(MarkerClusterNonAnimated);
		expect(cluster._animationSpiderfy).toBe(clusterProto._animationSpiderfy);
		expect(cluster._animationUnspiderfy).toBe(clusterProto._animationUnspiderfy);

	});

	it('hooks non-animated methods version when set to false', () => {

		// Need to add to map so that we have the top cluster level created.
		group = new MarkerClusterGroup({animate: false}).addTo(map);

		// MCG non-animated methods replace the class methods on the instance.
		const groupProto = MarkerClusterGroup.prototype;
		for (const name of ['_animationStart', '_animationZoomIn', '_animationZoomOut', '_animationAddLayer']) {
			expect(Object.hasOwn(group, name)).toBe(true);
			expect(group[name]).not.toBe(groupProto[name]);
		}

		// MarkerCluster spiderfy non-animated methods
		const cluster = group._topClusterLevel,
			clusterProto = MarkerClusterNonAnimated.prototype;

		expect(cluster).toBeInstanceOf(MarkerClusterNonAnimated);
		expect(cluster._animationSpiderfy).toBe(clusterProto._animationSpiderfy);
		expect(cluster._animationUnspiderfy).toBe(clusterProto._animationUnspiderfy);

	});
});
