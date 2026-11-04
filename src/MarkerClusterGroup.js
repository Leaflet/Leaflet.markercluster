import * as L from 'leaflet';
import {DistanceGrid} from './DistanceGrid.js';
import {MarkerCluster, MarkerClusterNonAnimated} from './MarkerCluster.js';
import './MarkerPatches.js';

/** @import {DivIcon, FeatureGroupEventMap, Icon, InteractiveLayerOptions, LatLng, LatLngBounds, Layer, LayerGroup, LeafletEvent, LeafletMap, LeafletPointerEvent, Marker, Point, Polygon, PolylineOptions, ZoomAnimEvent} from 'leaflet' */
/** @import {ClusterChild} from './MarkerCluster.js' */

/**
 * @template {Layer} [M=Marker]
 * @typedef {object} MarkerClusterGroupProps
 * @property {number | ((zoom: number) => number)} maxClusterRadius The maximum distance in pixels from a cluster's
 *   center to its markers, or a function that returns it for a zoom. Smaller makes more, smaller clusters.
 * @property {(cluster: MarkerCluster<M>) => Icon | DivIcon} iconCreateFunction Creates the icon of a cluster. The
 *   default shows the marker count, styled by `MarkerCluster.Default.css`.
 * @property {string} clusterPane The map pane for clusters; the marker pane if not set.
 * @property {boolean} spiderfyOnEveryZoom Spiderfy a cluster when clicked at any zoom.
 * @property {boolean} spiderfyOnMaxZoom Spiderfy a cluster when clicked at the bottom zoom, where it can't split.
 * @property {boolean} showCoverageOnHover Show the bounds of a cluster's markers on hover.
 * @property {boolean} zoomToBoundsOnClick Zoom to a cluster's bounds when it's clicked.
 * @property {boolean} singleMarkerMode Give single markers the cluster icon too, as clusters of 1.
 * @property {number | null} disableClusteringAtZoom Don't cluster markers at this zoom and above.
 * @property {boolean} removeOutsideVisibleBounds Remove clusters and markers far from the view from the map, for
 *   performance.
 * @property {boolean} animate Animate clusters splitting and merging on zoom, and spiderfying.
 * @property {boolean} animateAddingMarkers Animate markers added with `addLayer` into their clusters, once the group
 *   is on the map. Slow for many markers; `addLayers` never animates.
 * @property {((count: number, centerPoint: Point) => Point[]) | null} spiderfyShapePositions Places spiderfied
 *   markers: gets their count and the cluster's position in layer pixels, returns their positions.
 * @property {number} spiderfyDistanceMultiplier Scales the distance of spiderfied markers from the center, e.g. for
 *   big icons.
 * @property {PolylineOptions} spiderLegPolylineOptions Style of spider legs.
 * @property {boolean} chunkedLoading Split `addLayers` into chunks with breaks in between, so that the page doesn't
 *   freeze.
 * @property {number} chunkInterval Milliseconds of processing per chunk.
 * @property {number} chunkDelay Milliseconds between chunks.
 * @property {((processed: number, total: number, elapsed: number) => void) | null} chunkProgress Called after each
 *   chunk with the number of markers processed and total, and the milliseconds since the start, e.g. for a
 *   progress bar.
 * @property {PolylineOptions} polygonOptions Style of the coverage polygon shown on hover.
 */

/**
 * @template {Layer} [M=Marker]
 * @typedef {InteractiveLayerOptions & Partial<MarkerClusterGroupProps<M>>} MarkerClusterGroupOptions
 */

/**
 * A pointer event on a cluster, fired on the group with a `cluster` prefix, like `clusterclick`.
 * @template {Layer} [M=Marker]
 * @typedef {LeafletPointerEvent & {layer: MarkerCluster<M>}} ClusterPointerEvent
 */

/**
 * @template {Layer} [M=Marker]
 * @typedef {LeafletEvent & {cluster: MarkerCluster<M>, markers: M[]}} SpiderfyEvent
 */

/**
 * @template {Layer} [M=Marker]
 * @typedef {object} MarkerClusterGroupEvents
 * @property {ClusterPointerEvent<M>} clusterclick Fired when a cluster is clicked, or activated with the keyboard.
 * @property {ClusterPointerEvent<M>} clusterdblclick
 * @property {ClusterPointerEvent<M>} clustercontextmenu
 * @property {ClusterPointerEvent<M>} clustermouseover Fired when the pointer enters a cluster.
 * @property {ClusterPointerEvent<M>} clustermouseout Fired when the pointer leaves a cluster.
 * @property {SpiderfyEvent<M>} spiderfied Fired when a cluster has spread out its markers.
 * @property {SpiderfyEvent<M>} unspiderfied Fired when a cluster has brought its markers back in.
 * @property {LeafletEvent} animationend Fired when clusters have finished splitting or merging after a zoom.
 */

/**
 * @template {Layer} [M=Marker]
 * @typedef {FeatureGroupEventMap & MarkerClusterGroupEvents<M>} MarkerClusterGroupEventMap
 */

const isV1 = L.version.startsWith('1.');

// 2.0 markers turn Enter and Space into clicks, while 1.x only fires keypress
const clickEvents = isV1 ? 'clusterclick clusterkeypress' : 'clusterclick';

// 2.0 hover events keep their 1.x names on clusters, clustermouseover and clustermouseout
/** @type {{[type: string]: string}} */
const clusterEventNames = isV1 ? {} : {pointerover: 'mouseover', pointerout: 'mouseout'};

/** @param {string} type */
function clusterEventType(type) {
	return `cluster${clusterEventNames[type] ?? type}`;
}

/**
 * Whether the layer has a single point and gets clustered, unlike polylines and such.
 * @template {Layer} M
 * @param {M} layer
 * @returns {layer is ClusterChild<M>}
 */
function isPoint(layer) {
	return !!(/** @type {{getLatLng?: unknown}} */ (layer).getLatLng);
}

/**
 * Layers with the contents of any layer groups among them (recursively) put in their place.
 * @template {Layer} M
 * @param {Array<M | LayerGroup<M>>} layers
 * @returns {M[]}
 */
function flattenGroups(layers) {
	/** @type {M[]} */
	const result = [];
	for (const layer of layers) {
		if (layer instanceof L.LayerGroup) {
			result.push(...flattenGroups(layer.getLayers()));
		} else {
			result.push(layer);
		}
	}
	return result;
}

// Constant bounds used in case option "removeOutsideVisibleBounds" is set to false.
const mapBoundsInfinite = new L.LatLngBounds(new L.LatLng(-Infinity, -Infinity), new L.LatLng(Infinity, Infinity));

