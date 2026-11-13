import * as L from 'leaflet';
import {QuickHull} from './QuickHull.js';

/** @import {FitBoundsOptions, Icon, LatLng, LatLngBounds, LatLngExpression, Layer, LeafletMap, Marker, Point, Polyline} from 'leaflet' */
/** @import {MarkerClusterGroup} from './MarkerClusterGroup.js' */

/**
 * A point layer in a group: a marker, or a vector layer with a single point like a circle marker.
 * @template {Layer} [M=Layer]
 * @typedef {M & {
 *   getLatLng(): LatLng,
 *   setLatLng(latlng: LatLngExpression): unknown,
 *   isPopupOpen(): boolean,
 *   openPopup(): unknown,
 *   closePopup(): unknown,
 *   clusterHide?(): unknown,
 *   clusterShow?(): unknown,
 *   setZIndexOffset?(offset: number): unknown
 * }} ClusterChild
 */

/**
 * Spiderfy layout constants, kept on the prototype so that apps can change them.
 * @typedef {object} SpiderfyShape
 * @property {number} _2PI
 * @property {number} _circleFootSeparation Related to the circumference of the circle.
 * @property {number} _circleStartAngle
 * @property {number} _spiralFootSeparation Related to the size of the spiral.
 * @property {number} _spiralLengthStart
 * @property {number} _spiralLengthFactor
 * @property {number} _circleSpiralSwitchover Marker count from which a spiral is shown instead of a circle.
 */

const isV1 = L.version.startsWith('1.');

/**
 * The cluster each marker is in, the group's top level one if no other. Clusters keep theirs in `_parent`. Shared
 * between groups since a marker can be in one group only, and refreshIconOptions only has the marker to go by.
 * @type {WeakMap<Layer, MarkerCluster<any>>}
 */
export const parents = new WeakMap();

// the spiderLegPolylineOptions default
const defaultLegOpacity = 0.5;

/**
 * The leg's path element for the line drawing animation, or null with the Canvas renderer.
 * @param {Polyline | undefined} leg
 */
function svgPath(leg) {
	const el = leg?.getElement();
	return el instanceof SVGGeometryElement ? el : null;
}

const animationId = 'leaflet.markercluster';

// Leaflet's zoom animation timing (the leaflet-zoom-anim transition), for animations that run together with it
const zoomDuration = 250;
const zoomEasing = 'cubic-bezier(0,0,0.25,1)';

/** @type {MediaQueryList | undefined} */
let reducedMotionQuery;

// with reduced motion, markers and legs only fade, as fades don't count as motion
function reducedMotion() {
	reducedMotionQuery ??= window.matchMedia('(prefers-reduced-motion: reduce)');
	return reducedMotionQuery.matches;
}

/** @param {Marker} marker */
function markerElements(marker) {
	const shadow = /** @type {{_shadow?: HTMLElement | null}} */ (/** @type {unknown} */ (marker))._shadow;
	return [marker.getElement(), shadow].filter(el => el != null);
}

/** @param {Point} p */
function px(p) {
	return `${p.x}px ${p.y}px`;
}

/**
 * Animates a marker into its current state from the given one. Leaflet keeps positioning the icon and shadow with an
 * inline `transform`; the animation moves them with the separate `translate` property on top of it, so the marker can
 * stay at its real latlng. The final opacity is the inline one, so the caller sets it (e.g. clusterHide) before.
 * @param {Marker} marker
 * @param {Point | null} from Pixel offset to start from, or null to start at the marker's position.
 * @param {Point | null} to Pixel offset to end at, or null. It's not held, so the marker should end up hidden or removed.
 * @param {number | undefined} fromOpacity Opacity to fade from.
 * @param {number} duration
 * @param {boolean} [withZoom] Move with the timing of the map zoom animation that's starting.
 */
export function animateMarker(marker, from, to, fromOpacity, duration, withZoom = false) {
	const zero = new L.Point(0, 0);
	for (const el of markerElements(marker)) {
		if ((from || to) && !reducedMotion()) {
			el.animate({translate: [px(from ?? zero), px(to ?? zero)]}, withZoom ?
				{duration: zoomDuration, easing: zoomEasing, id: animationId} :
				{duration, easing: 'ease-out', id: animationId});
		}
		if (fromOpacity !== undefined) {
			el.animate([{opacity: fromOpacity, offset: 0}], {duration, easing: 'ease-in', id: animationId});
		}
	}
}

