import * as L from 'leaflet';
import {DistanceGrid} from './DistanceGrid.js';
import {MarkerCluster, MarkerClusterNonAnimated} from './MarkerCluster.js';
import './MarkerPatches.js';

const isV1 = L.version.startsWith('1.');

// 2.0 markers turn Enter and Space into clicks, while 1.x only fires keypress
const clickEvents = isV1 ? 'clusterclick clusterkeypress' : 'clusterclick';

// 2.0 hover events keep their 1.x names on clusters, clustermouseover and clustermouseout
const clusterEventNames = isV1 ? {} : {pointerover: 'mouseover', pointerout: 'mouseout'};

function clusterEventType(type) {
	return `cluster${clusterEventNames[type] ?? type}`;
}

// Constant bounds used in case option "removeOutsideVisibleBounds" is set to false.
const mapBoundsInfinite = new L.LatLngBounds(new L.LatLng(-Infinity, -Infinity), new L.LatLng(Infinity, Infinity));

// MarkerClusterGroup extends FeatureGroup by clustering the markers contained within
export class MarkerClusterGroup extends L.FeatureGroup {
	static initHooks = true;

	constructor(options) {
		// 1.x calls initialize() (set below) from its constructor with these arguments, then the init hooks
		super(isV1 ? options : undefined);
		if (!isV1) {
			this._initGroup(options);
			this.callInitHooks();
		}
	}

	_initGroup(options) {
		L.Util.setOptions(this, options);
		if (!this.options.iconCreateFunction) {
			this.options.iconCreateFunction = this._defaultIconCreateFunction;
		}

		this._featureGroup = new L.FeatureGroup();
		this._featureGroup.addEventParent(this);

		this._nonPointGroup = new L.FeatureGroup();
		this._nonPointGroup.addEventParent(this);

		this._inZoomAnimation = 0;
		this._needsClustering = [];
		this._needsRemoving = []; //Markers removed while we aren't on the map need to be kept track of
		//The bounds of the currently shown area (from _getExpandedVisibleBounds) Updated on zoom/move
		this._currentShownBounds = null;

		this._queue = [];

		//The MarkerCluster currently spiderfied (if any)
		this._spiderfied = null;

		this._childMarkerEventHandlers = {
			'dragstart': this._childMarkerDragStart,
			'move': this._childMarkerMoved,
			'dragend': this._childMarkerDragEnd,
		};

		// Hook the appropriate animation methods.
		const animate = this.options.animate;
		Object.assign(this, animate ? this._withAnimation : this._noAnimation);
		// Remember which MarkerCluster class to instantiate (animated or not).
		this._markerCluster = animate ? MarkerCluster : MarkerClusterNonAnimated;
	}

