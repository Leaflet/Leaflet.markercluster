import * as L from 'leaflet';
import {QuickHull} from './QuickHull.js';

const isV1 = L.version.startsWith('1.');

// the spiderLegPolylineOptions default
const defaultLegOpacity = 0.5;

// where the map's latLngToLayerPoint will put latlng once a zoom animation to zoom and center ends
export function latLngToNewLayerPoint(map, latlng, zoom, center) {
	const pixelOrigin = map.project(center, zoom)
		.subtract(map.getSize().divideBy(2))
		.subtract(map.containerPointToLayerPoint(new L.Point(0, 0)))
		.round();
	return map.project(latlng, zoom).subtract(pixelOrigin);
}

// the leg's path element for the line drawing animation, or null with the Canvas renderer
function svgPath(leg) {
	const el = leg.getElement();
	return el instanceof SVGElement ? el : null;
}

export class MarkerCluster extends L.Marker {

	constructor(group, zoom, a, b) {
		super(a ? (a._cLatLng || a.getLatLng()) : new L.LatLng(0, 0), {pane: group.options.clusterPane});
		this.options.icon = this;

		this._group = group;
		this._zoom = zoom;

		this._markers = [];
		this._childClusters = [];
		this._childCount = 0;
		this._iconNeedsUpdate = true;
		this._boundsNeedUpdate = true;

		this._bounds = new L.LatLngBounds();

		if (a) {
			this._addChild(a);
		}
		if (b) {
			this._addChild(b);
		}
	}

	//Recursively retrieve all child markers of this cluster
	getAllChildMarkers(storageArray, ignoreDraggedMarker) {
		storageArray = storageArray || [];

		for (let i = this._childClusters.length - 1; i >= 0; i--) {
			this._childClusters[i].getAllChildMarkers(storageArray, ignoreDraggedMarker);
		}

		for (let j = this._markers.length - 1; j >= 0; j--) {
			if (ignoreDraggedMarker && this._markers[j].__dragStart) {
				continue;
			}
			storageArray.push(this._markers[j]);
		}

		return storageArray;
	}

	//Returns the count of how many child markers we have
	getChildCount() {
		return this._childCount;
	}

	//Zoom to the minimum of showing all of the child markers, or the extents of this cluster
	zoomToBounds(fitBoundsOptions) {
		let childClusters = this._childClusters.slice(),
			zoom = this._zoom + 1;
		const map = this._group._map,
			boundsZoom = map.getBoundsZoom(this._bounds),
			mapZoom = map.getZoom();

		//calculate how far we need to zoom down to see all of the markers
		while (childClusters.length > 0 && boundsZoom > zoom) {
			zoom++;
			let newClusters = [];
			for (let i = 0; i < childClusters.length; i++) {
				newClusters = newClusters.concat(childClusters[i]._childClusters);
			}
			childClusters = newClusters;
		}

		if (boundsZoom > zoom) {
			this._group._map.setView(this.getLatLng(), zoom);
		} else if (boundsZoom <= mapZoom) { //If fitBounds wouldn't zoom us down, zoom us down instead
			this._group._map.setView(this.getLatLng(), mapZoom + 1);
		} else {
			this._group._map.fitBounds(this._bounds, fitBoundsOptions);
		}
	}

	getBounds() {
		const bounds = new L.LatLngBounds();
		bounds.extend(this._bounds);
		return bounds;
	}

	getConvexHull() {
		const childMarkers = this.getAllChildMarkers(),
			points = [];

		for (let i = childMarkers.length - 1; i >= 0; i--) {
			points.push(childMarkers[i].getLatLng());
		}

		return QuickHull.getConvexHull(points);
	}

	_updateIcon() {
		this._iconNeedsUpdate = true;
		if (this.getElement()) {
			this.setIcon(this);
		}
	}

	//Cludge for Icon, we pretend to be an icon for performance
	createIcon() {
		if (this._iconNeedsUpdate) {
			this._iconObj = this._group.options.iconCreateFunction(this);
			this._iconNeedsUpdate = false;
		}
		return this._iconObj.createIcon();
	}
	createShadow() {
		return this._iconObj.createShadow();
	}


	_addChild(new1, isNotificationFromChild) {

		this._iconNeedsUpdate = true;

		this._boundsNeedUpdate = true;
		this._setClusterCenter(new1);

		if (new1 instanceof MarkerCluster) {
			if (!isNotificationFromChild) {
				this._childClusters.push(new1);
				new1.__parent = this;
			}
			this._childCount += new1._childCount;
		} else {
			if (!isNotificationFromChild) {
				this._markers.push(new1);
			}
			this._childCount++;
		}

		if (this.__parent) {
			this.__parent._addChild(new1, true);
		}
	}

