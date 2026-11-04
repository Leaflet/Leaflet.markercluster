import type {MarkerOptions, MarkerEventMap, IconOptions} from 'leaflet';

declare module 'leaflet' {
	interface Marker<O extends MarkerOptions = MarkerOptions, E extends MarkerEventMap = MarkerEventMap> {
		clusterHide(): this;
		clusterShow(): this;
		refreshIconOptions(options: IconOptions, directlyRefreshClusters?: boolean): this;
	}
}