/**
 * Cancels our running animations on the elements (and their descendants with subtree), putting them in their final
 * state right away.
 * @param {Element[]} elements
 * @param {boolean} [subtree]
 */
export function cancelAnimations(elements, subtree = false) {
	for (const el of elements) {
		for (const anim of el.getAnimations({subtree})) {
			if (anim.id === animationId) {
				anim.cancel();
			}
		}
	}
}

/**
 * Cancels the marker's running animations, putting it where it is and at its inline opacity right away.
 * @param {Layer} layer
 */
export function stopAnimations(layer) {
	if (layer instanceof L.Marker) {
		cancelAnimations(markerElements(layer));
	}
}

/**
 * Draws a spider leg out from the cluster, or back in, by animating its stroke dash offset (see
 * https://jakearchibald.com/2013/animated-line-drawing-svg/). Drawing it back in also sets its opacity to 0, so
 * that it stays hidden until it's removed. With reduced motion it only fades, and with Canvas it doesn't animate.
 * @param {Polyline} leg
 * @param {boolean} reveal
 * @param {number} duration
 * @param {boolean} [withZoom] Draw with the timing of the map zoom animation that's starting.
 */
function animateLeg(leg, reveal, duration, withZoom = false) {
	const opacity = /** @type {number} */ (leg.options.opacity);
	if (!reveal) {
		leg.setStyle({opacity: 0});
	}
	const path = svgPath(leg);
	if (!path) {
		return;
	}
	if (!reducedMotion()) {
		const length = `${path.getTotalLength() + 0.1}`; // a bit longer to avoid a remaining dot in Firefox
		const hidden = {strokeDasharray: length, strokeDashoffset: length},
			shown = {strokeDasharray: length, strokeDashoffset: '0'};
		path.animate(reveal ? [hidden, shown] : [shown, hidden], withZoom ?
			{duration: zoomDuration, easing: zoomEasing, id: animationId} :
			{duration, easing: 'ease-out', id: animationId});
	}
	path.animate([{strokeOpacity: reveal ? 0 : opacity, offset: 0}], {duration, easing: 'ease-in', id: animationId});
}

/**
 * The marker's offset in pixels from the given layer point.
 * @param {LeafletMap} map
 * @param {Point} point
 * @param {ClusterChild<any>} marker
 */
function offsetFrom(map, point, marker) {
	return point.subtract(map.latLngToLayerPoint(marker.getLatLng()).round());
}

/**
 * A cluster of markers in a `MarkerClusterGroup`, shown as a marker whose icon comes from the group's
 * `iconCreateFunction`. Clusters are created by the group, and are the `layer` of its `cluster*` events.
 * @template {Layer} [M=Marker] The group's member layers.
 */
export class MarkerCluster extends L.Marker {

	/**
	 * @param {MarkerClusterGroup<M>} group
	 * @param {number} zoom
	 * @param {ClusterChild<M> | MarkerCluster<M>} [a]
	 * @param {ClusterChild<M> | MarkerCluster<M>} [b]
	 */
	constructor(group, zoom, a, b) {
		// at its first child until the bounds are calculated
		super(a ? a.getLatLng() : new L.LatLng(0, 0), {pane: group.options.clusterPane});
		/** Its point in the group's distance grids, that of its first marker. @type {Point | undefined} */
		this._gridPoint = undefined;
		// the cluster is its own icon, see createIcon
		this.options.icon = /** @type {Icon} */ (/** @type {unknown} */ (this));

		this._group = group;
		this._zoom = zoom;

		/** @type {ClusterChild<M>[]} */
		this._markers = [];
		/** @type {MarkerCluster<M>[]} */
		this._childClusters = [];
		this._childCount = 0;
		this._iconNeedsUpdate = true;
		this._boundsNeedUpdate = true;
		/** Spiderfied and fading out in a live map zoom (see _fadeUnspiderfy). */
		this._fading = false;

		this._bounds = new L.LatLngBounds();
		/** @type {MarkerCluster<M> | undefined} */
		this._parent = undefined;
		/** @type {Icon | undefined} */
		this._iconObj = undefined;

		if (a) {
			this._addChild(a);
		}
		if (b) {
			this._addChild(b);
		}
	}

	/**
	 * All markers in this cluster and its child clusters, appended to `storageArray` if given.
	 * @param {M[] | null} [storageArray]
	 * @param {boolean} [ignoreDraggedMarker] Leave out markers being dragged.
	 * @returns {M[]}
	 */
	getAllChildMarkers(storageArray, ignoreDraggedMarker) {
		return this._getChildren(/** @type {ClusterChild<M>[]} */ (storageArray || []), ignoreDraggedMarker);
	}