// non-animated versions of the animation methods, set on groups with animate: false
/** @type {Pick<MarkerClusterGroup<any>, '_animationStart' | '_animationZoomIn' | '_animationZoomOut' | '_animationAddLayer'>} */
const noAnimation = {
	_animationStart() {
		//Do nothing...
	},
	/**
	 * @this {MarkerClusterGroup<any>}
	 * @param {number} previousZoomLevel
	 * @param {number} newZoomLevel
	 */
	_animationZoomIn(previousZoomLevel, newZoomLevel) {
		this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds, Math.floor(this._map.getMinZoom()), previousZoomLevel);
		this._topClusterLevel._recursivelyAddChildrenToMap(null, newZoomLevel, this._getExpandedVisibleBounds());

		//We didn't actually animate, but we use this event to mean "clustering animations have finished"
		this.fire('animationend');
	},
	/**
	 * @this {MarkerClusterGroup<any>}
	 * @param {number} previousZoomLevel
	 * @param {number} newZoomLevel
	 */
	_animationZoomOut(previousZoomLevel, newZoomLevel) {
		this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds, Math.floor(this._map.getMinZoom()), previousZoomLevel);
		this._topClusterLevel._recursivelyAddChildrenToMap(null, newZoomLevel, this._getExpandedVisibleBounds());

		//We didn't actually animate, but we use this event to mean "clustering animations have finished"
		this.fire('animationend');
	},
	/**
	 * @this {MarkerClusterGroup<any>}
	 * @param {ClusterChild} layer
	 * @param {ClusterChild | MarkerCluster} newCluster
	 */
	_animationAddLayer(layer, newCluster) {
		this._animationAddLayerNonAnimated(layer, newCluster);
	}
};

/**
 * A `FeatureGroup` that clusters the markers in it. Layers that aren't points, like polylines, are kept as they are.
 * @template {Layer} [M=Marker] The layers in the group.
 * @extends {L.FeatureGroup<M, MarkerClusterGroupOptions<M> & MarkerClusterGroupProps<M>, MarkerClusterGroupEventMap<M>>}
 */
export class MarkerClusterGroup extends L.FeatureGroup {
	static initHooks = true;

	/** @param {MarkerClusterGroupOptions<M>} [options] */
	constructor(options) {
		// 1.x calls initialize() (set below) from its constructor with these arguments, then the init hooks
		super(/** @type {any} */ (isV1 ? options : undefined));
		if (!isV1) {
			this._initGroup(options);
			this.callInitHooks();
		}
	}

	/** @param {MarkerClusterGroupOptions<M>} [options] */
	_initGroup(options) {
		L.Util.setOptions(this, options);
		if (!this.options.iconCreateFunction) {
			this.options.iconCreateFunction = this._defaultIconCreateFunction;
		}

		// the clusters and markers shown on the map
		/** @type {L.FeatureGroup} */
		this._featureGroup = new L.FeatureGroup();
		this._featureGroup.addEventParent(this);

		/** @type {L.FeatureGroup<M>} */
		this._nonPointGroup = new L.FeatureGroup();
		this._nonPointGroup.addEventParent(this);

		/** @type {number} */
		this._inZoomAnimation = 0;
		/** @type {boolean} */
		this._ignoreMove = false;
		/** @type {ClusterChild<M>[]} */
		this._needsClustering = [];
		/** Markers removed while we aren't on the map. @type {ClusterChild<M>[]} */
		this._needsRemoving = [];

		/** @type {Array<() => void>} */
		this._queue = [];
		/** @type {number | null} */
		this._queueTimeout = null;

		/** The cluster currently spiderfied, if any. @type {MarkerCluster<M> | null} */
		this._spiderfied = null;
		/** @type {Polygon | null} */
		this._shownPolygon = null;

		/** @type {{[type: string]: (e: LeafletEvent) => void}} */
		this._childMarkerEventHandlers = {
			'dragstart': this._childMarkerDragStart,
			'move': this._childMarkerMoved,
			'dragend': this._childMarkerDragEnd,
		};

		// the class methods are the animated versions
		const animate = this.options.animate;
		if (!animate) {
			Object.assign(this, noAnimation);
		}
		/** The cluster class to create, animated or not. @type {typeof MarkerCluster<M>} */
		this._markerCluster = animate ? MarkerCluster : MarkerClusterNonAnimated;
	}

	/**
	 * Adds a marker, or a layer group's layers, to be clustered. Layers that aren't points are added as they are.
	 * @param {M | LayerGroup<M>} layerOrGroup
	 * @returns {this}
	 */
	addLayer(layerOrGroup) {

		if (layerOrGroup instanceof L.LayerGroup) {
			return this.addLayers([layerOrGroup]);
		}
		const layer = /** @type {M} */ (layerOrGroup);

		//Don't cluster non point data
		if (!isPoint(layer)) {
			this._nonPointGroup.addLayer(layer);
			this.fire('layeradd', {layer});
			return this;
		}

		if (this.hasLayer(layer)) {
			return this;
		}

		if (!this._map) {
			this._needsClustering.push(layer);
			this.fire('layeradd', {layer});
			return this;
		}

		this._unspiderfy();

		this._addLayer(layer, this._maxZoom);
		this.fire('layeradd', {layer});

		// Refresh bounds and weighted positions.
		this._topClusterLevel._recalculateBounds();

		this._refreshClustersIcons();

		//Work out what is visible
		const currentZoom = this._zoom;
		/** @type {ClusterChild<M> | MarkerCluster<M>} */
		let visibleLayer = layer;
		while (visibleLayer.__parent && visibleLayer.__parent._zoom >= currentZoom) {
			visibleLayer = visibleLayer.__parent;
		}

		if (this._currentShownBounds.contains(visibleLayer.getLatLng())) {
			if (this.options.animateAddingMarkers) {
				this._animationAddLayer(layer, visibleLayer);
			} else {
				this._animationAddLayerNonAnimated(layer, visibleLayer);
			}
		}
		return this;
	}

	/**
	 * Removes a marker, or a layer group's layers.
	 * @param {M | LayerGroup<M> | number} layerOrGroup A layer, a layer group, or a layer's id.
	 * @returns {this}
	 */
	removeLayer(layerOrGroup) {

		if (typeof layerOrGroup === 'number') {
			const layer = this.getLayer(layerOrGroup);
			return layer ? this.removeLayer(layer) : this;
		}
		if (layerOrGroup instanceof L.LayerGroup) {
			return this.removeLayers([layerOrGroup]);
		}
		const layer = /** @type {M} */ (layerOrGroup);

		//Non point layers
		if (!isPoint(layer)) {
			this._nonPointGroup.removeLayer(layer);
			this.fire('layerremove', {layer});
			return this;
		}

		// detached in every case, or moving the marker later would add it back
		layer.off(this._childMarkerEventHandlers, this);

		if (!this._map) {
			if (!this._arraySplice(this._needsClustering, layer) && this.hasLayer(layer)) {
				this._needsRemoving.push(layer);
			}
			this.fire('layerremove', {layer});
			return this;
		}

		if (!layer.__parent) {
			return this;
		}

		this._unspiderfy();
		this._unspiderfyLayer(layer);

		//Remove the marker from clusters
		this._removeLayer(layer, true);
		this.fire('layerremove', {layer});

		// Refresh bounds and weighted positions.
		this._topClusterLevel._recalculateBounds();

		this._refreshClustersIcons();

		if (this._featureGroup.hasLayer(layer)) {
			this._featureGroup.removeLayer(layer);
			if (layer.clusterShow) {
				layer.clusterShow();
			}
		}

		return this;
	}