	/**
	 * Makes sure the cluster center is set. If not, uses the child center if it is a cluster, or the marker position.
	 * @param child L.MarkerCluster|L.Marker that will be used as cluster center if not defined yet.
	 * @private
	 */
	_setClusterCenter(child) {
		if (!this._cLatLng) {
			// when clustering, take position of the first point as the cluster center
			this._cLatLng = child._cLatLng || child.getLatLng();
		}
	}

	_recalculateBounds() {
		const markers = this._markers,
			childClusters = this._childClusters,
			totalCount = this._childCount;
		let latSum = 0,
			lngSum = 0;

		// Case where all markers are removed from the map and we are left with just an empty _topClusterLevel.
		if (totalCount === 0) {
			return;
		}

		this._bounds = new L.LatLngBounds();

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

		this._latlng = this._wLatLng = new L.LatLng(latSum / totalCount, lngSum / totalCount);

		// Reset dirty flag.
		this._boundsNeedUpdate = false;
	}

	//Set our markers position as given and add it to the map
	_addToMap(startPos) {
		if (startPos) {
			this._backupLatlng = this.getLatLng();
			this.setLatLng(startPos);
		}
		this._group._featureGroup.addLayer(this);
	}

	_recursivelyAnimateChildrenIn(bounds, center, maxZoom) {
		this._recursively(bounds, this._group._map.getMinZoom(), maxZoom - 1,
			(c) => {
				const markers = c._markers;
				for (let i = markers.length - 1; i >= 0; i--) {
					const m = markers[i];

					//Only do it if the icon is still on the map
					if (m instanceof L.Marker && m.getElement()) {
						m._setPos(center);
						m.clusterHide();
					}
				}
			},
			(c) => {
				const childClusters = c._childClusters;
				for (let j = childClusters.length - 1; j >= 0; j--) {
					const cm = childClusters[j];
					if (cm.getElement()) {
						cm._setPos(center);
						cm.clusterHide();
					}
				}
			}
		);
	}

	_recursivelyAnimateChildrenInAndAddSelfToMap(bounds, previousBounds, mapMinZoom, previousZoomLevel, newZoomLevel) {
		this._recursively(bounds, newZoomLevel, mapMinZoom,
			(c) => {
				c._recursivelyAnimateChildrenIn(bounds, c._group._map.latLngToLayerPoint(c.getLatLng()).round(), previousZoomLevel);

				//TODO: depthToAnimateIn affects _isSingleParent, if there is a multizoom we may/may not be.
				//As a hack we only do a animation free zoom on a single level zoom, if someone does multiple levels then we always animate
				if (c._isSingleParent() && previousZoomLevel - 1 === newZoomLevel) {
					c.clusterShow();
					c._recursivelyRemoveChildrenFromMap(previousBounds, mapMinZoom, previousZoomLevel); //Immediately remove our children as we are replacing them
				} else {
					c.clusterHide();
				}

				c._addToMap();
			}
		);
	}

	_recursivelyBecomeVisible(bounds, zoomLevel) {
		this._recursively(bounds, this._group._map.getMinZoom(), zoomLevel, null, (c) => {
			c.clusterShow();
		});
	}

	_recursivelyAddChildrenToMap(startPos, zoomLevel, bounds) {
		this._recursively(bounds, this._group._map.getMinZoom() - 1, zoomLevel,
			(c) => {
				if (zoomLevel === c._zoom) {
					return;
				}

				//Add our child markers at startPos (so they can be animated out)
				for (let i = c._markers.length - 1; i >= 0; i--) {
					const nm = c._markers[i];

					if (!bounds.contains(nm.getLatLng())) {
						continue;
					}

					if (startPos) {
						nm._backupLatlng = nm.getLatLng();

						nm.setLatLng(startPos);
						if (nm.clusterHide) {
							nm.clusterHide();
						}
					}

					c._group._featureGroup.addLayer(nm);
				}
			},
			(c) => {
				c._addToMap(startPos);
			}
		);
	}

	_recursivelyRestoreChildPositions(zoomLevel) {
		//Fix positions of child markers
		for (let i = this._markers.length - 1; i >= 0; i--) {
			const nm = this._markers[i];
			if (nm._backupLatlng) {
				nm.setLatLng(nm._backupLatlng);
				delete nm._backupLatlng;
			}
		}

		if (zoomLevel - 1 === this._zoom) {
			//Reposition child clusters
			for (let j = this._childClusters.length - 1; j >= 0; j--) {
				this._childClusters[j]._restorePosition();
			}
		} else {
			for (let k = this._childClusters.length - 1; k >= 0; k--) {
				this._childClusters[k]._recursivelyRestoreChildPositions(zoomLevel);
			}
		}
	}

	_restorePosition() {
		if (this._backupLatlng) {
			this.setLatLng(this._backupLatlng);
			delete this._backupLatlng;
		}
	}

