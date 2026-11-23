import type {MarkerOptions, MarkerEventMap, IconOptions, PathOptions, InteractiveLayerEventMap} from 'leaflet';

declare module 'leaflet' {
	interface Marker<O extends MarkerOptions = MarkerOptions, E extends MarkerEventMap = MarkerEventMap> {
		clusterHide(): this;
		clusterShow(): this;
		refreshIconOptions(options: IconOptions, directlyRefreshClusters?: boolean): this;
	}

	interface Path<O extends PathOptions = PathOptions, E extends InteractiveLayerEventMap = InteractiveLayerEventMap> {
		clusterHide(): this;
		clusterShow(): this;
	}
}
