/*
* Extends Marker to include two extra methods: clusterHide and clusterShow.
*
* They work as setOpacity(0) and setOpacity(1) respectively, but
* don't overwrite the options.opacity
*
*/

import { Marker } from 'leaflet/src/layer/marker';

Marker.include({
	clusterHide: function () {
		var backup = this.options.opacity;
		this.setOpacity(0);
		this.options.opacity = backup;
		return this;
	},

	clusterShow: function () {
		return this.setOpacity(this.options.opacity);
	}
});


