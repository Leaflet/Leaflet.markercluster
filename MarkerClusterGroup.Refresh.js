/**
 * Adds 1 public method to MCG and 1 to L.Marker to facilitate changing
 * markers' icon options and refreshing their icon and their parent clusters
 * accordingly (case where their iconCreateFunction uses data of childMarkers
 * to make up the cluster icon).
 * Should cover issues #561, #555, #535 and #498.
 */

L.MarkerClusterGroup.include({
	/**
	 * Updates all clusters (and their icon) which are parents of the given marker(s).
	 * @param layers L.MarkerClusterGroup|L.LayerGroup|Array(L.Marker)|L.Marker
	 * list of markers (or single marker) whose parent clusters need update.
	 */
	refreshClustersOf: function (layers) {
		if (layers instanceof L.MarkerClusterGroup) {
			layers = layers.getAllChildMarkers();
		} else if (layers instanceof L.LayerGroup) {
			layers = layers._layers;
		} else if (layers instanceof L.Marker) {
			layers = [layers];
		}
		this._flagParentsIconsNeedUpdate(layers);
		this._refreshClustersIcons();
	},

	/**
	 * Simply flags all parent clusters of the given markers as having a "dirty" icon.
	 * @param layers Array(L.Marker)|Map(L.Marker) list of markers.
	 * @private
	 */
	_flagParentsIconsNeedUpdate: function (layers) {
		var parent;

		// Assumes layers is an Array or an Object whose prototype is non-enumerable.
		for (id in layers) {
			// Flag parent clusters' icon as "dirty", all the way up.
			// Dummy process that flags multiple times upper parents, but still
			// much more efficient than trying to be smart and make short lists,
			// at least in the case of a hierarchy following a power law:
			// http://jsperf.com/flag-nodes-in-power-hierarchy
			parent = layers[id].__parent;
			while (parent) {
				parent._iconNeedsUpdate = true;
				parent = parent.__parent;
			}
		}
	},

	/**
	 * Refreshes the icon of all "dirty" visible clusters.
	 * Non-visible "dirty" clusters will be updated when they are added to the map.
	 * @private
	 */
	_refreshClustersIcons: function () {
		this._featureGroup.eachLayer(function (c) {
			if (c instanceof L.MarkerCluster && c._iconNeedsUpdate) {
				c._updateIcon();
			}
		});
	}
});

L.Marker.include({
	/**
	 * Updates the given options in the marker's icon and refreshes the marker.
	 * @param options map object of icon options.
	 */
	refreshIconWithOptions: function (options) {
		var icon = this.options.icon;

		L.setOptions(icon, options);

		this.setIcon(icon);
	}
});
