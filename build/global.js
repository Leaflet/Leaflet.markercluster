import {MarkerClusterGroup, MarkerCluster} from '../src/index.js';
import {DistanceGrid} from '../src/DistanceGrid.js';

// leaflet is external here and resolves to window.L, from 1.x's leaflet.js or 2.0's leaflet-global.js
const L = window.L;
L.MarkerClusterGroup = MarkerClusterGroup;
L.MarkerCluster = MarkerCluster;

// not public API, but tech detectors (Wappalyzer and the like) recognize the plugin by this global
L.DistanceGrid = DistanceGrid;

// 2.0 has no factories, so only 1.x pages get the 1.x-style one
if (L.version.startsWith('1.')) {
	L.markerClusterGroup = options => new MarkerClusterGroup(options);
}
