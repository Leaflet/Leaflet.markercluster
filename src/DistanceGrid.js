import * as L from 'leaflet';

export class DistanceGrid {

	constructor(cellSize) {
		this._cellSize = cellSize;
		this._sqCellSize = cellSize * cellSize;
		this._grid = {};
		this._objectPoint = { };
	}

	addObject(obj, point) {
		const x = this._getCoord(point.x),
			y = this._getCoord(point.y),
			grid = this._grid,
			row = grid[y] = grid[y] || {},
			cell = row[x] = row[x] || [],
			stamp = L.Util.stamp(obj);

		this._objectPoint[stamp] = point;

		cell.push(obj);
	}

	updateObject(obj, point) {
		this.removeObject(obj);
		this.addObject(obj, point);
	}

	// returns true if the object was found; looks it up at the point it was added with
	removeObject(obj) {
		const stamp = L.Util.stamp(obj),
			point = this._objectPoint[stamp];
		if (!point) {
			return false;
		}
		delete this._objectPoint[stamp];

		const x = this._getCoord(point.x),
			y = this._getCoord(point.y),
			row = this._grid[y],
			cell = row[x];

		for (let i = 0, len = cell.length; i < len; i++) {
			if (cell[i] === obj) {

				cell.splice(i, 1);

				if (len === 1) {
					delete row[x];
				}

				return true;
			}
		}
		return false;
	}

	eachObject(fn, context) {
		const grid = this._grid;

		for (const i in grid) {
			const row = grid[i];

			for (const j in row) {
				const cell = row[j];

				for (let k = 0, len = cell.length; k < len; k++) {
					const removed = fn.call(context, cell[k]);
					if (removed) {
						k--;
						len--;
					}
				}
			}
		}
	}

	getNearObject(point) {
		const x = this._getCoord(point.x),
			y = this._getCoord(point.y),
			objectPoint = this._objectPoint;
		let closestDistSq = this._sqCellSize,
			closest = null;

		for (let i = y - 1; i <= y + 1; i++) {
			const row = this._grid[i];
			if (row) {

				for (let j = x - 1; j <= x + 1; j++) {
					const cell = row[j];
					if (cell) {

						for (let k = 0, len = cell.length; k < len; k++) {
							const obj = cell[k];
							const dist = this._sqDist(objectPoint[L.Util.stamp(obj)], point);
							if (dist < closestDistSq ||
								dist <= closestDistSq && closest === null) {
								closestDistSq = dist;
								closest = obj;
							}
						}
					}
				}
			}
		}
		return closest;
	}

	_getCoord(x) {
		const coord = Math.floor(x / this._cellSize);
		return isFinite(coord) ? coord : x;
	}

	_sqDist(p, p2) {
		const dx = p2.x - p.x,
			dy = p2.y - p.y;
		return dx * dx + dy * dy;
	}
}