	/**
	 * Adds markers and layer groups in bulk, much faster than one by one. With `chunkedLoading`, the rest of them
	 * are added in chunks after this returns.
	 * @param {Array<M | LayerGroup<M>>} layersArray
	 * @param {boolean} [skipLayerAddEvent] Don't fire `layeradd` for each layer.
	 * @returns {this}
	 */
	addLayers(layersArray, skipLayerAddEvent) {
		if (!Array.isArray(layersArray)) {
			return this.addLayer(layersArray);
		}

		const layers = flattenGroups(layersArray),
			l = layers.length,
			npg = this._nonPointGroup;

		if (!this._map) {
			for (const m of layers) {
				if (!isPoint(m)) {
					npg.addLayer(m);
				} else if (!this.hasLayer(m)) {
					this._needsClustering.push(m);
				}
			}
			return this;
		}

		const fg = this._featureGroup,
			{chunkedLoading, chunkInterval, chunkProgress} = this.options,
			started = performance.now();
		let offset = 0;

		const process = () => {
			// removed from the map between chunks: the rest gets clustered when it's added back
			if (!this._map) {
				this.addLayers(layers.slice(offset));
				return;
			}

			const start = performance.now(),
				chunkStart = offset;

			// Make sure to unspiderfy before starting to add some layers
			this._unspiderfy();

			for (; offset < l; offset++) {
				// every couple hundred markers (but not at the chunk's start, so that it always makes progress),
				// check whether the chunk has run long enough to give the browser a break
				if (chunkedLoading && offset > chunkStart && offset % 200 === 0 && performance.now() - start > chunkInterval) {
					break;
				}

				const m = layers[offset];

				//Not point data, can't be clustered
				if (!isPoint(m)) {
					npg.addLayer(m);
					if (!skipLayerAddEvent) {
						this.fire('layeradd', {layer: m});
					}
					continue;
				}

				if (this.hasLayer(m)) {
					continue;
				}

				this._addLayer(m, this._maxZoom);
				if (!skipLayerAddEvent) {
					this.fire('layeradd', {layer: m});
				}

				//If we just made a cluster of size 2 then we need to remove the other marker from the map (if it is) or we never will
				if (m.__parent && m.__parent.getChildCount() === 2) {
					const markers = m.__parent.getAllChildMarkers(),
						otherMarker = markers[0] === m ? markers[1] : markers[0];
					fg.removeLayer(otherMarker);
				}
			}

			if (chunkProgress) {
				chunkProgress(offset, l, performance.now() - started);
			}

			if (offset === l) {
				// Refresh bounds and weighted positions.
				this._topClusterLevel._recalculateBounds();
				this._refreshClustersIcons();
				this._topClusterLevel._recursivelyAddChildrenToMap(null, this._zoom, this._currentShownBounds);
			} else {
				setTimeout(process, this.options.chunkDelay);
			}
		};

		process();

		return this;
	}

	/**
	 * Removes markers and layer groups in bulk, much faster than one by one.
	 * @param {Array<M | LayerGroup<M>>} layersArray
	 * @returns {this}
	 */
	removeLayers(layersArray) {
		if (!Array.isArray(layersArray)) {
			return this.removeLayer(layersArray);
		}

		// non-point layers have no __parent, the rest is optional
		const layers = /** @type {ClusterChild<M>[]} */ (flattenGroups(layersArray)),
			fg = this._featureGroup,
			npg = this._nonPointGroup;

		for (const m of layers) {
			m.off(this._childMarkerEventHandlers, this);
		}

		if (!this._map) {
			for (const m of layers) {
				npg.removeLayer(m);
				if (!this._arraySplice(this._needsClustering, m) && this.hasLayer(m)) {
					this._needsRemoving.push(m);
				}
				this.fire('layerremove', {layer: m});
			}
			return this;
		}

		this._unspiderfy();
		for (const m of layers) {
			this._unspiderfyLayer(m);
		}

		for (const m of layers) {
			if (!m.__parent) {
				npg.removeLayer(m);
				this.fire('layerremove', {layer: m});
				continue;
			}

			this._removeLayer(m, true, true);
			this.fire('layerremove', {layer: m});

			if (fg.hasLayer(m)) {
				fg.removeLayer(m);
				if (m.clusterShow) {
					m.clusterShow();
				}
			}
		}

		// Refresh bounds and weighted positions.
		this._topClusterLevel._recalculateBounds();

		this._refreshClustersIcons();

		//Fix up the clusters and markers on the map
		this._topClusterLevel._recursivelyAddChildrenToMap(null, this._zoom, this._currentShownBounds);

		return this;
	}

	/** Removes all layers from the group. */
	clearLayers() {
		this._noanimationUnspiderfy();

		//Remove all the visible layers
		this._featureGroup.clearLayers();
		this._nonPointGroup.clearLayers();

		// emptied first so that eachLayer goes through the markers removed while off the map too
		this._needsRemoving = [];
		this.eachLayer((layer) => {
			const marker = /** @type {ClusterChild<M>} */ (layer);
			marker.off(this._childMarkerEventHandlers, this);
			delete marker.__parent;
		});
		this._needsClustering = [];

		if (this._map) {
			//Reset _topClusterLevel and the DistanceGrids
			this._generateInitialClusters();
		} else {
			// generated again by the next onAdd
			const clusters = /** @type {Partial<Pick<this, '_gridClusters' | '_gridUnclustered' | '_topClusterLevel'>>} */ (this);
			delete clusters._gridClusters;
			delete clusters._gridUnclustered;
			delete clusters._topClusterLevel;
		}

		return this;
	}

	/** The bounds of all layers in the group. */
	getBounds() {
		const bounds = new L.LatLngBounds();

		if (this._topClusterLevel) {
			bounds.extend(this._topClusterLevel._bounds);
		}

		for (let i = this._needsClustering.length - 1; i >= 0; i--) {
			bounds.extend(this._needsClustering[i].getLatLng());
		}

		bounds.extend(this._nonPointGroup.getBounds());

		return bounds;
	}

	/**
	 * Calls `method` on each layer in the group, including the markers in clusters.
	 * @param {(layer: M) => void} method
	 * @param {unknown} [context]
	 */
	eachLayer(method, context) {
		const markers = this._needsClustering.slice(),
			needsRemoving = new Set(this._needsRemoving);

		if (this._topClusterLevel) {
			this._topClusterLevel._getChildren(markers);
		}

		for (let i = markers.length - 1; i >= 0; i--) {
			if (!needsRemoving.has(markers[i])) {
				method.call(context, markers[i]);
			}
		}

		this._nonPointGroup.eachLayer(method, context);
		return this;
	}

	/**
	 * All layers in the group, including the markers in clusters.
	 * @returns {M[]}
	 */
	getLayers() {
		/** @type {M[]} */
		const layers = [];
		this.eachLayer((l) => {
			layers.push(l);
		});
		return layers;
	}

	/**
	 * The layer with the given id (see `L.Util.stamp`). Goes through all layers, so it's slow for many.
	 * @param {number} id
	 * @returns {M | undefined}
	 */
	getLayer(id) {
		/** @type {M | undefined} */
		let result;

		id = Number(id);

		this.eachLayer((l) => {
			if (L.Util.stamp(l) === id) {
				result = l;
			}
		});

		return result;
	}

	/**
	 * Whether the layer is in the group, either in a cluster or not.
	 * @param {M} layerToCheck
	 */
	hasLayer(layerToCheck) {
		if (!layerToCheck) {
			return false;
		}
		const layer = /** @type {ClusterChild<M>} */ (layerToCheck);

		if (this._needsClustering.includes(layer)) {
			return true;
		}
		if (this._needsRemoving.includes(layer)) {
			return false;
		}
		return !!(layer.__parent && layer.__parent._group === this) || this._nonPointGroup.hasLayer(layer);
	}

