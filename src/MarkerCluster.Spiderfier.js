//This code is 100% based on https://github.com/jawj/OverlappingMarkerSpiderfier-Leaflet
//Huge thanks to jawj for implementing it first to make my job easy :-)

L.MarkerCluster.include({

	_2PI: Math.PI * 2,
	_circleFootSeparation: 25, // related to circumference of circle
	_circleStartAngle: Math.PI / 6,

	_spiralFootSeparation:  28, // related to size of spiral (experiment!)
	_spiralLengthStart: 11,
	_spiralLengthFactor: 5,

	_circleSpiralSwitchover: 9, // show spiral instead of circle from this marker count upwards.
								// 0 -> always spiral; Infinity -> always circle

	spiderfy: function () {
		if (this._group._spiderfied === this || this._group._inZoomAnimation) {
			return;
		}

		var childMarkers = this.getAllChildMarkers(),
			group = this._group,
			map = group._map,
			center = map.latLngToLayerPoint(this._latlng),
			positions;

		if (!this._group.getLayers()[0] instanceof L.CircleMarker) {
			center.y += 10;
		}

		this._group._unspiderfy();
		this._group._spiderfied = this;

		this._clockHelpingGeometries = [];

		//TODO Maybe: childMarkers order by distance to center

		// applies chosen placement strategy
		switch (this._group.options.elementsPlacementStrategy) {

		case 'default':
			if (childMarkers.length >= this._circleSpiralSwitchover) {
				positions = this._generatePointsSpiral(childMarkers.length, center);
			} else {
				positions = this._generatePointsCircle(childMarkers.length, center);
			}
			break;

		case 'spiral':
			positions = this._generatePointsSpiral(childMarkers.length, center);
			break;

		case 'one-circle':
			positions = this._generatePointsCircle(childMarkers.length, center);
			break;

		case 'concentric':
			positions = this._generatePointsConcentricCircles(childMarkers.length, center);
			break;

		case 'clock':
			positions = this._generatePointsClocksCircles(childMarkers.length, center, false);
			break;

		case 'clock-concentric':
			positions = this._generatePointsClocksCircles(childMarkers.length, center, true);
			break;

		default:
			console.log('!!unknown placement strategy value. Allowed strategy names are : "default", "spiral", "one-circle", "concentric", "clock" and "clock-concentric" ');
		}

		this._animationSpiderfy(childMarkers, positions);
	},


	unspiderfy: function (zoomDetails) {
		/// <param Name="zoomDetails">Argument from zoomanim if being called in a zoom animation or null otherwise</param>
		if (this._group._inZoomAnimation) {
			return;
		}
		this._animationUnspiderfy(zoomDetails);

		this._group._spiderfied = null;
	},

	_generatePointsCircle: function (count, centerPt) {
		var circumference = this._group.options.spiderfyDistanceMultiplier * this._circleFootSeparation * (2 + count),
			legLength = circumference / this._2PI,  //radius from circumference
			angleStep = this._2PI / count,
			res = [],
			i, angle;

		res.length = count;

		for (i = count - 1; i >= 0; i--) {
			angle = this._circleStartAngle + i * angleStep;
			res[i] = new L.Point(centerPt.x + legLength * Math.cos(angle), centerPt.y + legLength * Math.sin(angle))._round();
		}

		return res;
	},

	_generatePointsSpiral: function (count, centerPt) {
		var spiderfyDistanceMultiplier = this._group.options.spiderfyDistanceMultiplier,
			legLength = spiderfyDistanceMultiplier * this._spiralLengthStart,
			separation = spiderfyDistanceMultiplier * this._spiralFootSeparation,
			lengthFactor = spiderfyDistanceMultiplier * this._spiralLengthFactor * this._2PI,
			angle = 0,
			res = [],
			i;

		res.length = count;

		// Higher index, closer position to cluster center.
		for (i = count - 1; i >= 0; i--) {
			angle += separation / legLength + i * 0.0005;
			res[i] = new L.Point(centerPt.x + legLength * Math.cos(angle), centerPt.y + legLength * Math.sin(angle))._round();
			legLength += lengthFactor / angle;
		}
		return res;
	},

  // auxiliary method - returns placement of vertex of given regular n-side polygon
	_regularPolygonVertexPlacement: function (vertexNo, totalVertices, centerPt, distanceFromCenter) {
		var deltaAngle = this._2PI / totalVertices,
			thisAngle = deltaAngle * vertexNo;

		// in case of two vertices, right-left placement is more estetic
		if (totalVertices !== 2) {
			thisAngle -= 1.6;
		}

		return new L.Point(
			centerPt.x + Math.cos(thisAngle) * distanceFromCenter,
			centerPt.y + Math.sin(thisAngle) * distanceFromCenter
		)._round();

	},

	// clock strategy placement.
	// regularFirstCicle parameter - true if first elements in the first circle are placed regularly
	_generatePointsClocksCircles: function (count, centerPt, regularFirstCircle) {
		var res = [];
		var fce = this._group.options.firstCircleElements;

		var baseDistance = this._circleFootSeparation * 1.5, // offset of the first circle
			dm = this._group.options.spiderfyDistanceMultiplier, // multiplier of the offset for a next circle
			distanceSurplus = this._group.options.spiderfyDistanceSurplus, // multiplier of the offset for a next circle
			elementsMultiplier = this._group.options.elementsMultiplier; // multiplier of number of elements in the next circle

		var iCircleNumber = 1,
			iCircleNoElements = fce,
			iCircleDistance = baseDistance,
			elementsInPreviousCircles = 0;

		this._createHelpingCircle(centerPt, iCircleDistance);

		// iterating elements
		for (var i = 1; i <= count; i++) {
			var elementOrder = i - elementsInPreviousCircles; // position of current element in this circle

			// changing the circle
			if (elementOrder > iCircleNoElements) {
				iCircleNumber += 1;
				elementsInPreviousCircles += iCircleNoElements;
				elementOrder = i - elementsInPreviousCircles; // position of current element in this circle

				iCircleNoElements = Math.floor(iCircleNoElements * elementsMultiplier);
				iCircleDistance = (distanceSurplus + iCircleDistance) * dm;

				this._createHelpingCircle(centerPt, iCircleDistance);
			}

			if (regularFirstCircle && iCircleNumber === 1) {
				res[i - 1] = this._regularPolygonVertexPlacement(elementOrder - 1, Math.min(fce, count), centerPt, iCircleDistance);
			} else {
				res[i - 1] = this._regularPolygonVertexPlacement(elementOrder - 1, iCircleNoElements, centerPt, iCircleDistance);
			}
		}

		return res;
	},

	// method for creating and storing helping circles for clock/concentric circles strategy
	_createHelpingCircle: function (center, radius) {
		if (this._group.options.helpingCircles) {

			var clockCircleStyle = {radius: radius};
			L.extend(clockCircleStyle, this._group.options.clockHelpingCircleOptions);

			var clockCircle = new L.CircleMarker(this._group._map.layerPointToLatLng(center), clockCircleStyle);
			this._group._featureGroup.addLayer(clockCircle);
			this._clockHelpingGeometries.push(clockCircle);
		}
	},

	// concentric circles strategy placement.
	// divide elements of cluster into concentric zones based on elementsMultiplier and firstCircleElements parameters
	_generatePointsConcentricCircles: function (count, centerPt) {
		var res = [];

		var fce = this._group.options.firstCircleElements,
			baseDistance = this._circleFootSeparation * 1.5, // offset of the first circle
			dm = this._group.options.spiderfyDistanceMultiplier, // multiplier of the offset for a next circle
			elementsMultiplier = this._group.options.elementsMultiplier, // multiplier of number of elements in the next circle
			distanceSurplus = this._group.options.spiderfyDistanceSurplus, // multiplier of the offset for a next circle
			secondCircleElements = Math.round(fce * elementsMultiplier); // number of elements in the second circle


		var circles = [
			{
				distance: baseDistance,
				noElements: 0
			},
			{
				distance: (distanceSurplus + baseDistance) * dm,
				noElements: 0
			},
			{
				distance: (2 * distanceSurplus + baseDistance) * dm * dm,
				noElements: 0
			},
			{
				distance: (3 * distanceSurplus + baseDistance) * dm * dm * dm,
				noElements: 0
			},
		];

		// number of points in the second circle
		if (count > fce) {
			circles[1].noElements = secondCircleElements;
			if (
				(fce < count && count < 2 * fce) ||
				(fce + secondCircleElements < count && count < 2 * fce + secondCircleElements)
			) {
				circles[1].noElements = fce;
			}
		}

		// number of points in the third circle
		if (count > fce + Math.round(fce * elementsMultiplier)) {
			circles[2].noElements = Math.round(fce * elementsMultiplier);
		}
		if (count > fce + 2 * Math.round(fce * elementsMultiplier)) {
			circles[2].noElements = Math.round(fce * elementsMultiplier * elementsMultiplier);
		}
		if (count > fce + Math.round(fce * elementsMultiplier) + Math.round(fce * elementsMultiplier * elementsMultiplier)) {
			circles[2].noElements = Math.round(fce * elementsMultiplier);
		}
		if (count > fce + 2 * Math.round(fce * elementsMultiplier) + Math.round(fce * elementsMultiplier * elementsMultiplier)) {
			circles[2].noElements = Math.round(fce * elementsMultiplier * elementsMultiplier);
		}

		// number of points in the first circle
		circles[0].noElements = Math.min(count - circles[1].noElements - circles[2].noElements, fce);

		// number of points in the fourth circle
		circles[3].noElements = Math.max(count - circles[0].noElements - circles[1].noElements - circles[2].noElements, 0);


		var prevCirclesEls = 0; // number of elements in the finished circles
		var iCircle = circles[0]; // curretly driven circle

		// iterating elements
		for (var i = 1; i <= count; i++) {

			// changing to the new circle
			if (circles[1].noElements > 0) {
				if (i > circles[0].noElements) {
					iCircle = circles[1];
					prevCirclesEls = circles[0].noElements;
				}
				if (i > (circles[0].noElements + circles[1].noElements) && circles[2].noElements > 0) {
					iCircle = circles[2];
					prevCirclesEls = circles[0].noElements + circles[1].noElements;
				}
				if (i > (circles[0].noElements + circles[1].noElements + circles[2].noElements) && circles[3].noElements > 0) {
					iCircle = circles[3];
					prevCirclesEls = circles[0].noElements - circles[1].noElements - circles[2].noElements;
				}
			}

			res[i - 1] = this._regularPolygonVertexPlacement(i - prevCirclesEls, iCircle.noElements, centerPt, iCircle.distance);
		}

		for (var ci in circles) {
			if (circles[ci].noElements) {
				this._createHelpingCircle(centerPt, circles[ci].distance);
			}
		}

		return res;
	},

	_noanimationUnspiderfy: function () {
		var group = this._group,
			map = group._map,
			fg = group._featureGroup,
			childMarkers = this.getAllChildMarkers(),
			m, i;

		group._ignoreMove = true;

		this.setOpacity(1);
		for (i = childMarkers.length - 1; i >= 0; i--) {
			m = childMarkers[i];

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

		// remove _supportiveGeometries from map

		if (this._group.options.helpingCircles) {
			this._removeClockHelpingCircles(fg);
		}


		group.fire('unspiderfied', {
			cluster: this,
			markers: childMarkers
		});
		group._ignoreMove = false;
		group._spiderfied = null;
	},


	_removeClockHelpingCircles: function (fg) {
		for (var hg in this._clockHelpingGeometries) {
			fg.removeLayer(this._clockHelpingGeometries[hg]);
		}
	},

});

//Non Animated versions of everything
L.MarkerClusterNonAnimated = L.MarkerCluster.extend({
	_animationSpiderfy: function (childMarkers, positions) {
		var group = this._group,
			map = group._map,
			fg = group._featureGroup,
			legOptions = this._group.options.spiderLegPolylineOptions,
			i, m, leg, newPos;

		group._ignoreMove = true;

		// Traverse in ascending order to make sure that inner circleMarkers are on top of further legs. Normal markers are re-ordered by newPosition.
		// The reverse order trick no longer improves performance on modern browsers.
		for (i = 0; i < childMarkers.length; i++) {
			newPos = map.layerPointToLatLng(positions[i]);
			m = childMarkers[i];

			// Add the leg before the marker, so that in case the latter is a circleMarker, the leg is behind it.
			leg = new L.Polyline([this._latlng, newPos], legOptions);
			map.addLayer(leg);
			m._spiderLeg = leg;

			// Now add the marker.
			m._preSpiderfyLatlng = m._latlng;
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
	},

	_animationUnspiderfy: function () {
		this._noanimationUnspiderfy();
	}
});

//Animated versions here
L.MarkerCluster.include({

	_animationSpiderfy: function (childMarkers, positions) {
		var me = this,
			group = this._group,
			map = group._map,
			fg = group._featureGroup,
			thisLayerLatLng = this._latlng,
			thisLayerPos = map.latLngToLayerPoint(thisLayerLatLng),
			svg = L.Path.SVG,
			legOptions = L.extend({}, this._group.options.spiderLegPolylineOptions), // Copy the options so that we can modify them for animation.
			finalLegOpacity = legOptions.opacity,
			i, m, leg, legPath, legLength, newPos;

		if (finalLegOpacity === undefined) {
			finalLegOpacity = L.MarkerClusterGroup.prototype.options.spiderLegPolylineOptions.opacity;
		}

		if (svg) {
			// If the initial opacity of the spider leg is not 0 then it appears before the animation starts.
			legOptions.opacity = 0;

			// Add the class for CSS transitions.
			legOptions.className = (legOptions.className || '') + ' leaflet-cluster-spider-leg';
		} else {
			// Make sure we have a defined opacity.
			legOptions.opacity = finalLegOpacity;
		}

		group._ignoreMove = true;

		// Add markers and spider legs to map, hidden at our center point.
		// Traverse in ascending order to make sure that inner circleMarkers are on top of further legs. Normal markers are re-ordered by newPosition.
		// The reverse order trick no longer improves performance on modern browsers.
		for (i = 0; i < childMarkers.length; i++) {
			m = childMarkers[i];

			newPos = map.layerPointToLatLng(positions[i]);

			// Add the leg before the marker, so that in case the latter is a circleMarker, the leg is behind it.
			leg = new L.Polyline([thisLayerLatLng, newPos], legOptions);
			map.addLayer(leg);
			m._spiderLeg = leg;

			// Explanations: https://jakearchibald.com/2013/animated-line-drawing-svg/
			// In our case the transition property is declared in the CSS file.
			if (svg) {
				legPath = leg._path;
				legLength = legPath.getTotalLength() + 0.1; // Need a small extra length to avoid remaining dot in Firefox.
				legPath.style.strokeDasharray = legLength; // Just 1 length is enough, it will be duplicated.
				legPath.style.strokeDashoffset = legLength;
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

			if (m._setPos) {
				m._setPos(thisLayerPos);
			}
		}

		group._forceLayout();
		group._animationStart();

		// Reveal markers and spider legs.
		for (i = childMarkers.length - 1; i >= 0; i--) {
			newPos = map.layerPointToLatLng(positions[i]);
			m = childMarkers[i];

			//Move marker to new position
			m._preSpiderfyLatlng = m._latlng;
			m.setLatLng(newPos);

			if (m.clusterShow) {
				m.clusterShow();
			}

			// Animate leg (animation is actually delegated to CSS transition).
			if (svg) {
				leg = m._spiderLeg;
				legPath = leg._path;
				legPath.style.strokeDashoffset = 0;
				//legPath.style.strokeOpacity = finalLegOpacity;
				leg.setStyle({opacity: finalLegOpacity});
			}
		}
		this.setOpacity(0.3);

		group._ignoreMove = false;

		setTimeout(function () {
			group._animationEnd();
			group.fire('spiderfied', {
				cluster: me,
				markers: childMarkers
			});
		}, 200);
	},

	_animationUnspiderfy: function (zoomDetails) {
		var me = this,
			group = this._group,
			map = group._map,
			fg = group._featureGroup,
			thisLayerPos = zoomDetails ? map._latLngToNewLayerPoint(this._latlng, zoomDetails.zoom, zoomDetails.center) : map.latLngToLayerPoint(this._latlng),
			childMarkers = this.getAllChildMarkers(),
			svg = L.Path.SVG,
			m, i, leg, legPath, legLength, nonAnimatable;

		group._ignoreMove = true;
		group._animationStart();

		//Make us visible and bring the child markers back in
		this.setOpacity(1);
		for (i = childMarkers.length - 1; i >= 0; i--) {
			m = childMarkers[i];



			//Marker was added to us after we were spiderfied
			if (!m._preSpiderfyLatlng) {
				continue;
			}

			//Fix up the location to the real one
			m.setLatLng(m._preSpiderfyLatlng);
			delete m._preSpiderfyLatlng;

			//Hack override the location to be our center
			nonAnimatable = true;
			if (m._setPos) {
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
			if (svg) {
				leg = m._spiderLeg;
				legPath = leg._path;
				legLength = legPath.getTotalLength() + 0.1;
				legPath.style.strokeDashoffset = legLength;
				leg.setStyle({opacity: 0});
			}

			// Remove _supportiveGeometries from map
			if (this._group.options.helpingCircles) {
				this._removeClockHelpingCircles(fg);
			}

		}

		group._ignoreMove = false;

		setTimeout(function () {
			//If we have only <= one child left then that marker will be shown on the map so don't remove it!
			var stillThereChildCount = 0;
			for (i = childMarkers.length - 1; i >= 0; i--) {
				m = childMarkers[i];
				if (m._spiderLeg) {
					stillThereChildCount++;
				}
			}


			for (i = childMarkers.length - 1; i >= 0; i--) {
				m = childMarkers[i];

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
				cluster: me,
				markers: childMarkers
			});
		}, 200);
	}
});


L.MarkerClusterGroup.include({
	//The MarkerCluster currently spiderfied (if any)
	_spiderfied: null,

	unspiderfy: function () {
		this._unspiderfy.apply(this, arguments);
	},

	_spiderfierOnAdd: function () {
		this._map.on('click', this._unspiderfyWrapper, this);

		if (this._map.options.zoomAnimation) {
			this._map.on('zoomstart', this._unspiderfyZoomStart, this);
		}
		//Browsers without zoomAnimation or a big zoom don't fire zoomstart
		this._map.on('zoomend', this._noanimationUnspiderfy, this);

		if (!L.Browser.touch) {
			this._map.getRenderer(this);
			//Needs to happen in the pageload, not after, or animations don't work in webkit
			//  http://stackoverflow.com/questions/8455200/svg-animate-with-dynamically-added-elements
			//Disable on touch browsers as the animation messes up on a touch zoom and isn't very noticable
		}
	},

	_spiderfierOnRemove: function () {
		this._map.off('click', this._unspiderfyWrapper, this);
		this._map.off('zoomstart', this._unspiderfyZoomStart, this);
		this._map.off('zoomanim', this._unspiderfyZoomAnim, this);
		this._map.off('zoomend', this._noanimationUnspiderfy, this);

		//Ensure that markers are back where they should be
		// Use no animation to avoid a sticky leaflet-cluster-anim class on mapPane
		this._noanimationUnspiderfy();
	},

	//On zoom start we add a zoomanim handler so that we are guaranteed to be last (after markers are animated)
	//This means we can define the animation they do rather than Markers doing an animation to their actual location
	_unspiderfyZoomStart: function () {
		if (!this._map) { //May have been removed from the map by a zoomEnd handler
			return;
		}

		this._map.on('zoomanim', this._unspiderfyZoomAnim, this);
	},

	_unspiderfyZoomAnim: function (zoomDetails) {
		//Wait until the first zoomanim after the user has finished touch-zooming before running the animation
		if (L.DomUtil.hasClass(this._map._mapPane, 'leaflet-touching')) {
			return;
		}

		this._map.off('zoomanim', this._unspiderfyZoomAnim, this);
		this._unspiderfy(zoomDetails);
	},

	_unspiderfyWrapper: function () {
		/// <summary>_unspiderfy but passes no arguments</summary>
		this._unspiderfy();
	},

	_unspiderfy: function (zoomDetails) {
		if (this._spiderfied) {
			this._spiderfied.unspiderfy(zoomDetails);
		}
	},

	_noanimationUnspiderfy: function () {
		if (this._spiderfied) {
			this._spiderfied._noanimationUnspiderfy();
		}
	},

	//If the given layer is currently being spiderfied then we unspiderfy it so it isn't on the map anymore etc
	_unspiderfyLayer: function (layer) {
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
});
