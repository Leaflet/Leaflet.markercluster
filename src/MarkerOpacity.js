/*
* Extends L.Marker to include two extra methods: clusterHide and clusterShow.
* 
* They work as setOpacity(0) and setOpacity(1) respectively, but
* don't overwrite the options.opacity
* 
*/

export function extendMarkerWithOpacity(L) {
	L.Marker.include({
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
}

// For backward compatibility: if global L exists, extend it automatically
if (typeof window !== 'undefined' && window.L && window.L.Marker) {
	extendMarkerWithOpacity(window.L);
} else if (typeof global !== 'undefined' && global.L && global.L.Marker) {
	extendMarkerWithOpacity(global.L);
}