	/**
	 * Zooms in to show the marker, spiderfying its cluster if needed, then calls the callback.
	 * @param {M} marker
	 * @param {() => void} [callback]
	 */
	zoomToShowLayer(marker, callback) {

		const map = this._map,
			layer = /** @type {ClusterChild<M>} */ (marker);

		const done = typeof callback === 'function' ? callback : () => {},
			parent = /** @type {MarkerCluster<M>} */ (layer.__parent);

		const showMarker = () => {
			// Assumes that map.hasLayer checks for direct appearance on map, not recursively calling
			// hasLayer on Layer Groups that are on map (typically not calling this MarkerClusterGroup.hasLayer, which would always return true)
			if ((map.hasLayer(layer) || map.hasLayer(parent)) && !this._inZoomAnimation) {
				this._map.off('moveend', showMarker, this);
				this.off('animationend', showMarker, this);

				if (map.hasLayer(layer)) {
					done();
				} else if (map.hasLayer(parent)) {
					this.once('spiderfied', done, this);
					parent.spiderfy();
				}
			}
		};

		if (map.hasLayer(layer) && map.getBounds().contains(layer.getLatLng())) {
			//Layer is visible ond on screen, immediate return
			done();
		} else if (parent._zoom < Math.round(this._map.getZoom())) {
			//Layer should be visible at this zoom level. It must not be on screen so just pan over to it
			this._map.on('moveend', showMarker, this);
			this._map.panTo(layer.getLatLng());
		} else {
			this._map.on('moveend', showMarker, this);
			this.on('animationend', showMarker, this);
			parent.zoomToBounds();
		}
	}

	/** @param {LeafletMap} map */
	onAdd(map) {
		this._map = map;

		if (!isFinite(this._map.getMaxZoom())) {
			throw new Error('Map has no maxZoom specified');
		}

		this._featureGroup.addTo(map);
		this._nonPointGroup.addTo(map);

		if (!this._gridClusters) {
			this._generateInitialClusters();
		}

		/** @type {number | undefined} */
		this._maxLat = /** @type {{MAX_LATITUDE?: number}} */ (map.options.crs.projection).MAX_LATITUDE;

		for (const layer of this._needsRemoving) {
			this._removeLayer(layer, true);
		}
		this._needsRemoving = [];

		//Remember the current zoom level and bounds
		/** @type {number} */
		this._zoom = Math.round(this._map.getZoom());
		/** The bounds of the currently shown area, from _getExpandedVisibleBounds. @type {LatLngBounds} */
		this._currentShownBounds = this._getExpandedVisibleBounds();

		this._map.on('zoomend', this._zoomEnd, this);
		this._map.on('moveend', this._moveEnd, this);

		this._spiderfierOnAdd();
		this._bindEvents();

		//Actually add our markers to the map:
		const layers = this._needsClustering;
		this._needsClustering = [];
		this.addLayers(layers, true);
	}

	/** @param {LeafletMap} map */
	onRemove(map) {
		map.off('zoomend', this._zoomEnd, this);
		map.off('moveend', this._moveEnd, this);

		this._unbindEvents();

		//In case we are in a cluster animation
		this._map.getPane('mapPane').classList.remove('leaflet-cluster-anim');

		this._spiderfierOnRemove();

		delete this._maxLat;

		//Clean up all the layers we added to the map
		this._hideCoverage();
		this._featureGroup.remove();
		this._nonPointGroup.remove();

		this._featureGroup.clearLayers();

		/** @type {any} */ (this)._map = null;
	}

	/**
	 * The marker if it's shown on the map, or the cluster it's shown in, or null if neither is (e.g. out of view).
	 * @param {M} marker
	 * @returns {M | MarkerCluster<M> | null}
	 */
	getVisibleParent(marker) {
		/** @type {ClusterChild<M> | MarkerCluster<M> | undefined} */
		let vMarker = /** @type {ClusterChild<M>} */ (marker);
		while (vMarker && !this._featureGroup.hasLayer(vMarker)) {
			vMarker = vMarker.__parent;
		}
		return vMarker || null;
	}

	/**
	 * Removes the object from the array, returning true if it was there.
	 * @template T
	 * @param {T[]} anArray
	 * @param {T} obj
	 */
	_arraySplice(anArray, obj) {
		for (let i = anArray.length - 1; i >= 0; i--) {
			if (anArray[i] === obj) {
				anArray.splice(i, 1);
				return true;
			}
		}
		return false;
	}

	/**
	 * Removes a marker from all _gridUnclustered zoom levels, starting at the supplied zoom.
	 * @param {ClusterChild<M>} marker
	 * @param {number} z Bottom start zoom level (included).
	 */
	_removeFromGridUnclustered(marker, z) {
		const gridUnclustered = this._gridUnclustered,
			minZoom = Math.floor(this._map.getMinZoom());

		for (; z >= minZoom; z--) {
			if (!gridUnclustered[z].removeObject(marker)) {
				break;
			}
		}
	}

	/** @param {LeafletEvent} e */
	_childMarkerDragStart(e) {
		/** @type {ClusterChild<M>} */ (e.target).__dragStart = true;
	}

	/** @param {LeafletEvent} e */
	_childMarkerMoved(e) {
		const marker = /** @type {ClusterChild<M>} */ (e.target);
		if (!this._ignoreMove && !marker.__dragStart) {
			const isPopupOpen = marker.isPopupOpen();

			this._moveChild(marker);

			if (isPopupOpen) {
				marker.openPopup();
			}
		}
	}

	/**
	 * The distance grids remember the projected point each marker was added at, so the old latlng isn't needed.
	 * @param {ClusterChild<M>} layer
	 */
	_moveChild(layer) {
		this.removeLayer(layer);
		this.addLayer(layer);
	}

	/** @param {LeafletEvent} e */
	_childMarkerDragEnd(e) {
		const marker = /** @type {ClusterChild<M>} */ (e.target),
			dragged = marker.__dragStart;
		delete marker.__dragStart;
		if (dragged) {
			this._moveChild(marker);
		}
	}


	/**
	 * Removes a marker from everything.
	 * @param {ClusterChild<M>} marker
	 * @param {boolean} removeFromDistanceGrid
	 * @param {boolean} [dontUpdateMap] Set if the caller updates the map itself (for bulk functions).
	 */
	_removeLayer(marker, removeFromDistanceGrid, dontUpdateMap) {
		const gridClusters = this._gridClusters,
			gridUnclustered = this._gridUnclustered,
			fg = this._featureGroup,
			map = this._map,
			minZoom = Math.floor(this._map.getMinZoom());

		//Remove the marker from distance clusters it might be in
		if (removeFromDistanceGrid) {
			this._removeFromGridUnclustered(marker, this._maxZoom);
		}

		//Work our way up the clusters removing them as we go if required
		const markers = /** @type {MarkerCluster<M>} */ (marker.__parent)._markers;
		let cluster = marker.__parent;

		//Remove the marker from the immediate parents marker list
		this._arraySplice(markers, marker);

		while (cluster) {
			cluster._childCount--;
			cluster._boundsNeedUpdate = true;

			if (cluster._zoom < minZoom) {
				//Top level, do nothing
				break;
			} else if (removeFromDistanceGrid && cluster._childCount <= 1) { //Cluster no longer required
				//We need to push the other marker up to the parent
				const otherMarker = cluster._markers[0] === marker ? cluster._markers[1] : cluster._markers[0],
					parent = /** @type {MarkerCluster<M>} */ (cluster.__parent);

				//Update distance grid
				gridClusters[cluster._zoom].removeObject(cluster);
				gridUnclustered[cluster._zoom].addObject(otherMarker, map.project(otherMarker.getLatLng(), cluster._zoom));

				//Move otherMarker up to parent
				this._arraySplice(parent._childClusters, cluster);
				parent._markers.push(otherMarker);
				otherMarker.__parent = parent;

				if (cluster.getElement()) {
					//Cluster is currently on the map, need to put the marker on the map instead
					fg.removeLayer(cluster);
					if (!dontUpdateMap) {
						fg.addLayer(otherMarker);
					}
				}
			} else {
				cluster._iconNeedsUpdate = true;
			}

			cluster = cluster.__parent;
		}

		delete marker.__parent;
	}