	/**
	 * @param {ClusterChild<M>[]} storageArray
	 * @param {boolean} [ignoreDraggedMarker]
	 * @returns {ClusterChild<M>[]}
	 */
	_getChildren(storageArray = [], ignoreDraggedMarker = false) {
		for (let i = this._childClusters.length - 1; i >= 0; i--) {
			this._childClusters[i]._getChildren(storageArray, ignoreDraggedMarker);
		}

		const dragging = this._group._dragging;
		for (let j = this._markers.length - 1; j >= 0; j--) {
			if (ignoreDraggedMarker && dragging.has(this._markers[j])) {
				continue;
			}
			storageArray.push(this._markers[j]);
		}

		return storageArray;
	}

	/** The number of markers in this cluster and its child clusters. */
	getChildCount() {
		return this._childCount;
	}

	/**
	 * Zooms in to the lowest zoom that splits the cluster, or that shows all of its bounds.
	 * @param {FitBoundsOptions} [fitBoundsOptions]
	 */
	zoomToBounds(fitBoundsOptions) {
		let childClusters = this._childClusters.slice(),
			zoom = this._zoom + 1;
		const map = this._group._map,
			boundsZoom = map.getBoundsZoom(this._bounds),
			mapZoom = map.getZoom();

		//calculate how far we need to zoom down to see all of the markers
		while (childClusters.length > 0 && boundsZoom > zoom) {
			zoom++;
			childClusters = childClusters.flatMap(c => c._childClusters);
		}

		if (boundsZoom > zoom) {
			map.setView(this.getLatLng(), zoom);
		} else if (boundsZoom <= mapZoom) { //If fitBounds wouldn't zoom us down, zoom us down instead
			map.setView(this.getLatLng(), mapZoom + 1);
		} else {
			map.fitBounds(this._bounds, fitBoundsOptions);
		}
	}

	/** The bounds of all markers in the cluster. */
	getBounds() {
		const bounds = new L.LatLngBounds();
		bounds.extend(this._bounds);
		return bounds;
	}

	/** The convex hull of the cluster's markers, as shown on hover with `showCoverageOnHover`. */
	getConvexHull() {
		return QuickHull.getConvexHull(this._getChildren().map(m => m.getLatLng()));
	}

	_updateIcon() {
		this._iconNeedsUpdate = true;
		if (this.getElement()) {
			this.setIcon(this.options.icon);
		}
	}

	// the Icon interface: the cluster pretends to be its own icon, so that it's only created when shown
	createIcon() {
		if (this._iconNeedsUpdate || !this._iconObj) {
			this._iconObj = this._group.options.iconCreateFunction(this);
			this._iconNeedsUpdate = false;
		}
		return this._iconObj.createIcon();
	}
	createShadow() {
		return /** @type {Icon} */ (this._iconObj).createShadow();
	}

	_initIcon() {
		super._initIcon();
		const group = this._group,
			icon = /** @type {HTMLElement} */ (this._icon);

		// an icon's content alone would name the button with just the count
		icon.setAttribute('aria-label', group.options.clusterLabel(this));
		if (group._spiderfiesOnClick(this)) {
			icon.setAttribute('aria-expanded', `${group._spiderfied === this}`);
		} else {
			icon.removeAttribute('aria-expanded');
		}
		if (group.options.showCoverageOnHover) {
			L.DomEvent.on(icon, {focus: this._showCoverage, blur: this._hideCoverage}, this);
		}
	}

	_removeIcon() {
		// removing it while focused, e.g. when a zoom splits it, would send focus back to the start of the page
		if (this._icon?.contains(document.activeElement)) {
			this._map?.getContainer().focus({preventScroll: true});
		}
		super._removeIcon();
	}

	_showCoverage() {
		this._group._showCoverage({layer: this});
	}

	_hideCoverage() {
		this._group._hideCoverage();
	}

	/**
	 * Updates aria-expanded, and when collapsing, moves focus to the cluster from a spiderfied marker that's about
	 * to go.
	 * @param {boolean} expanded
	 */
	_setExpanded(expanded) {
		const icon = this._icon;
		if (!icon) {
			return;
		}
		icon.setAttribute('aria-expanded', `${expanded}`);
		const active = document.activeElement;
		if (!expanded && active && this._getChildren().some(m => m.getElement?.()?.contains(active))) {
			icon.focus({preventScroll: true});
		}
	}


