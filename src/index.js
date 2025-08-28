
import { createMarkerClusterGroup } from './MarkerClusterGroup.js';
import { createMarkerCluster } from './MarkerCluster.js';
import { extendMarkerWithOpacity } from './MarkerOpacity.js';
import { createDistanceGrid } from './DistanceGrid.js';
import { addQuickHullToMarkerCluster } from './MarkerCluster.QuickHull.js';
import { addSpiderfierToMarkerCluster } from './MarkerCluster.Spiderfier.js';
import { addRefreshToMarkerClusterGroup } from './MarkerClusterGroup.Refresh.js';

/**
 * Add MarkerCluster functionality to a Leaflet instance
 * @param {Object} L - Leaflet instance to extend
 * @returns {Object} - The extended Leaflet instance with MarkerCluster functionality
 */
export function addMarkerClusterToLeaflet(L) {
	if (!L || typeof L.FeatureGroup === 'undefined') {
		throw new Error('addMarkerClusterToLeaflet requires a valid Leaflet instance');
	}

	// Create the utility classes and extend markers
	createDistanceGrid(L);
	extendMarkerWithOpacity(L);

	// Create the main classes using the provided Leaflet instance
	var MarkerClusterGroup = createMarkerClusterGroup(L);
	var MarkerCluster = createMarkerCluster(L);

	// Add the extended functionality
	addQuickHullToMarkerCluster(L, MarkerCluster);
	addSpiderfierToMarkerCluster(L, MarkerCluster, MarkerClusterGroup);
	addRefreshToMarkerClusterGroup(L, MarkerClusterGroup, MarkerCluster);

	// Add to the Leaflet instance
	L.MarkerClusterGroup = MarkerClusterGroup;
	L.MarkerCluster = MarkerCluster;

	return L;
}

// For backward compatibility: if global L exists, patch it automatically
if (typeof window !== 'undefined' && window.L) {
	addMarkerClusterToLeaflet(window.L);
} else if (typeof global !== 'undefined' && global.L) {
	addMarkerClusterToLeaflet(global.L);
}

// Export individual classes for those who want them
export { 
	createMarkerClusterGroup, 
	createMarkerCluster,
	addQuickHullToMarkerCluster,
	addSpiderfierToMarkerCluster,
	addRefreshToMarkerClusterGroup
};