	/**
	 * Events from clusters are fired as clusterclick, clustermouseover, etc.
	 * @param {string} type
	 * @param {{[key: string]: any}} [data]
	 * @param {boolean} [propagate]
	 */
	fire(type, data, propagate) {
		if (data && data.layer instanceof MarkerCluster) {
			//Prevent multiple clustermouseover/off events if the icon is made up of stacked divs
			const related = data.originalEvent?.relatedTarget;
			if (related instanceof Node && data.layer.getElement()?.contains(related)) {
				return this;
			}
			type = clusterEventType(type);
		}

		return super.fire(type, data, propagate);
	}

	/**
	 * @param {string} type
	 * @param {...any} args
	 * @returns {boolean}
	 */
	listens(type, ...args) {
		return super.listens(type, ...args) || super.listens(clusterEventType(type), ...args);
	}

	/**
	 * The default iconCreateFunction.
	 * @param {MarkerCluster<M>} cluster
	 */
	_defaultIconCreateFunction(cluster) {
		const childCount = cluster.getChildCount();

		let c = ' marker-cluster-';
		if (childCount < 10) {
			c += 'small';
		} else if (childCount < 100) {
			c += 'medium';
		} else {
			c += 'large';
		}

		return new L.DivIcon({html: `<div><span>${childCount} <span aria-label="markers"></span></span></div>`, className: `marker-cluster${c}`, iconSize: new L.Point(40, 40)});
	}

	_bindEvents() {
		const map = this._map,
			spiderfyOnMaxZoom = this.options.spiderfyOnMaxZoom,
			showCoverageOnHover = this.options.showCoverageOnHover,
			zoomToBoundsOnClick = this.options.zoomToBoundsOnClick,
			spiderfyOnEveryZoom = this.options.spiderfyOnEveryZoom;

		//Zoom on cluster click or spiderfy if we are at the lowest level
		if (spiderfyOnMaxZoom || zoomToBoundsOnClick || spiderfyOnEveryZoom) {
			this.on(clickEvents, this._zoomOrSpiderfy, this);
		}

		//Show convex hull (boundary) polygon on mouse over
		if (showCoverageOnHover) {
			this.on('clustermouseover', this._showCoverage, this);
			this.on('clustermouseout', this._hideCoverage, this);
			map.on('zoomend', this._hideCoverage, this);
		}
	}

	/** @param {LeafletEvent & {[key: string]: any}} e clusterclick, or clusterkeypress on 1.x */
	_zoomOrSpiderfy(e) {
		const cluster = /** @type {MarkerCluster<M>} */ (e.layer),
			original = /** @type {Partial<PointerEvent & KeyboardEvent> | undefined} */ (e.originalEvent);
		let bottomCluster = cluster;

		if (e.type === 'clusterkeypress' && original && original.key !== 'Enter' || original?.defaultPrevented) {
			return;
		}

		while (bottomCluster._childClusters.length === 1) {
			bottomCluster = bottomCluster._childClusters[0];
		}

		if (bottomCluster._zoom === this._maxZoom &&
			bottomCluster._childCount === cluster._childCount &&
			this.options.spiderfyOnMaxZoom) {

			// All child markers are contained in a single cluster from this._maxZoom to this cluster.
			cluster.spiderfy();
		} else if (this.options.zoomToBoundsOnClick) {
			cluster.zoomToBounds();
		}

		if (this.options.spiderfyOnEveryZoom) {
			cluster.spiderfy();
		}

		// Focus the map again for keyboard users: Enter on 1.x, or a click from Enter or Space on 2.0, which has no detail
		if (original && (original.key === 'Enter' || original.detail === 0)) {
			this._map.getContainer().focus();
		}
	}

	/** @param {ClusterPointerEvent<M>} e */
	_showCoverage(e) {
		const map = this._map,
			cluster = e.layer;
		if (this._inZoomAnimation) {
			return;
		}
		if (this._shownPolygon) {
			map.removeLayer(this._shownPolygon);
		}
		if (cluster.getChildCount() > 2 && cluster !== this._spiderfied) {
			this._shownPolygon = new L.Polygon(cluster.getConvexHull(), this.options.polygonOptions);
			map.addLayer(this._shownPolygon);
		}
	}

	_hideCoverage() {
		if (this._shownPolygon) {
			this._map.removeLayer(this._shownPolygon);
			this._shownPolygon = null;
		}
	}

	// unbinds everything _bindEvents might have bound, whatever the options are now
	_unbindEvents() {
		this.off(clickEvents, this._zoomOrSpiderfy, this);
		this.off('clustermouseover', this._showCoverage, this);
		this.off('clustermouseout', this._hideCoverage, this);
		this._map.off('zoomend', this._hideCoverage, this);
	}

	_zoomEnd() {
		if (!this._map) { //May have been removed from the map by a zoomEnd handler
			return;
		}
		this._mergeSplitClusters();

		this._zoom = Math.round(this._map.getZoom());
		this._currentShownBounds = this._getExpandedVisibleBounds();
	}

	_moveEnd() {
		if (this._inZoomAnimation) {
			return;
		}

		const newBounds = this._getExpandedVisibleBounds();

		this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds, Math.floor(this._map.getMinZoom()), this._zoom, newBounds);
		this._topClusterLevel._recursivelyAddChildrenToMap(null, Math.round(this._map.getZoom()), newBounds);