	/** @param {ClusterChild<M> | MarkerCluster<M>} child */
	_addChild(child) {
		let count = 1;
		if (child instanceof MarkerCluster) {
			this._childClusters.push(child);
			child._parent = this;
			count = child._childCount;
		} else {
			this._markers.push(child);
		}

		/** @type {MarkerCluster<M> | undefined} */
		let cluster = this;
		while (cluster) {
			cluster._childCount += count;
			cluster._iconNeedsUpdate = true;
			cluster._boundsNeedUpdate = true;
			cluster = cluster._parent;
		}
	}

	_recalculateBounds() {
		const markers = this._markers,
			childClusters = this._childClusters,
			totalCount = this._childCount;
		let latSum = 0,
			lngSum = 0;

		this._bounds = new L.LatLngBounds();

		// Case where all markers are removed from the map and we are left with just an empty _topClusterLevel.
		if (totalCount === 0) {
			return;
		}

		// Child markers.
		for (let i = 0; i < markers.length; i++) {
			const childLatLng = markers[i].getLatLng();

			this._bounds.extend(childLatLng);

			latSum += childLatLng.lat;
			lngSum += childLatLng.lng;
		}

		// Child clusters.
		for (let i = 0; i < childClusters.length; i++) {
			const child = childClusters[i];

			// Re-compute child bounds and weighted position first if necessary.
			if (child._boundsNeedUpdate) {
				child._recalculateBounds();
			}

			this._bounds.extend(child._bounds);

			const childLatLng = child._wLatLng;
			const childCount = child._childCount;

			latSum += childLatLng.lat * childCount;
			lngSum += childLatLng.lng * childCount;
		}

		// the weighted center, set directly since setLatLng would fire move and redraw on every recalculation
		/** @type {LatLng} */
		this._wLatLng = new L.LatLng(latSum / totalCount, lngSum / totalCount);
		this._latlng = this._wLatLng;

		// Reset dirty flag.
		this._boundsNeedUpdate = false;
	}

	_addToMap() {
		this._group._featureGroup.addLayer(this);
	}

	/**
	 * Moves the markers and clusters below us into center and fades them out.
	 * @param {LatLngBounds} bounds
	 * @param {Point} center
	 * @param {number} maxZoom
	 */
	_recursivelyAnimateChildrenIn(bounds, center, maxZoom) {
		const map = this._group._map;
		/** @param {ClusterChild<M> | MarkerCluster<M>} m */
		const animateIn = (m) => {
			//Only do it if the icon is still on the map
			if (m instanceof L.Marker && m.getElement()) {
				const opacity = m.options.opacity;
				m.clusterHide();
				animateMarker(m, null, offsetFrom(map, center, m), opacity, this._group.options.animationDuration);
			}
		};
		this._recursively(bounds, this._group._minZoom, maxZoom - 1,
			(c) => {
				for (let i = c._markers.length - 1; i >= 0; i--) {
					animateIn(c._markers[i]);
				}
			},
			(c) => {
				for (let j = c._childClusters.length - 1; j >= 0; j--) {
					animateIn(c._childClusters[j]);
				}
			}
		);
	}

	/**
	 * @param {LatLngBounds} bounds
	 * @param {LatLngBounds} previousBounds
	 * @param {number} mapMinZoom
	 * @param {number} previousZoomLevel
	 * @param {number} newZoomLevel
	 */
	_recursivelyAnimateChildrenInAndAddSelfToMap(bounds, previousBounds, mapMinZoom, previousZoomLevel, newZoomLevel) {
		this._recursively(bounds, newZoomLevel, mapMinZoom,
			(c) => {
				c._recursivelyAnimateChildrenIn(bounds, c._group._map.latLngToLayerPoint(c.getLatLng()).round(), previousZoomLevel);

				c._addToMap();

				//TODO: depthToAnimateIn affects _isSingleParent, if there is a multizoom we may/may not be.
				//As a hack we only do a animation free zoom on a single level zoom, if someone does multiple levels then we always animate
				if (c._isSingleParent() && previousZoomLevel - 1 === newZoomLevel) {
					c._recursivelyRemoveChildrenFromMap(previousBounds, mapMinZoom, previousZoomLevel); //Immediately remove our children as we are replacing them
				} else {
					animateMarker(c, null, null, 0, c._group.options.animationDuration);
				}
			}
		);
	}