	addLayer(layer) {

		if (layer instanceof L.LayerGroup) {
			return this.addLayers([layer]);
		}

		//Don't cluster non point data
		if (!layer.getLatLng) {
			this._nonPointGroup.addLayer(layer);
			this.fire('layeradd', {layer});
			return this;
		}

		if (!this._map) {
			this._needsClustering.push(layer);
			this.fire('layeradd', {layer});
			return this;
		}

		if (this.hasLayer(layer)) {
			return this;
		}


		//If we have already clustered we'll need to add this one to a cluster

		if (this._unspiderfy) {
			this._unspiderfy();
		}

		this._addLayer(layer, this._maxZoom);
		this.fire('layeradd', {layer});

		// Refresh bounds and weighted positions.
		this._topClusterLevel._recalculateBounds();

		this._refreshClustersIcons();

		//Work out what is visible
		const currentZoom = this._zoom;
		let visibleLayer = layer;
		if (layer.__parent) {
			while (visibleLayer.__parent._zoom >= currentZoom) {
				visibleLayer = visibleLayer.__parent;
			}
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

	removeLayer(layer) {

		if (layer instanceof L.LayerGroup) {
			return this.removeLayers([layer]);
		}

		//Non point layers
		if (!layer.getLatLng) {
			this._nonPointGroup.removeLayer(layer);
			this.fire('layerremove', {layer});
			return this;
		}

		if (!this._map) {
			if (!this._arraySplice(this._needsClustering, layer) && this.hasLayer(layer)) {
				this._needsRemoving.push({layer});
			}
			this.fire('layerremove', {layer});
			return this;
		}

		if (!layer.__parent) {
			return this;
		}

		if (this._unspiderfy) {
			this._unspiderfy();
			this._unspiderfyLayer(layer);
		}

		//Remove the marker from clusters
		this._removeLayer(layer, true);
		this.fire('layerremove', {layer});

		// Refresh bounds and weighted positions.
		this._topClusterLevel._recalculateBounds();

		this._refreshClustersIcons();

		layer.off(this._childMarkerEventHandlers, this);

		if (this._featureGroup.hasLayer(layer)) {
			this._featureGroup.removeLayer(layer);
			if (layer.clusterShow) {
				layer.clusterShow();
			}
		}

		return this;
	}

	//Takes an array of markers and adds them in bulk
	addLayers(layersArray, skipLayerAddEvent) {
		if (!Array.isArray(layersArray)) {
			return this.addLayer(layersArray);
		}

		const fg = this._featureGroup,
			npg = this._nonPointGroup,
			chunked = this.options.chunkedLoading,
			chunkInterval = this.options.chunkInterval,
			chunkProgress = this.options.chunkProgress;
		let l = layersArray.length,
			offset = 0,
			originalArray = true,
			m;

		if (this._map) {
			const started = (new Date()).getTime();
			const process = () => {
				const start = (new Date()).getTime();

				// Make sure to unspiderfy before starting to add some layers
				if (this._map && this._unspiderfy) {
					this._unspiderfy();
				}

				for (; offset < l; offset++) {
					if (chunked && offset % 200 === 0) {
						// every couple hundred markers, instrument the time elapsed since processing started:
						const elapsed = (new Date()).getTime() - start;
						if (elapsed > chunkInterval) {
							break; // been working too hard, time to take a break :-)
						}
					}

					m = layersArray[offset];

					// Group of layers, append children to layersArray and skip.
					// Side effects:
					// - Total increases, so chunkProgress ratio jumps backward.
					// - Groups are not included in this group, only their non-group child layers (hasLayer).
					// Changing array length while looping does not affect performance in current browsers:
					// http://jsperf.com/for-loop-changing-length/6
					if (m instanceof L.LayerGroup) {
						if (originalArray) {
							layersArray = layersArray.slice();
							originalArray = false;
						}
						this._extractNonGroupLayers(m, layersArray);
						l = layersArray.length;
						continue;
					}

					//Not point data, can't be clustered
					if (!m.getLatLng) {
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
					if (m.__parent) {
						if (m.__parent.getChildCount() === 2) {
							const markers = m.__parent.getAllChildMarkers(),
								otherMarker = markers[0] === m ? markers[1] : markers[0];
							fg.removeLayer(otherMarker);
						}
					}
				}

				if (chunkProgress) {
					// report progress and time elapsed:
					chunkProgress(offset, l, (new Date()).getTime() - started);
				}

				// Completed processing all markers.
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
		} else {
			const needsClustering = this._needsClustering;

			for (; offset < l; offset++) {
				m = layersArray[offset];

				// Group of layers, append children to layersArray and skip.
				if (m instanceof L.LayerGroup) {
					if (originalArray) {
						layersArray = layersArray.slice();
						originalArray = false;
					}
					this._extractNonGroupLayers(m, layersArray);
					l = layersArray.length;
					continue;
				}

				//Not point data, can't be clustered
				if (!m.getLatLng) {
					npg.addLayer(m);
					continue;
				}

				if (this.hasLayer(m)) {
					continue;
				}

				needsClustering.push(m);
			}
		}
		return this;
	}

	//Takes an array of markers and removes them in bulk
	removeLayers(layersArray) {
		const fg = this._featureGroup,
			npg = this._nonPointGroup;
		let i, m,
			l = layersArray.length,
			originalArray = true;

		if (!this._map) {
			for (i = 0; i < l; i++) {
				m = layersArray[i];

				// Group of layers, append children to layersArray and skip.
				if (m instanceof L.LayerGroup) {
					if (originalArray) {
						layersArray = layersArray.slice();
						originalArray = false;
					}
					this._extractNonGroupLayers(m, layersArray);
					l = layersArray.length;
					continue;
				}

				this._arraySplice(this._needsClustering, m);
				npg.removeLayer(m);
				if (this.hasLayer(m)) {
					this._needsRemoving.push({layer: m});
				}
				this.fire('layerremove', {layer: m});
			}
			return this;
		}

		if (this._unspiderfy) {
			this._unspiderfy();

			// Work on a copy of the array, so that next loop is not affected.
			const layersArray2 = layersArray.slice();
			let l2 = l;
			for (i = 0; i < l2; i++) {
				m = layersArray2[i];

				// Group of layers, append children to layersArray and skip.
				if (m instanceof L.LayerGroup) {
					this._extractNonGroupLayers(m, layersArray2);
					l2 = layersArray2.length;
					continue;
				}

				this._unspiderfyLayer(m);
			}
		}

		for (i = 0; i < l; i++) {
			m = layersArray[i];

			// Group of layers, append children to layersArray and skip.
			if (m instanceof L.LayerGroup) {
				if (originalArray) {
					layersArray = layersArray.slice();
					originalArray = false;
				}
				this._extractNonGroupLayers(m, layersArray);
				l = layersArray.length;
				continue;
			}

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

	//Removes all layers from the MarkerClusterGroup
	clearLayers() {
		//Need our own special implementation as the LayerGroup one doesn't work for us

		//If we aren't on the map (yet), blow away the markers we know of
		if (!this._map) {
			this._needsClustering = [];
			this._needsRemoving = [];
			delete this._gridClusters;
			delete this._gridUnclustered;
		}

		if (this._noanimationUnspiderfy) {
			this._noanimationUnspiderfy();
		}

		//Remove all the visible layers
		this._featureGroup.clearLayers();
		this._nonPointGroup.clearLayers();

		this.eachLayer((marker) => {
			marker.off(this._childMarkerEventHandlers, this);
			delete marker.__parent;
		});

		if (this._map) {
			//Reset _topClusterLevel and the DistanceGrids
			this._generateInitialClusters();
		}

		return this;
	}

	//Override FeatureGroup.getBounds as it doesn't work
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

	//Overrides LayerGroup.eachLayer
	eachLayer(method, context) {
		const markers = this._needsClustering.slice(),
			needsRemoving = this._needsRemoving;
		let thisNeedsRemoving, i, j;

		if (this._topClusterLevel) {
			this._topClusterLevel.getAllChildMarkers(markers);
		}

		for (i = markers.length - 1; i >= 0; i--) {
			thisNeedsRemoving = true;

			for (j = needsRemoving.length - 1; j >= 0; j--) {
				if (needsRemoving[j].layer === markers[i]) {
					thisNeedsRemoving = false;
					break;
				}
			}

			if (thisNeedsRemoving) {
				method.call(context, markers[i]);
			}
		}

		this._nonPointGroup.eachLayer(method, context);
	}

	//Overrides LayerGroup.getLayers
	getLayers() {
		const layers = [];
		this.eachLayer((l) => {
			layers.push(l);
		});
		return layers;
	}

	//Overrides LayerGroup.getLayer, WARNING: Really bad performance
	getLayer(id) {
		let result = null;

		id = parseInt(id, 10);

		this.eachLayer((l) => {
			if (L.Util.stamp(l) === id) {
				result = l;
			}
		});

		return result;
	}

	//Returns true if the given layer is in this MarkerClusterGroup
	hasLayer(layer) {
		if (!layer) {
			return false;
		}

		let i, anArray = this._needsClustering;

		for (i = anArray.length - 1; i >= 0; i--) {
			if (anArray[i] === layer) {
				return true;
			}
		}

		anArray = this._needsRemoving;
		for (i = anArray.length - 1; i >= 0; i--) {
			if (anArray[i].layer === layer) {
				return false;
			}
		}

		return !!(layer.__parent && layer.__parent._group === this) || this._nonPointGroup.hasLayer(layer);
	}

	//Zoom down to show the given layer (spiderfying if necessary) then calls the callback
	zoomToShowLayer(layer, callback) {

		const map = this._map;

		if (typeof callback !== 'function') {
			callback = function () {};
		}

		const showMarker = () => {
			// Assumes that map.hasLayer checks for direct appearance on map, not recursively calling
			// hasLayer on Layer Groups that are on map (typically not calling this MarkerClusterGroup.hasLayer, which would always return true)
			if ((map.hasLayer(layer) || map.hasLayer(layer.__parent)) && !this._inZoomAnimation) {
				this._map.off('moveend', showMarker, this);
				this.off('animationend', showMarker, this);

				if (map.hasLayer(layer)) {
					callback();
				} else if (map.hasLayer(layer.__parent)) {
					this.once('spiderfied', callback, this);
					layer.__parent.spiderfy();
				}
			}
		};

		if (map.hasLayer(layer) && map.getBounds().contains(layer.getLatLng())) {
			//Layer is visible ond on screen, immediate return
			callback();
		} else if (layer.__parent._zoom < Math.round(this._map.getZoom())) {
			//Layer should be visible at this zoom level. It must not be on screen so just pan over to it
			this._map.on('moveend', showMarker, this);
			this._map.panTo(layer.getLatLng());
		} else {
			this._map.on('moveend', showMarker, this);
			this.on('animationend', showMarker, this);
			layer.__parent.zoomToBounds();
		}
	}

	//Overrides FeatureGroup.onAdd
	onAdd(map) {
		this._map = map;
		let i, l;

		if (!isFinite(this._map.getMaxZoom())) {
			throw new Error('Map has no maxZoom specified');
		}

		this._featureGroup.addTo(map);
		this._nonPointGroup.addTo(map);

		if (!this._gridClusters) {
			this._generateInitialClusters();
		}

		this._maxLat = map.options.crs.projection.MAX_LATITUDE;

		for (i = 0, l = this._needsRemoving.length; i < l; i++) {
			this._removeLayer(this._needsRemoving[i].layer, true);
		}
		this._needsRemoving = [];

		//Remember the current zoom level and bounds
		this._zoom = Math.round(this._map.getZoom());
		this._currentShownBounds = this._getExpandedVisibleBounds();

		this._map.on('zoomend', this._zoomEnd, this);
		this._map.on('moveend', this._moveEnd, this);

		if (this._spiderfierOnAdd) { //TODO FIXME: Not sure how to have spiderfier add something on here nicely
			this._spiderfierOnAdd();
		}

		this._bindEvents();

		//Actually add our markers to the map:
		l = this._needsClustering;
		this._needsClustering = [];
		this.addLayers(l, true);
	}

	//Overrides FeatureGroup.onRemove
	onRemove(map) {
		map.off('zoomend', this._zoomEnd, this);
		map.off('moveend', this._moveEnd, this);

		this._unbindEvents();

		//In case we are in a cluster animation
		this._map.getPane('mapPane').classList.remove('leaflet-cluster-anim');

		if (this._spiderfierOnRemove) { //TODO FIXME: Not sure how to have spiderfier add something on here nicely
			this._spiderfierOnRemove();
		}

		delete this._maxLat;

		//Clean up all the layers we added to the map
		this._hideCoverage();
		this._featureGroup.remove();
		this._nonPointGroup.remove();

		this._featureGroup.clearLayers();

		this._map = null;
	}

	getVisibleParent(marker) {
		let vMarker = marker;
		while (vMarker && !this._featureGroup.hasLayer(vMarker)) {
			vMarker = vMarker.__parent;
		}
		return vMarker || null;
	}

	//Remove the given object from the given array
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
	 * @param marker to be removed from _gridUnclustered.
	 * @param z integer bottom start zoom level (included)
	 * @private
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

	_childMarkerDragStart(e) {
		e.target.__dragStart = true;
	}

	_childMarkerMoved(e) {
		if (!this._ignoreMove && !e.target.__dragStart) {
			const isPopupOpen = e.target.isPopupOpen();

			this._moveChild(e.target);

			if (isPopupOpen) {
				e.target.openPopup();
			}
		}
	}

	// the distance grids remember the projected point each marker was added at, so the old latlng isn't needed
	_moveChild(layer) {
		this.removeLayer(layer);
		this.addLayer(layer);
	}

	_childMarkerDragEnd(e) {
		const dragged = e.target.__dragStart;
		delete e.target.__dragStart;
		if (dragged) {
			this._moveChild(e.target);
		}
	}


	//Internal function for removing a marker from everything.
	//dontUpdateMap: set to true if you will handle updating the map manually (for bulk functions)
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
		const markers = marker.__parent._markers;
		let cluster = marker.__parent,
			otherMarker;

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
				otherMarker = cluster._markers[0] === marker ? cluster._markers[1] : cluster._markers[0];

				//Update distance grid
				gridClusters[cluster._zoom].removeObject(cluster);
				gridUnclustered[cluster._zoom].addObject(otherMarker, map.project(otherMarker.getLatLng(), cluster._zoom));

				//Move otherMarker up to parent
				this._arraySplice(cluster.__parent._childClusters, cluster);
				cluster.__parent._markers.push(otherMarker);
				otherMarker.__parent = cluster.__parent;

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

	_isOrIsParent(el, oel) {
		while (oel) {
			if (el === oel) {
				return true;
			}
			oel = oel.parentNode;
		}
		return false;
	}

	// events from clusters are fired as clusterclick, clustermouseover, etc.
	fire(type, data, propagate) {
		if (data && data.layer instanceof MarkerCluster) {
			//Prevent multiple clustermouseover/off events if the icon is made up of stacked divs
			if (data.originalEvent && this._isOrIsParent(data.layer.getElement(), data.originalEvent.relatedTarget)) {
				return this;
			}
			type = clusterEventType(type);
		}

		return super.fire(type, data, propagate);
	}

	listens(type, ...args) {
		return super.listens(type, ...args) || super.listens(clusterEventType(type), ...args);
	}

	//Default functionality
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

	_zoomOrSpiderfy(e) {
		const cluster = e.layer,
			original = e.originalEvent;
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

	_showCoverage(e) {
		const map = this._map;
		if (this._inZoomAnimation) {
			return;
		}
		if (this._shownPolygon) {
			map.removeLayer(this._shownPolygon);
		}
		if (e.layer.getChildCount() > 2 && e.layer !== this._spiderfied) {
			this._shownPolygon = new L.Polygon(e.layer.getConvexHull(), this.options.polygonOptions);
			map.addLayer(this._shownPolygon);
		}
	}

	_hideCoverage() {
		if (this._shownPolygon) {
			this._map.removeLayer(this._shownPolygon);
			this._shownPolygon = null;
		}
	}

	_unbindEvents() {
		const spiderfyOnMaxZoom = this.options.spiderfyOnMaxZoom,
			showCoverageOnHover = this.options.showCoverageOnHover,
			zoomToBoundsOnClick = this.options.zoomToBoundsOnClick,
			spiderfyOnEveryZoom = this.options.spiderfyOnEveryZoom,
			map = this._map;

		if (spiderfyOnMaxZoom || zoomToBoundsOnClick || spiderfyOnEveryZoom) {
			this.off(clickEvents, this._zoomOrSpiderfy, this);
		}
		if (showCoverageOnHover) {
			this.off('clustermouseover', this._showCoverage, this);
			this.off('clustermouseout', this._hideCoverage, this);
			map.off('zoomend', this._hideCoverage, this);
		}
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
			radius = this.options.maxClusterRadius;
		let maxZoom = Math.ceil(this._map.getMaxZoom()),
			radiusFn = radius;

		//If we just set maxClusterRadius to a single number, we need to create
		//a simple function to return that number. Otherwise, we just have to
		//use the function we've passed in.
		if (typeof radius !== 'function') {
			radiusFn = function () { return radius; };
		}

		if (this.options.disableClusteringAtZoom !== null) {
			maxZoom = this.options.disableClusteringAtZoom - 1;
		}
		this._maxZoom = maxZoom;
		this._gridClusters = {};
		this._gridUnclustered = {};

		//Set up DistanceGrids for each zoom

		if (!isFinite(maxZoom)) {
			throw new Error('Map has no maxZoom specified');
		}
		if (!isFinite(minZoom)) {
			throw new Error('Map has no minZoom specified');
		}
		for (let zoom = maxZoom; zoom >= minZoom; zoom--) {
			this._gridClusters[zoom] = new DistanceGrid(radiusFn(zoom));
			this._gridUnclustered[zoom] = new DistanceGrid(radiusFn(zoom));
		}

		// Instantiate the appropriate L.MarkerCluster class (animated or not).
		this._topClusterLevel = new this._markerCluster(this, minZoom - 1);
	}

	//Zoom: Zoom to start adding at (Pass this._maxZoom to start at the bottom)
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
			let closest = gridClusters[zoom].getNearObject(markerPoint);
			if (closest) {
				closest._addChild(layer);
				layer.__parent = closest;
				return;
			}

			//Try find a marker close by to form a new cluster with
			closest = gridUnclustered[zoom].getNearObject(markerPoint);
			if (closest) {
				const parent = closest.__parent;
				if (parent) {
					this._removeLayer(closest, false);
				}

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
	 * @private
	 */
	_refreshClustersIcons() {
		this._featureGroup.eachLayer((c) => {
			if (c instanceof MarkerCluster && c._iconNeedsUpdate) {
				c._updateIcon();
			}
		});
	}

	//Enqueue code to fire after the marker expand/contract has happened
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
		clearTimeout(this._queueTimeout);
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
	 * @param bounds L.LatLngBounds
	 * @returns {L.LatLngBounds}
	 * @private
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

	//Shared animation code
	_animationAddLayerNonAnimated(layer, newCluster) {
		if (newCluster === layer) {
			this._featureGroup.addLayer(layer);
		} else if (newCluster._childCount === 2) {
			newCluster._addToMap();

			const markers = newCluster.getAllChildMarkers();
			this._featureGroup.removeLayer(markers[0]);
			this._featureGroup.removeLayer(markers[1]);
		} else {
			newCluster._updateIcon();
		}
	}

	/**
	 * Extracts individual (i.e. non-group) layers from a Layer Group.
	 * @param group to extract layers from.
	 * @param output {Array} in which to store the extracted layers.
	 * @returns {*|Array}
	 * @private
	 */
	_extractNonGroupLayers(group, output) {
		const layers = group.getLayers();
		let i = 0,
			layer;

		output = output || [];

		for (; i < layers.length; i++) {
			layer = layers[i];

			if (layer instanceof L.LayerGroup) {
				this._extractNonGroupLayers(layer, output);
				continue;
			}

			output.push(layer);
		}

		return output;
	}

	/**
	 * Implements the singleMarkerMode option.
	 * @param layer Marker to re-style using the Clusters iconCreateFunction.
	 * @returns {L.Icon} The newly created icon.
	 * @private
	 */
	_overrideMarkerIcon(layer) {
		const icon = layer.options.icon = this.options.iconCreateFunction({
			getChildCount() {
				return 1;
			},
			getAllChildMarkers() {
				return [layer];
			}
		});

		return icon;
	}

	// Refresh

	/**
	 * Updates the icon of all clusters which are parents of the given marker(s).
	 * In singleMarkerMode, also updates the given marker(s) icon.
	 * @param layers L.MarkerClusterGroup|L.LayerGroup|Array(L.Marker)|Map(L.Marker)|
	 * L.MarkerCluster|L.Marker (optional) list of markers (or single marker) whose parent
	 * clusters need to be updated. If not provided, retrieves all child markers of this.
	 * @returns {L.MarkerClusterGroup}
	 */
	refreshClusters(layers) {
		if (!layers) {
			layers = this._topClusterLevel.getAllChildMarkers();
		} else if (layers instanceof MarkerClusterGroup) {
			layers = layers._topClusterLevel.getAllChildMarkers();
		} else if (layers instanceof L.LayerGroup) {
			layers = layers.getLayers();
		} else if (layers instanceof MarkerCluster) {
			layers = layers.getAllChildMarkers();
		} else if (layers instanceof L.Marker) {
			layers = [layers];
		} // else: must be an Array(L.Marker)|Map(L.Marker)
		this._flagParentsIconsNeedUpdate(layers);
		this._refreshClustersIcons();

		// In case of singleMarkerMode, also re-draw the markers.
		if (this.options.singleMarkerMode) {
			this._refreshSingleMarkerModeMarkers(layers);
		}

		return this;
	}

	/**
	 * Simply flags all parent clusters of the given markers as having a "dirty" icon.
	 * @param layers Array(L.Marker)|Map(L.Marker) list of markers.
	 * @private
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
			parent = layers[id].__parent;
			while (parent) {
				parent._iconNeedsUpdate = true;
				parent = parent.__parent;
			}
		}
	}

	/**
	 * Re-draws the icon of the supplied markers.
	 * To be used in singleMarkerMode only.
	 * @param layers Array(L.Marker)|Map(L.Marker) list of markers.
	 * @private
	 */
	_refreshSingleMarkerModeMarkers(layers) {
		let id, layer;

		for (id in layers) {
			layer = layers[id];

			// Make sure we do not override markers that do not belong to THIS group.
			if (this.hasLayer(layer)) {
				// Need to re-create the icon first, then re-draw the marker.
				layer.setIcon(this._overrideMarkerIcon(layer));
			}
		}
	}

	// Spiderfier

	unspiderfy(...args) {
		this._unspiderfy(...args);
	}

	_spiderfierOnAdd() {
		this._map.on('click', this._unspiderfyWrapper, this);

		if (this._map.options.zoomAnimation) {
			this._map.on('zoomstart', this._unspiderfyZoomStart, this);
		}
		//Browsers without zoomAnimation or a big zoom don't fire zoomstart
		this._map.on('zoomend', this._noanimationUnspiderfy, this);

		if (!matchMedia('(pointer: coarse)').matches) {
			this._map.getRenderer(this);
			//Needs to happen in the pageload, not after, or animations don't work in webkit
			//  http://stackoverflow.com/questions/8455200/svg-animate-with-dynamically-added-elements
			//Disable on touch browsers as the animation messes up on a touch zoom and isn't very noticable
		}
	}

	_spiderfierOnRemove() {
		this._map.off('click', this._unspiderfyWrapper, this);
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

	_unspiderfyZoomAnim(zoomDetails) {
		this._map.off('zoomanim', this._unspiderfyZoomAnim, this);
		this._unspiderfy(zoomDetails);
	}

	_unspiderfyWrapper() {
		/// <summary>_unspiderfy but passes no arguments</summary>
		this._unspiderfy();
	}

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

	//If the given layer is currently being spiderfied then we unspiderfy it so it isn't on the map anymore etc
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

	// Private methods for animated versions.
	_animationZoomOutSingle(cluster, previousZoomLevel, newZoomLevel) {
		const bounds = this._getExpandedVisibleBounds(),
			minZoom = Math.floor(this._map.getMinZoom());

		//Animate all of the markers in the clusters to move to their cluster center point
		cluster._recursivelyAnimateChildrenInAndAddSelfToMap(bounds, this._currentShownBounds, minZoom, previousZoomLevel + 1, newZoomLevel);

		const me = this;

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
			me._animationEnd();
		});
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

Object.assign(MarkerClusterGroup.prototype, {
	_noAnimation: {
		//Non Animated versions of everything
		_animationStart() {
			//Do nothing...
		},
		_animationZoomIn(previousZoomLevel, newZoomLevel) {
			this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds, Math.floor(this._map.getMinZoom()), previousZoomLevel);
			this._topClusterLevel._recursivelyAddChildrenToMap(null, newZoomLevel, this._getExpandedVisibleBounds());

			//We didn't actually animate, but we use this event to mean "clustering animations have finished"
			this.fire('animationend');
		},
		_animationZoomOut(previousZoomLevel, newZoomLevel) {
			this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds, Math.floor(this._map.getMinZoom()), previousZoomLevel);
			this._topClusterLevel._recursivelyAddChildrenToMap(null, newZoomLevel, this._getExpandedVisibleBounds());

			//We didn't actually animate, but we use this event to mean "clustering animations have finished"
			this.fire('animationend');
		},
		_animationAddLayer(layer, newCluster) {
			this._animationAddLayerNonAnimated(layer, newCluster);
		}
	},

	_withAnimation: {
		//Animated versions here
		_animationStart() {
			this._map.getPane('mapPane').classList.add('leaflet-cluster-anim');
			this._inZoomAnimation++;
		},

		_animationZoomIn(previousZoomLevel, newZoomLevel) {
			const bounds = this._getExpandedVisibleBounds(),
				fg = this._featureGroup,
				minZoom = Math.floor(this._map.getMinZoom());
			let i;

			this._ignoreMove = true;

			//Add all children of current clusters to map and remove those clusters from map
			this._topClusterLevel._recursively(bounds, previousZoomLevel, minZoom, (c) => {
				const markers = c._markers;
				let startPos = c.getLatLng(),
					m;

				if (!bounds.contains(startPos)) {
					startPos = null;
				}

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
		},

		_animationZoomOut(previousZoomLevel, newZoomLevel) {
			this._animationZoomOutSingle(this._topClusterLevel, previousZoomLevel - 1, newZoomLevel);

			//Need to add markers for those that weren't on the map before but are now
			this._topClusterLevel._recursivelyAddChildrenToMap(null, newZoomLevel, this._getExpandedVisibleBounds());
			//Remove markers that were on the map before but won't be now
			this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds, Math.floor(this._map.getMinZoom()), previousZoomLevel, this._getExpandedVisibleBounds());
		},

		_animationAddLayer(layer, newCluster) {
			const me = this,
				fg = this._featureGroup;

			fg.addLayer(layer);
			if (newCluster !== layer) {
				if (newCluster._childCount > 2) { //Was already a cluster

					newCluster._updateIcon();
					this._forceLayout();
					this._animationStart();

					layer._setPos(this._map.latLngToLayerPoint(newCluster.getLatLng()));
					layer.clusterHide();

					this._enqueue(() => {
						fg.removeLayer(layer);
						layer.clusterShow();

						me._animationEnd();
					});

				} else { //Just became a cluster
					this._forceLayout();

					me._animationStart();
					me._animationZoomOutSingle(newCluster, this._map.getMaxZoom(), this._zoom);
				}
			}
		}
	}
});

if (isV1) {
	const proto = MarkerClusterGroup.prototype;

	// 1.x keeps defaults on the prototype, and without a copy of its own, mergeOptions would change every FeatureGroup
	proto.options = Object.create(L.FeatureGroup.prototype.options);

	// subclasses made with 1.x extend() call this, directly or through their own initialize, instead of the constructor
	proto.initialize = function (options) {
		this._initGroup(options);
	};

	// 1.x extend() copies only own statics, and ES classes inherit them, so subclasses would lose these
	for (const key of ['extend', 'include', 'mergeOptions', 'addInitHook']) {
		MarkerClusterGroup[key] = L.FeatureGroup[key];
	}

	// own init hooks, so that addInitHook doesn't add them to every L.FeatureGroup
	const parentCallInitHooks = proto.callInitHooks;
	proto._initHooks = [];
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