		this._currentShownBounds = newBounds;

	}

	_generateInitialClusters() {
		const minZoom = Math.floor(this._map.getMinZoom()),
			radius = this.options.maxClusterRadius,
			radiusFn = typeof radius === 'function' ? radius : () => radius,
			{disableClusteringAtZoom} = this.options;

		/** @type {number} */
		this._maxZoom = disableClusteringAtZoom !== null ? disableClusteringAtZoom - 1 : Math.ceil(this._map.getMaxZoom());
		const maxZoom = this._maxZoom;
		/** @type {{[zoom: number]: DistanceGrid<MarkerCluster<M>>}} */
		this._gridClusters = {};
		/** @type {{[zoom: number]: DistanceGrid<ClusterChild<M>>}} */
		this._gridUnclustered = {};

		//Set up DistanceGrids for each zoom
		if (!isFinite(minZoom)) {
			throw new Error('Map has no minZoom specified');
		}
		for (let zoom = maxZoom; zoom >= minZoom; zoom--) {
			this._gridClusters[zoom] = new DistanceGrid(radiusFn(zoom));
			this._gridUnclustered[zoom] = new DistanceGrid(radiusFn(zoom));
		}

		// Instantiate the appropriate L.MarkerCluster class (animated or not).
		/** @type {MarkerCluster<M>} */
		this._topClusterLevel = new this._markerCluster(this, minZoom - 1);
	}

	/**
	 * @param {ClusterChild<M>} layer
	 * @param {number} zoom Zoom to start adding at (this._maxZoom to start at the bottom).
	 */
	_addLayer(layer, zoom) {
		const gridClusters = this._gridClusters,
			gridUnclustered = this._gridUnclustered,
			minZoom = Math.floor(this._map.getMinZoom());
		let markerPoint, z;

		if (this.options.singleMarkerMode) {
			this._overrideMarkerIcon(layer);
		}

		layer.on(this._childMarkerEventHandlers, this);

		//Find the lowest zoom level to slot this one in
		for (; zoom >= minZoom; zoom--) {
			markerPoint = this._map.project(layer.getLatLng(), zoom); // calculate pixel position

			//Try find a cluster close by
			const closestCluster = gridClusters[zoom].getNearObject(markerPoint);
			if (closestCluster) {
				closestCluster._addChild(layer);
				layer.__parent = closestCluster;
				return;
			}

			//Try find a marker close by to form a new cluster with
			const closest = gridUnclustered[zoom].getNearObject(markerPoint);
			if (closest) {
				// markers in the grids always have a parent, the top cluster if no other
				const parent = /** @type {MarkerCluster<M>} */ (closest.__parent);
				this._removeLayer(closest, false);

				//Create new cluster with these 2 in it

				const newCluster = new this._markerCluster(this, zoom, closest, layer);
				gridClusters[zoom].addObject(newCluster, this._map.project(newCluster._cLatLng, zoom));
				closest.__parent = newCluster;
				layer.__parent = newCluster;

				//First create any new intermediate parent clusters that don't exist
				let lastParent = newCluster;
				for (z = zoom - 1; z > parent._zoom; z--) {
					lastParent = new this._markerCluster(this, z, lastParent);
					gridClusters[z].addObject(lastParent, this._map.project(closest.getLatLng(), z));
				}
				parent._addChild(lastParent);

				//Remove closest from this zoom level and any above that it is in, replace with newCluster
				this._removeFromGridUnclustered(closest, zoom);

				return;
			}

			//Didn't manage to cluster in at this zoom, record us as a marker here and continue upwards
			gridUnclustered[zoom].addObject(layer, markerPoint);
		}

		//Didn't get in anything, add us to the top
		this._topClusterLevel._addChild(layer);
		layer.__parent = this._topClusterLevel;

	}

	/**
	 * Refreshes the icon of all "dirty" visible clusters.
	 * Non-visible "dirty" clusters will be updated when they are added to the map.
	 */
	_refreshClustersIcons() {
		this._featureGroup.eachLayer((c) => {
			if (c instanceof MarkerCluster && c._iconNeedsUpdate) {
				c._updateIcon();
			}
		});
	}

	/**
	 * Enqueue code to fire after the marker expand/contract has happened.
	 * @param {() => void} fn
	 */
	_enqueue(fn) {
		this._queue.push(fn);
		if (!this._queueTimeout) {
			this._queueTimeout = setTimeout(() => this._processQueue(), 300);
		}
	}
	_processQueue() {
		for (let i = 0; i < this._queue.length; i++) {
			this._queue[i].call(this);
		}
		this._queue.length = 0;
		if (this._queueTimeout !== null) {
			clearTimeout(this._queueTimeout);
		}
		this._queueTimeout = null;
	}

	//Merge and split any existing clusters that are too big or small
	_mergeSplitClusters() {
		const mapZoom = Math.round(this._map.getZoom());

		//In case we are starting to split before the animation finished
		this._processQueue();

		if (this._zoom < mapZoom && this._currentShownBounds.intersects(this._getExpandedVisibleBounds())) { //Zoom in, split
			this._animationStart();
			//Remove clusters now off screen
			this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds, Math.floor(this._map.getMinZoom()), this._zoom, this._getExpandedVisibleBounds());

			this._animationZoomIn(this._zoom, mapZoom);

		} else if (this._zoom > mapZoom) { //Zoom out, merge
			this._animationStart();

			this._animationZoomOut(this._zoom, mapZoom);
		} else {
			this._moveEnd();
		}
	}

	//Gets the maps visible bounds expanded in each direction by the size of the screen (so the user cannot see an area we do not cover in one pan)
	_getExpandedVisibleBounds() {
		if (!this.options.removeOutsideVisibleBounds) {
			return mapBoundsInfinite;
		} else if (matchMedia('(pointer: coarse)').matches) { // no padding on phones and tablets
			return this._checkBoundsMaxLat(this._map.getBounds());
		}

		return this._checkBoundsMaxLat(this._map.getBounds().pad(1)); // Padding expands the bounds by its own dimensions but scaled with the given factor.
	}

	/**
	 * Expands the latitude to Infinity (or -Infinity) if the input bounds reach the map projection maximum defined latitude
	 * (in the case of Web/Spherical Mercator, it is 85.0511287798 / see https://en.wikipedia.org/wiki/Web_Mercator#Formulas).
	 * Otherwise, the removeOutsideVisibleBounds option will remove markers beyond that limit, whereas the same markers without
	 * this option (or outside MCG) will have their position floored (ceiled) by the projection and rendered at that limit,
	 * making the user think that MCG "eats" them and never displays them again.
	 * @param {LatLngBounds} bounds
	 * @returns {LatLngBounds}
	 */
	_checkBoundsMaxLat(bounds) {
		const maxLat = this._maxLat;

		if (maxLat === undefined) {
			return bounds;
		}
		const north = bounds.getNorth() >= maxLat ? Infinity : bounds.getNorth(),
			south = bounds.getSouth() <= -maxLat ? -Infinity : bounds.getSouth();

		return new L.LatLngBounds([south, bounds.getWest()], [north, bounds.getEast()]);
	}

	/**
	 * Shared animation code.
	 * @param {ClusterChild<M>} layer
	 * @param {ClusterChild<M> | MarkerCluster<M>} newCluster The layer, or the cluster it's shown in.
	 */
	_animationAddLayerNonAnimated(layer, newCluster) {
		if (!(newCluster instanceof MarkerCluster)) {
			this._featureGroup.addLayer(layer);
		} else if (newCluster._childCount === 2) {
			newCluster._addToMap();

			const markers = newCluster._getChildren();
			this._featureGroup.removeLayer(markers[0]);
			this._featureGroup.removeLayer(markers[1]);
		} else {
			newCluster._updateIcon();
		}
	}

	/**
	 * Implements the singleMarkerMode option.
	 * @param {ClusterChild<M>} layer Marker to re-style using the Clusters iconCreateFunction.
	 * @returns {Icon} The newly created icon.
	 */
	_overrideMarkerIcon(layer) {
		const marker = /** @type {Marker} */ (/** @type {Layer} */ (layer)),
			// as much of a cluster as the default iconCreateFunction needs
			cluster = /** @type {MarkerCluster<M>} */ (/** @type {unknown} */ ({
				getChildCount() {
					return 1;
				},
				getAllChildMarkers() {
					return [layer];
				}
			}));
		marker.options.icon = this.options.iconCreateFunction(cluster);
		return marker.options.icon;
	}

	// Refresh

	/**
	 * Updates the icons of the clusters of the given markers, e.g. after changing data that `iconCreateFunction`
	 * uses. In `singleMarkerMode`, also updates the icons of the markers.
	 * @param {MarkerClusterGroup<M> | LayerGroup<M> | MarkerCluster<M> | M | M[] | {[id: string]: M}} [layers] The
	 *   markers, or a group or cluster of them; all markers in this group if not given.
	 * @returns {this}
	 */
	refreshClusters(layers) {
		/** @type {M[] | {[id: string]: M}} */
		let markers;
		if (!layers) {
			markers = this._topClusterLevel.getAllChildMarkers();
		} else if (layers instanceof MarkerClusterGroup) {
			markers = layers._topClusterLevel.getAllChildMarkers();
		} else if (layers instanceof L.LayerGroup) {
			markers = layers.getLayers();
		} else if (layers instanceof MarkerCluster) {
			markers = layers.getAllChildMarkers();
		} else if (layers instanceof L.Layer) {
			markers = [layers];
		} else { // an array, or an object of markers by id
			markers = layers;
		}
		const children = /** @type {ClusterChild<M>[] | {[id: string]: ClusterChild<M>}} */ (markers);
		this._flagParentsIconsNeedUpdate(children);
		this._refreshClustersIcons();

		// In case of singleMarkerMode, also re-draw the markers.
		if (this.options.singleMarkerMode) {
			this._refreshSingleMarkerModeMarkers(children);
		}

		return this;
	}

	/**
	 * Simply flags all parent clusters of the given markers as having a "dirty" icon.
	 * @param {ClusterChild<M>[] | {[id: string]: ClusterChild<M>}} layers
	 */
	_flagParentsIconsNeedUpdate(layers) {
		let id, parent;

		// Assumes layers is an Array or an Object whose prototype is non-enumerable.
		for (id in layers) {
			// Flag parent clusters' icon as "dirty", all the way up.
			// Dumb process that flags multiple times upper parents, but still
			// much more efficient than trying to be smart and make short lists,
			// at least in the case of a hierarchy following a power law:
			// http://jsperf.com/flag-nodes-in-power-hierarchy/2
			parent = /** @type {{[id: string]: ClusterChild<M>}} */ (layers)[id].__parent;
			while (parent) {
				parent._iconNeedsUpdate = true;
				parent = parent.__parent;
			}
		}
	}

	/**
	 * Re-draws the icon of the supplied markers.
	 * To be used in singleMarkerMode only.
	 * @param {ClusterChild<M>[] | {[id: string]: ClusterChild<M>}} layers
	 */
	_refreshSingleMarkerModeMarkers(layers) {
		let id, layer;

		for (id in layers) {
			layer = /** @type {{[id: string]: ClusterChild<M>}} */ (layers)[id];

			// Make sure we do not override markers that do not belong to THIS group.
			if (this.hasLayer(layer)) {
				// Need to re-create the icon first, then re-draw the marker.
				/** @type {Marker} */ (/** @type {Layer} */ (layer)).setIcon(this._overrideMarkerIcon(layer));
			}
		}
	}

	// Spiderfier

	/** Unspiderfies the spiderfied cluster, if any. */
	unspiderfy() {
		this._unspiderfy();
	}

	_spiderfierOnAdd() {
		this._map.on('click', this.unspiderfy, this);

		if (this._map.options.zoomAnimation) {
			this._map.on('zoomstart', this._unspiderfyZoomStart, this);
		}
		//Browsers without zoomAnimation or a big zoom don't fire zoomstart
		this._map.on('zoomend', this._noanimationUnspiderfy, this);
	}

	_spiderfierOnRemove() {
		this._map.off('click', this.unspiderfy, this);
		this._map.off('zoomstart', this._unspiderfyZoomStart, this);
		this._map.off('zoomanim', this._unspiderfyZoomAnim, this);
		this._map.off('zoomend', this._noanimationUnspiderfy, this);

		//Ensure that markers are back where they should be
		// Use no animation to avoid a sticky leaflet-cluster-anim class on mapPane
		this._noanimationUnspiderfy();
	}

	//On zoom start we add a zoomanim handler so that we are guaranteed to be last (after markers are animated)
	//This means we can define the animation they do rather than Markers doing an animation to their actual location
	_unspiderfyZoomStart() {
		if (!this._map) { //May have been removed from the map by a zoomEnd handler
			return;
		}

		this._map.on('zoomanim', this._unspiderfyZoomAnim, this);
	}

	/** @param {ZoomAnimEvent} zoomDetails */
	_unspiderfyZoomAnim(zoomDetails) {
		this._map.off('zoomanim', this._unspiderfyZoomAnim, this);
		this._unspiderfy(zoomDetails);
	}

	/** @param {ZoomAnimEvent} [zoomDetails] */
	_unspiderfy(zoomDetails) {
		if (this._spiderfied) {
			this._spiderfied.unspiderfy(zoomDetails);
		}
	}

	_noanimationUnspiderfy() {
		if (this._spiderfied) {
			this._spiderfied._noanimationUnspiderfy();
		}
	}

	/**
	 * If the given layer is currently being spiderfied then we unspiderfy it so it isn't on the map anymore etc.
	 * @param {ClusterChild<M>} layer
	 */
	_unspiderfyLayer(layer) {
		if (layer._spiderLeg) {
			this._featureGroup.removeLayer(layer);

			if (layer.clusterShow) {
				layer.clusterShow();
			}
			//Position will be fixed up immediately in _animationUnspiderfy
			if (layer.setZIndexOffset) {
				layer.setZIndexOffset(0);
			}

			this._map.removeLayer(layer._spiderLeg);
			delete layer._spiderLeg;
		}
	}

	/**
	 * @param {MarkerCluster<M>} cluster
	 * @param {number} previousZoomLevel
	 * @param {number} newZoomLevel
	 */
	_animationZoomOutSingle(cluster, previousZoomLevel, newZoomLevel) {
		const bounds = this._getExpandedVisibleBounds(),
			minZoom = Math.floor(this._map.getMinZoom());

		//Animate all of the markers in the clusters to move to their cluster center point
		cluster._recursivelyAnimateChildrenInAndAddSelfToMap(bounds, this._currentShownBounds, minZoom, previousZoomLevel + 1, newZoomLevel);

		//Update the opacity (If we immediately set it they won't animate)
		this._forceLayout();
		cluster._recursivelyBecomeVisible(bounds, newZoomLevel);

		//TODO: Maybe use the transition timing stuff to make this more reliable
		//When the animations are done, tidy up
		this._enqueue(() => {

			//This cluster stopped being a cluster before the timeout fired
			if (cluster._childCount === 1) {
				const m = cluster._markers[0];
				//If we were in a cluster animation at the time then the opacity and position of our child could be wrong now, so fix it
				this._ignoreMove = true;
				m.setLatLng(m.getLatLng());
				this._ignoreMove = false;
				if (m.clusterShow) {
					m.clusterShow();
				}
			} else {
				cluster._recursively(bounds, newZoomLevel, minZoom, (c) => {
					c._recursivelyRemoveChildrenFromMap(bounds, minZoom, previousZoomLevel + 1);
				});
			}
			this._animationEnd();
		});
	}

	// animated versions of the methods replaced by noAnimation

	_animationStart() {
		this._map.getPane('mapPane').classList.add('leaflet-cluster-anim');
		this._inZoomAnimation++;
	}

	/**
	 * @param {number} previousZoomLevel
	 * @param {number} newZoomLevel
	 */
	_animationZoomIn(previousZoomLevel, newZoomLevel) {
		const bounds = this._getExpandedVisibleBounds(),
			fg = this._featureGroup,
			minZoom = Math.floor(this._map.getMinZoom());
		let i;

		this._ignoreMove = true;

		//Add all children of current clusters to map and remove those clusters from map
		this._topClusterLevel._recursively(bounds, previousZoomLevel, minZoom, (c) => {
			const markers = c._markers,
				startPos = bounds.contains(c.getLatLng()) ? c.getLatLng() : null;
			let m;

			if (c._isSingleParent() && previousZoomLevel + 1 === newZoomLevel) { //Immediately add the new child and remove us
				fg.removeLayer(c);
				c._recursivelyAddChildrenToMap(null, newZoomLevel, bounds);
			} else {
				//Fade out old cluster
				c.clusterHide();
				c._recursivelyAddChildrenToMap(startPos, newZoomLevel, bounds);
			}

			//Remove all markers that aren't visible any more
			//TODO: Do we actually need to do this on the higher levels too?
			for (i = markers.length - 1; i >= 0; i--) {
				m = markers[i];
				if (!bounds.contains(m.getLatLng())) {
					fg.removeLayer(m);
				}
			}

		});

		this._forceLayout();

		//Update opacities
		this._topClusterLevel._recursivelyBecomeVisible(bounds, newZoomLevel);
		//TODO Maybe? Update markers in _recursivelyBecomeVisible
		fg.eachLayer((n) => {
			if (!(n instanceof MarkerCluster) && n instanceof L.Marker) {
				n.clusterShow();
			}
		});

		//update the positions of the just added clusters/markers
		this._topClusterLevel._recursively(bounds, previousZoomLevel, newZoomLevel, (c) => {
			c._recursivelyRestoreChildPositions(newZoomLevel);
		});

		this._ignoreMove = false;

		//Remove the old clusters and close the zoom animation
		this._enqueue(() => {
			//update the positions of the just added clusters/markers
			this._topClusterLevel._recursively(bounds, previousZoomLevel, minZoom, (c) => {
				fg.removeLayer(c);
				c.clusterShow();
			});

			this._animationEnd();
		});
	}

	/**
	 * @param {number} previousZoomLevel
	 * @param {number} newZoomLevel
	 */
	_animationZoomOut(previousZoomLevel, newZoomLevel) {
		this._animationZoomOutSingle(this._topClusterLevel, previousZoomLevel - 1, newZoomLevel);

		//Need to add markers for those that weren't on the map before but are now
		this._topClusterLevel._recursivelyAddChildrenToMap(null, newZoomLevel, this._getExpandedVisibleBounds());
		//Remove markers that were on the map before but won't be now
		this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds, Math.floor(this._map.getMinZoom()), previousZoomLevel, this._getExpandedVisibleBounds());
	}

	/**
	 * @param {ClusterChild<M>} layer
	 * @param {ClusterChild<M> | MarkerCluster<M>} newCluster The layer, or the cluster it's shown in.
	 */
	_animationAddLayer(layer, newCluster) {
		const fg = this._featureGroup;

		fg.addLayer(layer);
		if (newCluster instanceof MarkerCluster) {
			if (newCluster._childCount > 2) { //Was already a cluster

				newCluster._updateIcon();
				this._forceLayout();
				this._animationStart();

				if (layer instanceof L.Marker) {
					layer._setPos(this._map.latLngToLayerPoint(newCluster.getLatLng()));
				}
				layer.clusterHide?.();

				this._enqueue(() => {
					fg.removeLayer(layer);
					layer.clusterShow?.();

					this._animationEnd();
				});

			} else { //Just became a cluster
				this._forceLayout();

				this._animationStart();
				this._animationZoomOutSingle(newCluster, this._map.getMaxZoom(), this._zoom);
			}
		}
	}

	_animationEnd() {
		if (this._map) {
			this._map.getPane('mapPane').classList.remove('leaflet-cluster-anim');
		}
		this._inZoomAnimation--;
		this.fire('animationend');
	}

	//Force a browser layout of stuff in the map
	// Should apply the current opacity and location to all elements so we can update them again for an animation
	_forceLayout() {
		document.body.getBoundingClientRect();
	}
}