	//exceptBounds: If set, don't remove any markers/clusters in it
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

	//Run the given functions recursively to this and child clusters
	// boundsToApplyTo: a L.LatLngBounds representing the bounds of what clusters to recurse in to
	// zoomLevelToStart: zoom level to start running functions (inclusive)
	// zoomLevelToStop: zoom level to stop running functions (inclusive)
	// runAtEveryLevel: function that takes an L.MarkerCluster as an argument that should be applied on every level
	// runAtBottomLevel: function that takes an L.MarkerCluster as an argument that should be applied at only the bottom level
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

	spiderfy() {
		if (this._group._spiderfied === this || this._group._inZoomAnimation) {
			return;
		}

		const childMarkers = this.getAllChildMarkers(null, true),
			group = this._group,
			map = group._map,
			center = map.latLngToLayerPoint(this.getLatLng());
		let positions;

		this._group._unspiderfy();
		this._group._spiderfied = this;

		//TODO Maybe: childMarkers order by distance to center

		if (this._group.options.spiderfyShapePositions) {
			positions = this._group.options.spiderfyShapePositions(childMarkers.length, center);
		} else if (childMarkers.length >= this._circleSpiralSwitchover) {
			positions = this._generatePointsSpiral(childMarkers.length, center);
		} else {
			center.y += 10; // Otherwise circles look wrong => hack for standard blue icon, renders differently for other icons.
			positions = this._generatePointsCircle(childMarkers.length, center);
		}

		this._animationSpiderfy(childMarkers, positions);
	}

	unspiderfy(zoomDetails) {
		/// <param Name="zoomDetails">Argument from zoomanim if being called in a zoom animation or null otherwise</param>
		if (this._group._inZoomAnimation) {
			return;
		}
		this._animationUnspiderfy(zoomDetails);

		this._group._spiderfied = null;
	}