	/**
	 * Adds the markers and clusters below us down to zoomLevel to the map. With startPos, they move out of it and the
	 * markers fade in.
	 * @param {LatLng | null} startPos
	 * @param {number} zoomLevel
	 * @param {LatLngBounds} bounds
	 */
	_recursivelyAddChildrenToMap(startPos, zoomLevel, bounds) {
		const group = this._group,
			startPoint = startPos && group._map.latLngToLayerPoint(startPos).round();

		this._recursively(bounds, group._minZoom - 1, zoomLevel,
			(c) => {
				if (zoomLevel === c._zoom) {
					return;
				}

				for (let i = c._markers.length - 1; i >= 0; i--) {
					const nm = c._markers[i];

					if (!bounds.contains(nm.getLatLng())) {
						continue;
					}

					group._featureGroup.addLayer(nm);

					if (startPoint && nm instanceof L.Marker) {
						animateMarker(nm, offsetFrom(group._map, startPoint, nm), null, 0, group.options.animationDuration);
					}
				}
			},
			(c) => {
				c._addToMap();
				if (startPoint) {
					animateMarker(c, offsetFrom(group._map, startPoint, c), null, undefined, group.options.animationDuration);
				}
			}
		);
	}

	/**
	 * @param {LatLngBounds} previousBounds
	 * @param {number} mapMinZoom
	 * @param {number} zoomLevel
	 * @param {LatLngBounds} [exceptBounds] If set, don't remove any markers/clusters in it.
	 */
	_recursivelyRemoveChildrenFromMap(previousBounds, mapMinZoom, zoomLevel, exceptBounds) {
		this._recursively(previousBounds, mapMinZoom - 1, zoomLevel - 1,
			(c) => {
				//Remove markers at every level
				for (let i = c._markers.length - 1; i >= 0; i--) {
					const m = c._markers[i];
					if (!exceptBounds || !exceptBounds.contains(m.getLatLng())) {
						c._group._featureGroup.removeLayer(m);
						if (m.clusterShow) {
							m.clusterShow();
						}
					}
				}
			},
			(c) => {
				//Remove child clusters at just the bottom level
				for (let i = c._childClusters.length - 1; i >= 0; i--) {
					const m = c._childClusters[i];
					if (!exceptBounds || !exceptBounds.contains(m.getLatLng())) {
						c._group._featureGroup.removeLayer(m);
						if (m.clusterShow) {
							m.clusterShow();
						}
					}
				}
			}
		);
	}

	/**
	 * Runs the given functions recursively on this and child clusters.
	 * @param {LatLngBounds} boundsToApplyTo The bounds of the clusters to recurse into.
	 * @param {number} zoomLevelToStart Zoom level to start running functions at (inclusive).
	 * @param {number} zoomLevelToStop Zoom level to stop running functions at (inclusive).
	 * @param {((c: MarkerCluster<M>) => void) | null} [runAtEveryLevel] Applied at every level.
	 * @param {(c: MarkerCluster<M>) => void} [runAtBottomLevel] Applied at only the bottom level.
	 */
	_recursively(boundsToApplyTo, zoomLevelToStart, zoomLevelToStop, runAtEveryLevel, runAtBottomLevel) {
		const childClusters = this._childClusters,
			zoom = this._zoom;

		if (zoomLevelToStart <= zoom) {
			if (runAtEveryLevel) {
				runAtEveryLevel(this);
			}
			if (runAtBottomLevel && zoom === zoomLevelToStop) {
				runAtBottomLevel(this);
			}
		}

		if (zoom < zoomLevelToStart || zoom < zoomLevelToStop) {
			for (let i = childClusters.length - 1; i >= 0; i--) {
				const c = childClusters[i];
				if (c._boundsNeedUpdate) {
					c._recalculateBounds();
				}
				if (boundsToApplyTo.intersects(c._bounds)) {
					c._recursively(boundsToApplyTo, zoomLevelToStart, zoomLevelToStop, runAtEveryLevel, runAtBottomLevel);
				}
			}
		}
	}

	//Returns true if we are the parent of only one cluster and that cluster is the same as us
	_isSingleParent() {
		//Don't need to check this._markers as the rest won't work if there are any
		return this._childClusters.length > 0 && this._childClusters[0]._childCount === this._childCount;
	}

	// Spiderfier, 100% based on https://github.com/jawj/OverlappingMarkerSpiderfier-Leaflet
	// Huge thanks to jawj for implementing it first to make my job easy :-)

