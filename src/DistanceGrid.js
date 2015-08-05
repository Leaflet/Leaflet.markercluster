
L.DistanceGrid = function (cellSize) {
	this._cellSize = cellSize;
	this._sqCellSize = cellSize * cellSize;
	this._grid = {};
	this._objectPoint = { };
};

L.DistanceGrid.prototype = {

	addObject: function (obj, point) {
		var x = Math.floor(point.x / this._cellSize),
		    y = Math.floor(point.y / this._cellSize),
		    grid = this._grid,
		    row = grid[y] = grid[y] || {},
		    cell = row[x] = row[x] || [],
		    stamp = L.Util.stamp(obj);

		this._objectPoint[stamp] = {
            obj: obj,
            x: point.x,
            y: point.y
        };

		cell.push(stamp);
	},

	//Returns true if the object was found
	removeObject: function (obj, point) {
		var x = Math.floor(point.x / this._cellSize),
		    y = Math.floor(point.y / this._cellSize),
		    grid = this._grid,
		    row = grid[y] = grid[y] || {},
		    cell = row[x] = row[x] || [],
		    stamp = L.Util.stamp(obj),
            objectPoint = this._objectPoint,
		    i, len;

		for (i = 0, len = cell.length; i < len; i++) {
			if (objectPoint[cell[i]].obj === obj) {
				if (len === 1) {
					delete row[x];
				} else {
                    cell.splice(i, 1);
                }
                // delete this._objectPoint[stamp];
                this._objectPoint[stamp] = null;
				return true;
			}
		}
	},

	getNearObject: function (point) {
		var x = Math.floor(point.x / this._cellSize),
		    y = Math.floor(point.y / this._cellSize),
		    i, j, k, row, cell, len, dist,
		    objectPoint = this._objectPoint,
		    closestDistSq = this._sqCellSize,
		    closest = null;

		for (i = y - 1; i <= y + 1; i++) {
			row = this._grid[i];
			if (row) {

				for (j = x - 1; j <= x + 1; j++) {
					cell = row[j];
					if (cell) {

						for (k = 0, len = cell.length; k < len; k++) {
                            if (cell[k]) {
                                var item = objectPoint[cell[k]];
                                dist = this._sqDist(item, point);
                                if (dist < closestDistSq) {
                                    closestDistSq = dist;
                                    closest = item.obj;
                                }
							}
						}
					}
				}
			}
		}
		return closest;
	},

	_sqDist: function (p, p2) {
		var dx = p2.x - p.x,
		    dy = p2.y - p.y;
		return dx * dx + dy * dy;
	}
};
