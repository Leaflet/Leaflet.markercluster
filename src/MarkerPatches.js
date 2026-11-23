import * as L from 'leaflet';
import {parents} from './MarkerCluster.js';

// Methods added to every marker and path. The group calls clusterHide / clusterShow on the layers it holds, and apps
// call refreshIconOptions on markers.
L.Marker.include({
	// setOpacity(0) and back, but without overwriting options.opacity
	clusterHide() {
		const backup = this.options.opacity;
		this.setOpacity(0);
		this.options.opacity = backup;
		return this;
	},

	clusterShow() {
		return this.setOpacity(this.options.opacity);
	},

	/**
	 * Updates the given options in the marker's icon and refreshes the marker.
	 * @param options map object of icon options.
	 * @param directlyRefreshClusters boolean (optional) true to trigger
	 * MCG.refreshClustersOf() right away with this single marker.
	 * @returns {L.Marker}
	 */
	refreshIconOptions(options, directlyRefreshClusters) {
		const icon = this.options.icon;

		L.Util.setOptions(icon, options);

		this.setIcon(icon);

		// Shortcut to refresh the associated MCG clusters right away.
		// To be used when refreshing a single marker.
		// Otherwise, better use MCG.refreshClusters() once at the end with
		// the list of modified markers.
		if (directlyRefreshClusters) {
			parents.get(this)?._group.refreshClusters(this);
		}

		return this;
	}
});

// A path only has an element to hide with the SVG renderer. Leaflet creates a new one each time it's added to the map,
// so the inline opacity only needs clearing while it stays on the map.
L.Path.include({
	clusterHide() {
		if (this._path) {
			this._path.style.opacity = '0';
		}
		return this;
	},

	clusterShow() {
		if (this._path) {
			this._path.style.opacity = '';
		}
		return this;
	}
});