	/** Spreads out the cluster's markers around it, with legs to its center. */
	spiderfy() {
		const group = this._group;
		if (group._spiderfied === this || group._inZoomAnimation) {
			return;
		}

		const childMarkers = this._getChildren([], true),
			center = group._map.latLngToLayerPoint(this.getLatLng()),
			shape = /** @type {MarkerCluster<M> & SpiderfyShape} */ (/** @type {unknown} */ (this));
		let positions;

		group._unspiderfy();
		group._spiderfied = this;
		this._setExpanded(true);

		//TODO Maybe: childMarkers order by distance to center

		if (group.options.spiderfyShapePositions) {
			positions = group.options.spiderfyShapePositions(childMarkers.length, center);
		} else if (childMarkers.length >= shape._circleSpiralSwitchover) {
			positions = shape._generatePointsSpiral(childMarkers.length, center);
		} else {
			center.y += 10; // Otherwise circles look wrong => hack for standard blue icon, renders differently for other icons.
			positions = shape._generatePointsCircle(childMarkers.length, center);
		}

		this._animationSpiderfy(childMarkers, positions);

		// right after the cluster in the tab order, like the content of a disclosure button, instead of last in the pane
		const icon = this._icon;
		if (icon) {
			const elements = childMarkers.map(m => /** @type {HTMLElement} */ (m.getElement?.()));
			icon.after(...elements.filter(el => el?.parentNode === icon.parentNode));
		}
	}

	/** Brings the markers of a spiderfied cluster back in. */
	unspiderfy() {
		this._unspiderfy();
	}

	/** @param {boolean} [withZoom] Called when a map zoom animation starts. */
	_unspiderfy(withZoom = false) {
		if (this._fading) {
			this._noanimationUnspiderfy();
			return;
		}
		if (this._group._inZoomAnimation) {
			return;
		}
		this._setExpanded(false);
		this._animationUnspiderfy(withZoom);

		this._group._spiderfied = null;
	}

	/**
	 * @this {MarkerCluster<M> & SpiderfyShape}
	 * @param {number} count
	 * @param {Point} centerPt
	 */
	_generatePointsCircle(count, centerPt) {
		const circumference = this._group.options.spiderfyDistanceMultiplier * this._circleFootSeparation * (2 + count),
			angleStep = this._2PI / count,
			/** @type {Point[]} */
			res = [];
		let legLength = circumference / this._2PI;  //radius from circumference

		legLength = Math.max(legLength, 35); // Minimum distance to get outside the cluster icon.

		res.length = count;

		for (let i = 0; i < count; i++) { // Clockwise, like spiral.
			const angle = this._circleStartAngle + i * angleStep;
			res[i] = new L.Point(centerPt.x + legLength * Math.cos(angle), centerPt.y + legLength * Math.sin(angle)).round();
		}

		return res;
	}

	/**
	 * @this {MarkerCluster<M> & SpiderfyShape}
	 * @param {number} count
	 * @param {Point} centerPt
	 */
	_generatePointsSpiral(count, centerPt) {
		const spiderfyDistanceMultiplier = this._group.options.spiderfyDistanceMultiplier,
			separation = spiderfyDistanceMultiplier * this._spiralFootSeparation,
			lengthFactor = spiderfyDistanceMultiplier * this._spiralLengthFactor * this._2PI,
			/** @type {Point[]} */
			res = [];
		let legLength = spiderfyDistanceMultiplier * this._spiralLengthStart,
			angle = 0;

		res.length = count;

		// Higher index, closer position to cluster center.
		for (let i = count; i >= 0; i--) {
			// Skip the first position, so that we are already farther from center and we avoid
			// being under the default cluster icon (especially important for Circle Markers).
			if (i < count) {
				res[i] = new L.Point(centerPt.x + legLength * Math.cos(angle), centerPt.y + legLength * Math.sin(angle)).round();
			}
			angle += separation / legLength + i * 0.0005;
			legLength += lengthFactor / angle;
		}
		return res;
	}

	/**
	 * Fades the spider out in place for a live map zoom. It stays spiderfied, and layers other than markers stay
	 * visible, until _noanimationUnspiderfy removes it; unspiderfying before that does so right away.
	 */
	_fadeUnspiderfy() {
		const group = this._group,
			duration = group.options.animationDuration;

		this._fading = true;
		this.setOpacity(1);
		animateMarker(this, null, null, 0.3, duration);

		for (const m of this._getChildren([], true)) {
			const spider = group._spiders.get(m);
			if (!spider) {
				continue;
			}
			m.closePopup();
			if (m instanceof L.Marker) {
				const opacity = m.options.opacity;
				m.clusterHide();
				animateMarker(m, null, null, opacity, duration);
			}
			animateLeg(spider.leg, false, duration);
		}
	}

