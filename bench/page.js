/* global gc */
import * as L from 'leaflet';
import {MarkerClusterGroup} from '/src/index.js';

window.L = L;

const realWorld = await (await fetch('/data.json')).json();
const center = [-37.82, 175.23];
const mapOptions = {zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, maxZoom: 18};

let latlngs, map, group, markers;
const pause = ms => new Promise((res) => { setTimeout(res, ms); });

// forces the style and layout work a frame would do between steps, so that it's counted, and counted only once,
// rather than landing in whichever later call happens to flush it first
function flush() {
	map.getContainer().getBoundingClientRect();
}

function heap() {
	gc();
	return performance.memory.usedJSHeapSize;
}

function newMap() {
	const el = document.getElementById('map');
	el.replaceChildren(); // a fresh container for every map
	const container = el.appendChild(document.createElement('div'));
	container.style.cssText = 'width: 100%; height: 100%';
	return new L.Map(container, mapOptions).setView(center, 13);
}

const steps = {
	// clustering on add, with the group not on a map yet: clustering happens in onAdd
	addLayersOffMap() {
		const m = latlngs.map(p => new L.Marker(p));
		const g = new MarkerClusterGroup();
		const t = performance.now();
		g.addLayers(m);
		const result = performance.now() - t;
		steps._offMap = g;
		return result;
	},
	onAdd() {
		const mapOff = newMap();
		const t = performance.now();
		mapOff.addLayer(steps._offMap);
		const result = performance.now() - t;
		mapOff.remove();
		steps._offMap = null;
		return result;
	},
	addLayers() {
		map = newMap();
		group = new MarkerClusterGroup().addTo(map);
		markers = latlngs.map(p => new L.Marker(p));
		const before = heap();
		const t = performance.now();
		group.addLayers(markers);
		const result = performance.now() - t;
		steps._heap = (heap() - before) / markers.length;
		const t2 = performance.now();
		gc();
		steps._gc = performance.now() - t2;
		return result;
	},
	heap() {
		return steps._heap;
	},
	// a full GC with the group holding all markers
	gc() {
		return steps._gc;
	},
	zoomOut() {
		const t = performance.now();
		for (let z = 12; z >= 3; z--) { map.setZoom(z, {animate: false}); flush(); }
		return performance.now() - t;
	},
	zoomIn() {
		const t = performance.now();
		for (let z = 4; z <= 16; z++) { map.setZoom(z, {animate: false}); flush(); }
		return performance.now() - t;
	},
	async pan() {
		map.setView(center, 13, {animate: false});
		await pause(400); // past the group's zoom animation window, which ignores moveend
		const t = performance.now();
		for (let i = 0; i < 10; i++) { map.panBy([300, 0], {animate: false}); flush(); }
		for (let i = 0; i < 10; i++) { map.panBy([-300, 0], {animate: false}); flush(); }
		return performance.now() - t;
	},
	async removeHalf() {
		await pause(400);
		const half = markers.filter((_, i) => i % 2);
		const t = performance.now();
		group.removeLayers(half);
		return performance.now() - t;
	},
	clearLayers() {
		const t = performance.now();
		group.clearLayers();
		return performance.now() - t;
	}
};

// a small PRNG so that sparse runs are repeatable
function random(seed) {
	return () => {
		seed = seed + 0x6D2B79F5 | 0;
		let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}

window.bench = {
	// real-world points repeated, each copy after the first jittered by up to ~0.03°, or uniformly random points
	setup(n, sparse, minZoom) {
		mapOptions.minZoom = minZoom;
		latlngs = [];
		const rand = random(1);
		for (let i = 0; i < n; i++) {
			if (sparse) {
				latlngs.push([rand() * 130 - 60, rand() * 360 - 180]);
				continue;
			}
			const [lat, lng] = realWorld[i % realWorld.length];
			const k = Math.floor(i / realWorld.length);
			latlngs.push(k ? [lat + Math.sin(i) * 0.01 * k, lng + Math.cos(i) * 0.01 * k] : [lat, lng]);
		}
	},
	run(step) {
		return steps[step]();
	},
	teardown() {
		map.remove();
		map = group = markers = null;
	}
};
