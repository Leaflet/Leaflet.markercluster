// Imports the package by name, so this checks the emitted declarations through the `types` export condition.
import {CircleMarker, DivIcon, LatLng, LayerGroup, LeafletMap, Marker, Point, Polyline} from 'leaflet';
import {MarkerCluster, MarkerClusterGroup} from 'leaflet.markercluster';
import type {ClusterPointerEvent, MarkerClusterGroupOptions, SpiderfyEvent} from 'leaflet.markercluster';

const map = new LeafletMap('map');
const marker = new Marker([50, 30], {title: 'a'});

const opts: MarkerClusterGroupOptions = {
	maxClusterRadius: zoom => (zoom < 10 ? 80 : 40),
	iconCreateFunction: cluster => new DivIcon({html: `${cluster.getChildCount()}`}),
	clusterPane: 'clusters',
	spiderfyOnEveryZoom: false,
	spiderfyOnMaxZoom: true,
	showCoverageOnHover: true,
	zoomToBoundsOnClick: true,
	singleMarkerMode: false,
	disableClusteringAtZoom: 18,
	removeOutsideVisibleBounds: true,
	animate: true,
	animateAddingMarkers: false,
	spiderfyShapePositions: (count, center) => Array.from({length: count}, (_, i) => center.add(new Point(i * 10, 0))),
	spiderfyDistanceMultiplier: 2,
	spiderLegPolylineOptions: {weight: 2, color: '#000'},
	chunkedLoading: true,
	chunkInterval: 100,
	chunkDelay: 20,
	chunkProgress: (processed, total, elapsed) => console.log(processed / total, elapsed),
	polygonOptions: {color: 'red'},
	pane: 'markerPane'
};

// methods chain, and the group works anywhere a Layer does
const group = new MarkerClusterGroup(opts).addTo(map);
group.addLayer(marker).addLayers([new Marker([1, 2]), new LayerGroup([new Marker([3, 4])])]).removeLayers([marker]);
group.addLayers(marker).removeLayers(marker);
group.removeLayer(marker).removeLayer(group.getLayerId(marker)).refreshClusters().refreshClusters([marker]);
group.refreshClusters(marker).refreshClusters({1: marker}).refreshClusters(group).clearLayers();
group.zoomToShowLayer(marker, () => marker.openPopup());
group.getBounds().getCenter();
map.hasLayer(group);

// members are markers by default
const markers: Marker[] = group.getLayers();
group.eachLayer(m => m.setIcon(new DivIcon()));
const found: Marker | undefined = group.getLayer(1);
const visible: Marker | MarkerCluster | null = group.getVisibleParent(marker);
if (visible instanceof MarkerCluster) {
	visible.spiderfy();
}

// clusters, as in cluster events
group.on('clusterclick', (e) => {
	const cluster: MarkerCluster = e.layer;
	const children: Marker[] = cluster.getAllChildMarkers();
	const hull: LatLng[] = cluster.getConvexHull();
	cluster.zoomToBounds({padding: [20, 20]});
	cluster.getBounds().pad(0.1);
	e.originalEvent.preventDefault();
	console.log(children, hull, cluster.getChildCount(), e.latlng);
});
group.on('clustermouseover', (e: ClusterPointerEvent) => e.layer.unspiderfy());
group.on('spiderfied', (e: SpiderfyEvent) => e.markers.map(m => m.getLatLng()));
group.on('unspiderfied', e => e.cluster.getChildCount());
group.on('animationend', e => e.target);
group.on('layeradd', e => e.layer);

// options on an instance have the defaults filled in
const radius: number | ((zoom: number) => number) = group.options.maxClusterRadius;
const chunkedLoading: boolean = group.options.chunkedLoading;
const disableAt: number | null = group.options.disableClusteringAtZoom;
group.options.iconCreateFunction(group.getVisibleParent(marker) as MarkerCluster).createIcon();

// other point layers, and layers that aren't clustered, with the member type given
const circles = new MarkerClusterGroup<CircleMarker>({iconCreateFunction: c => new DivIcon({className: `${c.getChildCount()}`})});
circles.addLayer(new CircleMarker([1, 2]));
circles.on('spiderfied', e => e.markers.map(m => m.setRadius(5)));
const mixed = new MarkerClusterGroup<Marker | Polyline>();
mixed.addLayers([marker, new Polyline([[1, 2], [3, 4]])]);

// methods that the plugin adds to every marker
marker.refreshIconOptions({iconUrl: 'marker.png'}, true).clusterHide().clusterShow();

// @ts-expect-error options have types
new MarkerClusterGroup({maxClusterRadius: '80'});
// @ts-expect-error unknown option
new MarkerClusterGroup({maxClusterRadiu: 80});
// @ts-expect-error a group of markers takes no polylines
group.addLayer(new Polyline([[1, 2], [3, 4]]));
// @ts-expect-error the markers in clusters are markers, not circle markers
group.on('clusterclick', e => e.layer.getAllChildMarkers()[0].setRadius(5));
// @ts-expect-error the radius may be a function
const radiusNumber: number = group.options.maxClusterRadius;
// @ts-expect-error a circle marker has no icon
circles.getLayers()[0].setIcon(new DivIcon());

console.log(markers, found, radius, chunkedLoading, disableAt, radiusNumber);

let parent: MarkerCluster | null = group.getParent(marker);
while (parent) {
	parent = group.getParent(parent);
}