	_noanimationUnspiderfy() {
		const group = this._group,
			map = group._map,
			fg = group._featureGroup,
			spiders = group._spiders,
			childMarkers = this._getChildren([], true);

		this._setExpanded(false);
		this._fading = false;
		group._ignoreMove = true;

		this.setOpacity(1);
		for (let i = childMarkers.length - 1; i >= 0; i--) {
			const m = childMarkers[i],
				spider = spiders.get(m);

			if (spider) {
				// without a fade that may still be running, while it has an element
				stopAnimations(m);
				m.clusterShow?.();
			}
			fg.removeLayer(m);

			if (!spider) {
				continue;
			}
			spiders.delete(m);
			if (spider.latlng) {
				m.setLatLng(spider.latlng);
			}
			if (m.setZIndexOffset) {
				m.setZIndexOffset(0);
			}
			map.removeLayer(spider.leg);
		}

		group.fire('unspiderfied', {
			cluster: this,
			markers: childMarkers
		});
		group._ignoreMove = false;
		group._spiderfied = null;
	}

	/**
	 * @param {ClusterChild<M>[]} childMarkers
	 * @param {Point[]} positions
	 */
	_animationSpiderfy(childMarkers, positions) {
		const group = this._group,
			map = group._map,
			fg = group._featureGroup,
			thisLayerLatLng = this.getLatLng(),
			thisLayerPos = map.latLngToLayerPoint(thisLayerLatLng).round(),
			duration = group.options.animationDuration,
			legOptions = {...group.options.spiderLegPolylineOptions};

		// Make sure we have a defined opacity.
		legOptions.opacity ??= defaultLegOpacity;

		group._ignoreMove = true;
		group._animationStart();

		// Add markers and spider legs to map, moving out of our center point.
		// Traverse in ascending order to make sure that inner circleMarkers are on top of further legs. Normal markers are re-ordered by newPosition.
		for (let i = 0; i < childMarkers.length; i++) {
			const m = childMarkers[i];

			const newPos = map.layerPointToLatLng(positions[i]);

			// Add the leg before the marker, so that in case the latter is a circleMarker, the leg is behind it.
			const leg = new L.Polyline([thisLayerLatLng, newPos], legOptions);
			map.addLayer(leg);
			group._spiders.set(m, {leg, latlng: m.getLatLng()});
			animateLeg(leg, true, duration);

			if (m.setZIndexOffset) {
				m.setZIndexOffset(1000000); // Make normal markers appear on top of EVERYTHING
			}

			m.setLatLng(newPos);

			// Vectors just get immediately added
			fg.addLayer(m);

			if (m instanceof L.Marker) {
				animateMarker(m, offsetFrom(map, thisLayerPos, m), null, 0, duration);
			}
		}
		this.setOpacity(0.3);
		animateMarker(this, null, null, 1, duration);

		group._ignoreMove = false;

		setTimeout(() => {
			group._animationEnd();
			group.fire('spiderfied', {
				cluster: this,
				markers: childMarkers
			});
		}, duration);
	}

