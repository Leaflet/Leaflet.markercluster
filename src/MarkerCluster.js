export var MarkerCluster = L.MarkerCluster = L.Marker.extend({
	options: L.Icon.prototype.options,

	initialize: function (group, zoom, a, b) {

		L.Marker.prototype.initialize.call(this, a ? (a._cLatLng || a.getLatLng()) : new L.LatLng(0, 0),
            { icon: this, pane: group.options.clusterPane });

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
	},

	//Recursively retrieve all child markers of this cluster
	getAllChildMarkers: function (storageArray, ignoreDraggedMarker) {
		storageArray = storageArray || [];

		for (var i = this._childClusters.length - 1; i >= 0; i--) {
			this._childClusters[i].getAllChildMarkers(storageArray, ignoreDraggedMarker);
		}

		for (var j = this._markers.length - 1; j >= 0; j--) {
			if (ignoreDraggedMarker && this._markers[j].__dragStart) {
				continue;
			}
			storageArray.push(this._markers[j]);
		}

		return storageArray;
	},

	//Returns the count of how many child markers we have
	getChildCount: function () {
		return this._childCount;
	},

	//Zoom to the minimum of showing all of the child markers, or the extents of this cluster
	zoomToBounds: function (fitBoundsOptions) {
		var childClusters = this._childClusters.slice(),
			map = this._group._map,
			boundsZoom = map.getBoundsZoom(this._bounds),
			zoom = this._zoom + 1,
			mapZoom = map.getZoom(),
			i;

		//calculate how far we need to zoom down to see all of the markers
		while (childClusters.length > 0 && boundsZoom > zoom) {
			zoom++;
			var newClusters = [];
			for (i = 0; i < childClusters.length; i++) {
				newClusters = newClusters.concat(childClusters[i]._childClusters);
			}
			childClusters = newClusters;
		}

		if (boundsZoom > zoom) {
			this._group._map.setView(this._latlng, zoom);
		} else if (boundsZoom <= mapZoom) { //If fitBounds wouldn't zoom us down, zoom us down instead
			this._group._map.setView(this._latlng, mapZoom + 1);
		} else {
			this._group._map.fitBounds(this._bounds, fitBoundsOptions);
		}
	},

	getBounds: function () {
		var bounds = new L.LatLngBounds();
		bounds.extend(this._bounds);
		return bounds;
	},

	_updateIcon: function () {
		this._iconNeedsUpdate = true;
		if (this._icon) {
			this.setIcon(this);
		}
	},

	//Cludge for Icon, we pretend to be an icon for performance
	createIcon: function () {
		if (this._iconNeedsUpdate) {
			this._iconObj = this._group.options.iconCreateFunction(this);
			this._iconNeedsUpdate = false;
		}
		return this._iconObj.createIcon();
	},
	createShadow: function () {
		return this._iconObj.createShadow();
	},


	_addChild: function (new1, isNotificationFromChild) {

		this._iconNeedsUpdate = true;

		this._boundsNeedUpdate = true;
		this._setClusterCenter(new1);

		if (new1 instanceof L.MarkerCluster) {
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
	},

	/**
	 * Makes sure the cluster center is set. If not, uses the child center if it is a cluster, or the marker position.
	 * @param child L.MarkerCluster|L.Marker that will be used as cluster center if not defined yet.
	 * @private
	 */
	_setClusterCenter: function (child) {
		if (!this._cLatLng) {
			// when clustering, take position of the first point as the cluster center
			this._cLatLng = child._cLatLng || child._latlng;
		}
	},

	/**
	 * Assigns impossible bounding values so that the next extend entirely determines the new bounds.
	 * This method avoids having to trash the previous L.LatLngBounds object and to create a new one, which is much slower for this class.
	 * As long as the bounds are not extended, most other methods would probably fail, as they would with bounds initialized but not extended.
	 * @private
	 */
	_resetBounds: function () {
		var bounds = this._bounds;

		if (bounds._southWest) {
			bounds._southWest.lat = Infinity;
			bounds._southWest.lng = Infinity;
		}
		if (bounds._northEast) {
			bounds._northEast.lat = -Infinity;
			bounds._northEast.lng = -Infinity;
		}
	},

	_recalculateBounds: function () {
		var markers = this._markers,
		    childClusters = this._childClusters,
		    latSum = 0,
		    lngSum = 0,
		    totalCount = this._childCount,
		    i, child, childLatLng, childCount;

		// Case where all markers are removed from the map and we are left with just an empty _topClusterLevel.
		if (totalCount === 0) {
			return;
		}

		// Reset rather than creating a new object, for performance.
		this._resetBounds();

		// Child markers.
		for (i = 0; i < markers.length; i++) {
			childLatLng = markers[i]._latlng;

			this._bounds.extend(childLatLng);

			latSum += childLatLng.lat;
			lngSum += childLatLng.lng;
		}

		// Child clusters.
		for (i = 0; i < childClusters.length; i++) {
			child = childClusters[i];

			// Re-compute child bounds and weighted position first if necessary.
			if (child._boundsNeedUpdate) {
				child._recalculateBounds();
			}

			this._bounds.extend(child._bounds);

			childLatLng = child._wLatLng;
			childCount = child._childCount;

			latSum += childLatLng.lat * childCount;
			lngSum += childLatLng.lng * childCount;
		}

		this._latlng = this._wLatLng = new L.LatLng(latSum / totalCount, lngSum / totalCount);

		// Reset dirty flag.
		this._boundsNeedUpdate = false;
	},

	//Set our markers position as given and add it to the map
	_addToMap: function (startPos) {
		if (startPos) {
			this._backupLatlng = this._latlng;
			this.setLatLng(startPos);
		}
		this._group._featureGroup.addLayer(this);
	},

	_recursivelyAnimateChildrenIn: function (bounds, center, maxZoom) {
		this._recursively(bounds, this._group._map.getMinZoom(), maxZoom - 1,
			function (c) {
				var markers = c._markers,
					i, m;
				for (i = markers.length - 1; i >= 0; i--) {
					m = markers[i];

					//Only do it if the icon is still on the map
					if (m._icon) {
						m._setPos(center);
						m.clusterHide();
					}
				}
			},
			function (c) {
				var childClusters = c._childClusters,
					j, cm;
				for (j = childClusters.length - 1; j >= 0; j--) {
					cm = childClusters[j];
					if (cm._icon) {
						cm._setPos(center);
						cm.clusterHide();
					}
				}
			}
		);
	},

	_recursivelyAnimateChildrenInAndAddSelfToMap: function (bounds, mapMinZoom, previousZoomLevel, newZoomLevel) {
		this._recursively(bounds, newZoomLevel, mapMinZoom,
			function (c) {
				c._recursivelyAnimateChildrenIn(bounds, c._group._map.latLngToLayerPoint(c.getLatLng()).round(), previousZoomLevel);

				//TODO: depthToAnimateIn affects _isSingleParent, if there is a multizoom we may/may not be.
				//As a hack we only do a animation free zoom on a single level zoom, if someone does multiple levels then we always animate
				if (c._isSingleParent() && previousZoomLevel - 1 === newZoomLevel) {
					c.clusterShow();
					c._recursivelyRemoveChildrenFromMap(bounds, mapMinZoom, previousZoomLevel); //Immediately remove our children as we are replacing them. TODO previousBounds not bounds
				} else {
					c.clusterHide();
				}

				c._addToMap();
			}
		);
	},

	_recursivelyBecomeVisible: function (bounds, zoomLevel) {
		this._recursively(bounds, this._group._map.getMinZoom(), zoomLevel, null, function (c) {
			c.clusterShow();
		});
	},

	_recursivelyAddChildrenToMap: function (startPos, zoomLevel, bounds, rbush, collideStrategy) {
		const self = this
		this._recursively(bounds, this._group._map.getMinZoom() - 1, zoomLevel,
			function (c) {
				if (zoomLevel === c._zoom) {
					return;
				}
				//Add our child markers at startPos (so they can be animated out)
				for (var i = c._markers.length - 1; i >= 0; i--) {
					var nm = c._markers[i];

					if (!bounds.contains(nm._latlng)) {
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
					if(collideStrategy === 'adjust'){
						self._adjustClusterOrMarkerStatus(nm, rbush, zoomLevel)
					}
				}
			},
			function (c) {
				c._addToMap(startPos);
				if(collideStrategy === 'adjust'){
					self._adjustClusterOrMarkerStatus(c, rbush, zoomLevel)
				}
			}
		);
	},

 /**
  * @description: 沿线取点
  * @param {*} p1
  * @param {*} p2
  * @param {*} cell
  * @return {*}
  */
	_getAdjustPoint(p1,p2,cell){
	   const size = cell * 2
	   const vec2 = L.point(p2.x-p1.x, p2.y- p1.y)
	   const len = Math.sqrt(Math.pow(vec2.x,2)+Math.pow(vec2.y,2))
	   const result = p1.add(vec2._divideBy(len)._multiplyBy(size))
	   return result
	},

 /**
  * @description: 计算调整点
  * @param {*} rbush
  * @param {*} point
  * @param {*} rbushItem
  * @param {*} cell
  * @return {*}
  */
	_calcAdjustPoint(rbush, point, rbushItem, cell){
		const dist = cell * Math.SQRT2
		let adjustPoint,insertItem = rbushItem,collides
		let compareDist = cell
		collides = rbush.search(insertItem)
		do{
			let minX,minY,maxX,maxY
			collides.forEach(collide => {
				minX = Math.min(typeof minX==='undefined'?collide.minX:minX, collide.minX) 
				minY =  Math.min(typeof minY==='undefined'?collide.minY:minY, collide.minY)
				maxX =  Math.max(typeof maxX==='undefined'?collide.maxX:maxX, collide.maxX)
				maxY =  Math.max(typeof maxY==='undefined'?collide.maxY:maxY, collide.maxY)
			});
			// 计算中心点
			const center = L.point((maxX + minX) /2, (minY + maxY)/2)
			// 计算调整点
			adjustPoint = this._getAdjustPoint(center, point, compareDist)
			// 如果超过限制，直接隐藏
			if(compareDist > dist){
				return null
			}
			compareDist  = compareDist + 1
			// 计算当前点是否压盖
		    insertItem = {
				minX: adjustPoint.x - cell ,
				minY: adjustPoint.y - cell,
				maxX: adjustPoint.x + cell,
				maxY: adjustPoint.y + cell,
				point:adjustPoint
			}			
		}while(rbush.collides(insertItem))
		return adjustPoint
  },

 /**
  * @description: 调整显示点
  * @param {*} marker
  * @param {*} rbush
  * @param {*} zoom
  * @return {*}
  */
	_adjustClusterOrMarkerStatus(marker,rbush,zoom){
		if(!marker || !rbush) return;
		if(rbush){
			// 当前地图层级
			zoom = zoom || this._zoom
			let map,iconObj;
			// 按marker的两种类型进行分类
            if(marker instanceof MarkerCluster){
				map = marker._group._map
				iconObj = marker._iconObj 
			}else{
				map = marker._map
				iconObj = marker.options.icon
			}
			
			// 计算视图坐标
			const point = map.latLngToLayerPoint(marker.getLatLng(), zoom)

			if(!iconObj) return
			if(isNaN(point.x)|| isNaN(point.y)) return;

			const iconOptions = iconObj.options
			const iconSize = iconOptions.iconSize

			const cell = Math.max(iconSize.x,iconSize.y)/2
			
			let rbushItem = {
				minX: point.x - cell,
				minY: point.y - cell,
				maxX: point.x + cell,
				maxY: point.y + cell,
				point:point,
				obj:marker
			}
			// 判断是否交叉
			if(rbush.collides(rbushItem)){
				const collides = rbush.search(rbushItem)
				// 计算调整点
				const adjustPoint = this._calcAdjustPoint(rbush, point, rbushItem, cell)
				// 如果计算出的调整点为空，表示无法调整，直接隐藏
				if(!adjustPoint || isNaN(adjustPoint.x) || isNaN(adjustPoint.y)){
					marker.setOpacity(0)
					return 
				}
				
				const latlng = map.layerPointToLatLng(adjustPoint, zoom)
				// 重新定义marker的位置
				marker.setLatLng(latlng)
				// 计算
				rbushItem = {
					minX: adjustPoint.x - cell,
					minY: adjustPoint.y - cell,
					maxX: adjustPoint.x + cell,
					maxY: adjustPoint.y + cell,
					point:adjustPoint,
					obj:marker
				}
			}
			rbush.insert(rbushItem)
		}
	},

	_recursivelyRestoreChildPositions: function (zoomLevel ,rbush, collideStrategy) {
		const childClusters = this._childClusters.slice().sort((a,b)=>a._childCount - b._childCount)
		
		if (zoomLevel - 1 === this._zoom) {
			//Reposition child clusters
			for (var j = childClusters.length - 1; j >= 0; j--) {
				childClusters[j]._restorePosition();
				if(collideStrategy === 'adjust'){
					this._adjustClusterOrMarkerStatus(childClusters[j], rbush, zoomLevel)
				}
			}
		} else {
			for (var k = this._childClusters.length - 1; k >= 0; k--) {
				this._childClusters[k]._recursivelyRestoreChildPositions(zoomLevel);
			}
		}
	},

	_recursivelyRestoreChildMarkerPositions: function (zoomLevel ,rbush, collideStrategy) {
		// Fix positions of child markers
		for (var i = this._markers.length - 1; i >= 0; i--) {
			var nm = this._markers[i];
			if (nm._backupLatlng) {
				nm.setLatLng(nm._backupLatlng);
				delete nm._backupLatlng;
			}
			if(nm._map){
				// 动态调整marker位置
				if(collideStrategy === 'adjust'){
					this._adjustClusterOrMarkerStatus(nm, rbush, zoomLevel)
				}
			}
		}

		const childClusters = this._childClusters.slice().sort((a,b)=>a._childCount - b._childCount)
		for (var k = this._childClusters.length - 1; k >= 0; k--) {
			this._childClusters[k]._recursivelyRestoreChildPositions(zoomLevel);
		}

	},

	_restorePosition: function () {
		if (this._backupLatlng) {
			this.setLatLng(this._backupLatlng);
			delete this._backupLatlng;
		}
	},

	//exceptBounds: If set, don't remove any markers/clusters in it
	_recursivelyRemoveChildrenFromMap: function (previousBounds, mapMinZoom, zoomLevel, exceptBounds) {
		var m, i;
		this._recursively(previousBounds, mapMinZoom - 1, zoomLevel - 1,
			function (c) {
				//Remove markers at every level
				for (i = c._markers.length - 1; i >= 0; i--) {
					m = c._markers[i];
					if (!exceptBounds || !exceptBounds.contains(m._latlng)) {
						c._group._featureGroup.removeLayer(m);
						if (m.clusterShow) {
							m.clusterShow();
						}
					}
				}
			},
			function (c) {
				//Remove child clusters at just the bottom level
				for (i = c._childClusters.length - 1; i >= 0; i--) {
					m = c._childClusters[i];
					if (!exceptBounds || !exceptBounds.contains(m._latlng)) {
						c._group._featureGroup.removeLayer(m);
						if (m.clusterShow) {
							m.clusterShow();
						}
					}
				}
			}
		);
	},

	//Run the given functions recursively to this and child clusters
	// boundsToApplyTo: a L.LatLngBounds representing the bounds of what clusters to recurse in to
	// zoomLevelToStart: zoom level to start running functions (inclusive)
	// zoomLevelToStop: zoom level to stop running functions (inclusive)
	// runAtEveryLevel: function that takes an L.MarkerCluster as an argument that should be applied on every level
	// runAtBottomLevel: function that takes an L.MarkerCluster as an argument that should be applied at only the bottom level
	_recursively: function (boundsToApplyTo, zoomLevelToStart, zoomLevelToStop, runAtEveryLevel, runAtBottomLevel) {
		var childClusters = this._childClusters,
		    zoom = this._zoom,
		    i, c;

		if (zoomLevelToStart <= zoom) {
			// 调整顺序
			if (runAtBottomLevel && zoom === zoomLevelToStop) {
				runAtBottomLevel(this);
			}

			if (runAtEveryLevel) {
				runAtEveryLevel(this);
			}

		}

		// 排序，聚类簇大的在後面
		childClusters.sort((a,b)=>a._childCount - b._childCount)
		if (zoom < zoomLevelToStart || zoom < zoomLevelToStop) {
			for (i = childClusters.length - 1; i >= 0; i--) {
				c = childClusters[i];
				if (c._boundsNeedUpdate) {
					c._recalculateBounds();
				}
				if (boundsToApplyTo.intersects(c._bounds)) {
					c._recursively(boundsToApplyTo, zoomLevelToStart, zoomLevelToStop, runAtEveryLevel, runAtBottomLevel);
				}
			}
		}
	},

	//Returns true if we are the parent of only one cluster and that cluster is the same as us
	_isSingleParent: function () {
		//Don't need to check this._markers as the rest won't work if there are any
		return this._childClusters.length > 0 && this._childClusters[0]._childCount === this._childCount;
	}
});