if (isV1) {
	const proto = /** @type {any} */ (MarkerClusterGroup.prototype);

	// 1.x keeps defaults on the prototype, and without a copy of its own, mergeOptions would change every FeatureGroup
	proto.options = Object.create(L.FeatureGroup.prototype.options);

	// subclasses made with 1.x extend() call this, directly or through their own initialize, instead of the constructor
	/**
	 * @this {MarkerClusterGroup}
	 * @param {MarkerClusterGroupOptions} [options]
	 */
	proto.initialize = function (options) {
		this._initGroup(options);
	};

	// 1.x extend() copies only own statics, and ES classes inherit them, so subclasses would lose these
	for (const key of ['extend', 'include', 'mergeOptions', 'addInitHook']) {
		/** @type {any} */ (MarkerClusterGroup)[key] = /** @type {any} */ (L.FeatureGroup)[key];
	}

	// own init hooks, so that addInitHook doesn't add them to every L.FeatureGroup
	const parentCallInitHooks = proto.callInitHooks;
	proto._initHooks = [];
	/** @this {any} */
	proto.callInitHooks = function () {
		if (this._initHooksCalled) { return; }
		parentCallInitHooks.call(this);
		for (const hook of proto._initHooks) {
			hook.call(this);
		}
	};
}

MarkerClusterGroup.mergeOptions({
	maxClusterRadius: 80, //A cluster will cover at most this many pixels from its center
	iconCreateFunction: null,
	clusterPane: (L.Marker.defaultOptions ?? L.Marker.prototype.options).pane,

	spiderfyOnEveryZoom: false,
	spiderfyOnMaxZoom: true,
	showCoverageOnHover: true,
	zoomToBoundsOnClick: true,
	singleMarkerMode: false,

	disableClusteringAtZoom: null,

	// Setting this to false prevents the removal of any clusters outside of the viewpoint, which
	// is the default behaviour for performance reasons.
	removeOutsideVisibleBounds: true,

	// Set to false to disable all animations (zoom and spiderfy).
	// If false, option animateAddingMarkers below has no effect.
	animate: true,

	//Whether to animate adding markers after adding the MarkerClusterGroup to the map
	// If you are adding individual markers set to true, if adding bulk markers leave false for massive performance gains.
	animateAddingMarkers: false,

	// Make it possible to provide custom function to calculate spiderfy shape positions
	spiderfyShapePositions: null,

	//Increase to increase the distance away that spiderfied markers appear from the center
	spiderfyDistanceMultiplier: 1,

	// Make it possible to specify a polyline options on a spider leg
	spiderLegPolylineOptions: {weight: 1.5, color: '#222', opacity: 0.5},

	// When bulk adding layers, adds markers in chunks. Means addLayers may not add all the layers in the call, others will be loaded during setTimeouts
	chunkedLoading: false,
	chunkInterval: 200, // process markers for a maximum of ~ n milliseconds (then trigger the chunkProgress callback)
	chunkDelay: 50, // at the end of each interval, give n milliseconds back to system/browser
	chunkProgress: null, // progress callback: function(processed, total, elapsed) (e.g. for a progress indicator)

	//Options to pass to the L.Polygon constructor
	polygonOptions: {}
});
