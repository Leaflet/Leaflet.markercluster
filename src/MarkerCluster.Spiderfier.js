//This code is 100% based on https://github.com/jawj/OverlappingMarkerSpiderfier-Leaflet
//Huge thanks to jawj for implementing it first to make my job easy :-)

L.MarkerCluster.include({

	_2PI: Math.PI * 2,
	_circleFootSeparation: 25, //related to circumference of circle
	_circleStartAngle: Math.PI / 6,

	_spiralFootSeparation:  28, //related to size of spiral (experiment!)
	_spiralLengthStart: 11,
	_spiralLengthFactor: 5,

	_circleSpiralSwitchover: 9, //show spiral instead of circle from this marker count upwards.
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

		this._group._unspiderfy();
		this._group._spiderfied = this;

		//TODO Maybe: childMarkers order by distance to center

		if (childMarkers.length >= this._circleSpiralSwitchover) {
			positions = this._generatePointsSpiral(childMarkers.length, center);
		} else {
			center.y += 10; //Otherwise circles look wrong
			positions = this._generatePointsCircle(childMarkers.length, center);
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

		for (i = count - 1; i >= 0; i--) {
			angle += separation / legLength + i * 0.0005;
			res[i] = new L.Point(centerPt.x + legLength * Math.cos(angle), centerPt.y + legLength * Math.sin(angle))._round();
			legLength += lengthFactor / angle;
		}
		return res;
	},

	_noanimationUnspiderfy: function () {
		var group = this._group,
			map = group._map,
			fg = group._featureGroup,
			childMarkers = this.getAllChildMarkers(),
			m, i;

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

		group._spiderfied = null;
	}
});

//Non Animated versions of everything
L.MarkerClusterNonAnimated = L.MarkerCluster.extend({
	_animationSpiderfy: function (childMarkers, positions) {
		var group = this._group,
		    map = group._map,
		    fg = group._featureGroup,
		    legOptions = this._group.options.spiderLegPolylineOptions,
		    i, m, leg, newPos;

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
		group.fire('spiderfied');
	},

	_animationUnspiderfy: function () {
		this._noanimationUnspiderfy();
	}
});