	_generatePointsCircle(count, centerPt) {
		const circumference = this._group.options.spiderfyDistanceMultiplier * this._circleFootSeparation * (2 + count),
			angleStep = this._2PI / count,
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

	_generatePointsSpiral(count, centerPt) {
		const spiderfyDistanceMultiplier = this._group.options.spiderfyDistanceMultiplier,
			separation = spiderfyDistanceMultiplier * this._spiralFootSeparation,
			lengthFactor = spiderfyDistanceMultiplier * this._spiralLengthFactor * this._2PI,
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

	_noanimationUnspiderfy() {
		const group = this._group,
			map = group._map,
			fg = group._featureGroup,
			childMarkers = this.getAllChildMarkers(null, true);

		group._ignoreMove = true;

		this.setOpacity(1);
		for (let i = childMarkers.length - 1; i >= 0; i--) {
			const m = childMarkers[i];

			fg.removeLayer(m);

			if (m._preSpiderfyLatlng) {
				m.setLatLng(m._preSpiderfyLatlng);
				delete m._preSpiderfyLatlng;
			}
			if (m.setZIndexOffset) {
				m.setZIndexOffset(0);
			}

			if (m._spiderLeg) {
				map.removeLayer(m._spiderLeg);
				delete m._spiderLeg;
			}
		}

		group.fire('unspiderfied', {
			cluster: this,
			markers: childMarkers
		});
		group._ignoreMove = false;
		group._spiderfied = null;
	}

	_animationSpiderfy(childMarkers, positions) {
		const group = this._group,
			map = group._map,
			fg = group._featureGroup,
			thisLayerLatLng = this.getLatLng(),
			thisLayerPos = map.latLngToLayerPoint(thisLayerLatLng),
			legOptions = {...this._group.options.spiderLegPolylineOptions}, // Copy the options so that we can modify them for animation.
			finalLegOpacity = legOptions.opacity ?? defaultLegOpacity;

		// Make sure we have a defined opacity.
		legOptions.opacity = finalLegOpacity;

		group._ignoreMove = true;

		// Add markers and spider legs to map, hidden at our center point.
		// Traverse in ascending order to make sure that inner circleMarkers are on top of further legs. Normal markers are re-ordered by newPosition.
		// The reverse order trick no longer improves performance on modern browsers.
		for (let i = 0; i < childMarkers.length; i++) {
			const m = childMarkers[i];

			const newPos = map.layerPointToLatLng(positions[i]);

			// Add the leg before the marker, so that in case the latter is a circleMarker, the leg is behind it.
			const leg = new L.Polyline([thisLayerLatLng, newPos], legOptions);
			map.addLayer(leg);
			m._spiderLeg = leg;

			// Explanations: https://jakearchibald.com/2013/animated-line-drawing-svg/
			// In our case the transition property is declared in the CSS file.
			const legPath = svgPath(leg);
			if (legPath) {
				const legLength = legPath.getTotalLength() + 0.1; // Need a small extra length to avoid remaining dot in Firefox.
				legPath.style.strokeDasharray = legLength; // Just 1 length is enough, it will be duplicated.
				legPath.style.strokeDashoffset = legLength;
				// hidden until the reveal below, or it shows before the animation starts
				leg.setStyle({opacity: 0});
			}

			// If it is a marker, add it now and we'll animate it out
			if (m.setZIndexOffset) {
				m.setZIndexOffset(1000000); // Make normal markers appear on top of EVERYTHING
			}
			if (m.clusterHide) {
				m.clusterHide();
			}

			// Vectors just get immediately added
			fg.addLayer(m);

			if (m instanceof L.Marker) {
				m._setPos(thisLayerPos);
			}
		}

		group._forceLayout();
		group._animationStart();

		// Reveal markers and spider legs.
		for (let i = childMarkers.length - 1; i >= 0; i--) {
			const newPos = map.layerPointToLatLng(positions[i]);
			const m = childMarkers[i];

			//Move marker to new position
			m._preSpiderfyLatlng = m.getLatLng();
			m.setLatLng(newPos);

			if (m.clusterShow) {
				m.clusterShow();
			}

			// Animate leg (animation is actually delegated to CSS transition).
			const legPath = svgPath(m._spiderLeg);
			if (legPath) {
				// the class with the CSS transitions is added only now, after the forced layout: getTotalLength computes
				// the leg's style early, so with the class on, the starting values would transition instead of applying
				legPath.classList.add('leaflet-cluster-spider-leg');
				legPath.style.strokeDashoffset = 0;
				m._spiderLeg.setStyle({opacity: finalLegOpacity});
			}
		}
		this.setOpacity(0.3);

		group._ignoreMove = false;

		setTimeout(() => {
			group._animationEnd();
			group.fire('spiderfied', {
				cluster: this,
				markers: childMarkers
			});
		}, 200);
	}

	_animationUnspiderfy(zoomDetails) {
		const group = this._group,
			map = group._map,
			fg = group._featureGroup,
			latlng = this.getLatLng(),
			thisLayerPos = zoomDetails ? latLngToNewLayerPoint(map, latlng, zoomDetails.zoom, zoomDetails.center) : map.latLngToLayerPoint(latlng),
			childMarkers = this.getAllChildMarkers(null, true);

		group._ignoreMove = true;
		group._animationStart();

		//Make us visible and bring the child markers back in
		this.setOpacity(1);
		for (let i = childMarkers.length - 1; i >= 0; i--) {
			const m = childMarkers[i];

			//Marker was added to us after we were spiderfied
			if (!m._preSpiderfyLatlng) {
				continue;
			}

			//Close any popup on the marker first, otherwise setting the location of the marker will make the map scroll
			m.closePopup();

			//Fix up the location to the real one
			m.setLatLng(m._preSpiderfyLatlng);
			delete m._preSpiderfyLatlng;

			//Hack override the location to be our center
			let nonAnimatable = true;
			if (m instanceof L.Marker) {
				m._setPos(thisLayerPos);
				nonAnimatable = false;
			}
			if (m.clusterHide) {
				m.clusterHide();
				nonAnimatable = false;
			}
			if (nonAnimatable) {
				fg.removeLayer(m);
			}

			// Animate the spider leg back in (animation is actually delegated to CSS transition).
			const legPath = svgPath(m._spiderLeg);
			if (legPath) {
				legPath.style.strokeDashoffset = legPath.getTotalLength() + 0.1;
				m._spiderLeg.setStyle({opacity: 0});
			}
		}

		group._ignoreMove = false;

		setTimeout(() => {
			//If we have only <= one child left then that marker will be shown on the map so don't remove it!
			let stillThereChildCount = 0;
			for (let i = childMarkers.length - 1; i >= 0; i--) {
				if (childMarkers[i]._spiderLeg) {
					stillThereChildCount++;
				}
			}


			for (let i = childMarkers.length - 1; i >= 0; i--) {
				const m = childMarkers[i];

				if (!m._spiderLeg) { //Has already been unspiderfied
					continue;
				}

				if (m.clusterShow) {
					m.clusterShow();
				}
				if (m.setZIndexOffset) {
					m.setZIndexOffset(0);
				}

				if (stillThereChildCount > 1) {
					fg.removeLayer(m);
				}

				map.removeLayer(m._spiderLeg);
				delete m._spiderLeg;
			}
			group._animationEnd();
			group.fire('unspiderfied', {
				cluster: this,
				markers: childMarkers
			});
		}, 200);
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

//Non Animated versions of everything
export class MarkerClusterNonAnimated extends MarkerCluster {
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
			m._spiderLeg = leg;

			// Now add the marker.
			m._preSpiderfyLatlng = m.getLatLng();
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
}
