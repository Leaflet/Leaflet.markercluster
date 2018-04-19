
/*
* Extends L.Marker to include two extra methods: clusterHide and clusterShow.
* 
* They work as setOpacity(0) and setOpacity(1) respectively, but
* they will remember the marker's opacity when hiding and showing it again.
* 
*/


L.Marker.include({
	
	clusterHide: function () {
		this.options.opacityWhenUnclustered = Number.isFinite(this.options.opacity) ? this.options.opacity : 1;
		return this.setOpacity(0);
	},
	
	clusterShow: function () {
		var ret = this.setOpacity(Number.isFinite(this.options.opacity) ? this.options.opacity : this.options.opacityWhenUnclustered);
		delete this.options.opacityWhenUnclustered;
		return ret;
	}
	
});