//Animated versions here
L.MarkerCluster.include({

	_transitionDuration: 300, // in ms. Note: this is different from the timeout value (200 ms) which only fires an event.

	_animationSpiderfy: function (childMarkers, positions) {
		var group = this._group,
		    map = group._map,
		    fg = group._featureGroup,
		    thisLayerLatLng = this._latlng,
		    thisLayerPos = map.latLngToLayerPoint(thisLayerLatLng),
		    svg = L.Path.SVG,
		    legOptions = this._group.options.spiderLegPolylineOptions,
		    i, m, leg, legPath, legLength, newPos;

		if (legOptions.opacity === undefined) {
			legOptions.opacity = L.MarkerClusterGroup.prototype.options.spiderLegPolylineOptions.opacity;
		}
		this._finalLegOpacity = legOptions.opacity;

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
			// In our case we will use requestAnimationFrame rather than CSS Transition, which is not applied on SVG properties by IE.
			// http://stackoverflow.com/questions/24918529/animate-path-in-internet-explorer
			// https://connect.microsoft.com/IE/feedbackdetail/view/920928/ie-11-css-transition-property-not-working-for-svg-elements
			if (svg) {
				legPath = leg._path;
				legLength = legPath.getTotalLength() + 0.1; // Need a small extra length to avoid remaining dot in Firefox.
				legPath.style.strokeDasharray = legLength + ' ' + legLength;
				//legPath.style.strokeDashoffset = legLength;
				leg.legLength = legLength;
			}

			// If it is a marker, add it now and we'll animate it out
			if (m.setOpacity) {
				m.setZIndexOffset(1000000); // Make normal markers appear on top of EVERYTHING
				m.clusterHide();

				fg.addLayer(m);

				m._setPos(thisLayerPos);
			} else {
				// Vectors just get immediately added
				fg.addLayer(m);
			}
		}

		// Start legs animation before the forced layout, so that if we are able to animate, their opacity is already changed to 0.
		this._animateLegs(childMarkers);

		group._forceLayout();
		group._animationStart();

		// Reveal markers and spider legs.
		for (i = childMarkers.length - 1; i >= 0; i--) {
			newPos = map.layerPointToLatLng(positions[i]);
			m = childMarkers[i];

			//Move marker to new position
			m._preSpiderfyLatlng = m._latlng;
			m.setLatLng(newPos);

			if (m.setOpacity) {
				m.clusterShow();
			}
		}
		this.setOpacity(0.3);

		setTimeout(function () {
			group._animationEnd();
			group.fire('spiderfied');
		}, 200);
	},

	_animationUnspiderfy: function (zoomDetails) {
		var group = this._group,
		    map = group._map,
		    fg = group._featureGroup,
		    thisLayerPos = zoomDetails ? map._latLngToNewLayerPoint(this._latlng, zoomDetails.zoom, zoomDetails.center) : map.latLngToLayerPoint(this._latlng),
		    childMarkers = this.getAllChildMarkers(),
		    m, i;

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
			if (m.setOpacity) {
				m._setPos(thisLayerPos);
				m.clusterHide();
			} else {
				fg.removeLayer(m);
			}
		}

		// Animate the spider legs back in.
		this._animateLegs(childMarkers, true);

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


				if (m.setOpacity) {
					m.clusterShow();
					m.setZIndexOffset(0);
				}

				if (stillThereChildCount > 1) {
					fg.removeLayer(m);
				}

				map.removeLayer(m._spiderLeg);
				delete m._spiderLeg;
			}
			group._animationEnd();
		}, 200);
	},

	_setLegsStyle: function (progress) {
		var revertProgress = 1 - progress,
		    reverse = this._reverse,
		    finalLegOpacity = this._finalLegOpacity,
		    markers = this._markers,
		    i = 0,
			leg;

		for (; i < markers.length; i++) {
			leg = markers[i]._spiderLeg;
			// Check for animation end before transition end.
			if (!leg) {
				this._startTime = 0;
				break;
			}
			// Linear transition, so it will be slightly delayed compared to markers transform (used for translation), which use ease-out.
			leg._path.style.strokeDashoffset = (reverse ? progress : revertProgress) * leg.legLength;
			leg.setStyle({opacity: (reverse ? revertProgress : progress) * finalLegOpacity});
		}
	},

	_runFrame: function () {
		var elapsed = (+new Date()) - this._startTime,
			duration = this._transitionDuration;

		if (elapsed < duration) {
			L.Util.requestAnimFrame(this._runFrame, this);
			this._setLegsStyle(elapsed / duration);
		} else {
			this._setLegsStyle(1);
		}
	},

	_animateLegs: function (markers, reverse) {
		if (L.Path.SVG) {
			this._startTime = +new Date();
			this._reverse = reverse;

			L.Util.requestAnimFrame(this._runFrame, this);
		}
	}
});


L.MarkerClusterGroup.include({
	//The MarkerCluster currently spiderfied (if any)
	_spiderfied: null,

	_spiderfierOnAdd: function () {
		this._map.on('click', this._unspiderfyWrapper, this);

		if (this._map.options.zoomAnimation) {
			this._map.on('zoomstart', this._unspiderfyZoomStart, this);
		}
		//Browsers without zoomAnimation or a big zoom don't fire zoomstart
		this._map.on('zoomend', this._noanimationUnspiderfy, this);
	},

	_spiderfierOnRemove: function () {
		this._map.off('click', this._unspiderfyWrapper, this);
		this._map.off('zoomstart', this._unspiderfyZoomStart, this);
		this._map.off('zoomanim', this._unspiderfyZoomAnim, this);

		this._unspiderfy(); //Ensure that markers are back where they should be
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

			layer.setOpacity(1);
			//Position will be fixed up immediately in _animationUnspiderfy
			layer.setZIndexOffset(0);

			this._map.removeLayer(layer._spiderLeg);
			delete layer._spiderLeg;
		}
	}
});