	/**
	 * With withZoom, it runs right after a zoom animation starts, when the map is already at the new zoom: setLatLng puts
	 * a marker at its new position, and it moves there from where it was with the zoom transition, so our animation
	 * moves it on from there to the cluster, with the same timing to keep it on a straight line.
	 * @param {boolean} withZoom
	 */
	_animationUnspiderfy(withZoom) {
		const group = this._group,
			map = group._map,
			fg = group._featureGroup,
			spiders = group._spiders,
			// with a zoom, finish before it ends and the group reclusters
			duration = withZoom ? zoomDuration - 50 : group.options.animationDuration,
			childMarkers = this._getChildren([], true);

		/** @param {LatLng} latlng */
		const layerPoint = latlng => map.latLngToLayerPoint(latlng).round();
		const thisLayerPos = layerPoint(this.getLatLng());

		group._ignoreMove = true;
		group._animationStart();

		//Make us visible and bring the child markers back in
		this.setOpacity(1);
		animateMarker(this, null, null, 0.3, duration);

		for (let i = childMarkers.length - 1; i >= 0; i--) {
			const m = childMarkers[i],
				spider = spiders.get(m),
				latlng = spider?.latlng;

			//Marker was added to us after we were spiderfied
			if (!spider || !latlng) {
				continue;
			}

			//Close any popup on the marker first, otherwise setting the location of the marker will make the map scroll
			m.closePopup();

			const pos = layerPoint(latlng),
				spiderPos = withZoom ? pos : layerPoint(m.getLatLng());

			//Fix up the location to the real one
			m.setLatLng(latlng);
			spider.latlng = null;

			if (m instanceof L.Marker) {
				const opacity = m.options.opacity;
				m.clusterHide();
				animateMarker(m, spiderPos.subtract(pos), thisLayerPos.subtract(pos), opacity, duration, withZoom);
			} else {
				fg.removeLayer(m);
			}

			animateLeg(spider.leg, false, duration, withZoom);
		}

		group._ignoreMove = false;

		setTimeout(() => {
			//If we have only <= one child left then that marker will be shown on the map so don't remove it!
			let stillThereChildCount = 0;
			for (let i = childMarkers.length - 1; i >= 0; i--) {
				if (spiders.has(childMarkers[i])) {
					stillThereChildCount++;
				}
			}


			for (let i = childMarkers.length - 1; i >= 0; i--) {
				const m = childMarkers[i],
					spider = spiders.get(m);

				if (!spider) { //Has already been unspiderfied
					continue;
				}

				if (m.clusterShow) {
					m.clusterShow();
				}
				stopAnimations(m);
				if (m.setZIndexOffset) {
					m.setZIndexOffset(0);
				}

				if (stillThereChildCount > 1) {
					fg.removeLayer(m);
				}

				map.removeLayer(spider.leg);
				spiders.delete(m);
			}
			group._animationEnd();
			group.fire('unspiderfied', {
				cluster: this,
				markers: childMarkers
			});
		}, duration);
	}
}

// 1.x keeps defaults on the prototype, and without a copy of its own, mergeOptions would change every L.Marker
if (isV1) {
	MarkerCluster.prototype.options = Object.create(L.Marker.prototype.options);
}
// the cluster is its own icon (see createIcon), so Marker reads icon options like popupAnchor from it
MarkerCluster.mergeOptions(L.Icon.defaultOptions ?? L.Icon.prototype.options);

Object.assign(MarkerCluster.prototype, {
	_2PI: Math.PI * 2,
	_circleFootSeparation: 25, //related to circumference of circle
	_circleStartAngle: 0,

	_spiralFootSeparation: 28, //related to size of spiral (experiment!)
	_spiralLengthStart: 11,
	_spiralLengthFactor: 5,

	_circleSpiralSwitchover: 9 //show spiral instead of circle from this marker count upwards.
	// 0 -> always spiral; Infinity -> always circle
});

/**
 * Non-animated versions of everything, for groups with `animate: false`.
 * @template {Layer} [M=Marker]
 * @extends {MarkerCluster<M>}
 */
export class MarkerClusterNonAnimated extends MarkerCluster {
	/**
	 * @param {ClusterChild<M>[]} childMarkers
	 * @param {Point[]} positions
	 */
	_animationSpiderfy(childMarkers, positions) {
		const group = this._group,
			map = group._map,
			fg = group._featureGroup,
			legOptions = this._group.options.spiderLegPolylineOptions;

		group._ignoreMove = true;

		// Traverse in ascending order to make sure that inner circleMarkers are on top of further legs. Normal markers are re-ordered by newPosition.
		// The reverse order trick no longer improves performance on modern browsers.
		for (let i = 0; i < childMarkers.length; i++) {
			const newPos = map.layerPointToLatLng(positions[i]);
			const m = childMarkers[i];

			// Add the leg before the marker, so that in case the latter is a circleMarker, the leg is behind it.
			const leg = new L.Polyline([this.getLatLng(), newPos], legOptions);
			map.addLayer(leg);
			group._spiders.set(m, {leg, latlng: m.getLatLng()});

			// Now add the marker.
			m.setLatLng(newPos);
			if (m.setZIndexOffset) {
				m.setZIndexOffset(1000000); //Make these appear on top of EVERYTHING
			}

			fg.addLayer(m);
		}
		this.setOpacity(0.3);

		group._ignoreMove = false;
		group.fire('spiderfied', {
			cluster: this,
			markers: childMarkers
		});
	}

	_animationUnspiderfy() {
		this._noanimationUnspiderfy();
	}

	_fadeUnspiderfy() {
		this._noanimationUnspiderfy();
	}
}
