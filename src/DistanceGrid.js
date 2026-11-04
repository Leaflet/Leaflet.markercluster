/** @typedef {{x: number, y: number}} XY */

/**
 * Objects bucketed by their projected points into square cells, for finding the closest one within a cell size.
 * @template {object} T
 */
export class DistanceGrid {

	/** @param {number} cellSize */
	constructor(cellSize) {
		this._cellSize = cellSize;
		this._sqCellSize = cellSize * cellSize;
		/** Rows by cell y, cells by cell x, each cell a flat [obj, x, y, obj, x, y, ...] array. @type {Map<number, Map<number, Array<T | number>>>} */
		this._rows = new Map();
		/** @type {Map<T, XY>} */
		this._points = new Map();
	}

	/**
	 * @param {T} obj
	 * @param {XY} point
	 */
	addObject(obj, point) {
		const x = this._getCoord(point.x),
			y = this._getCoord(point.y);

		let row = this._rows.get(y);
		if (!row) {
			row = new Map();
			this._rows.set(y, row);
		}
		let cell = row.get(x);
		if (!cell) {
			cell = [];
			row.set(x, cell);
		}
		cell.push(obj, point.x, point.y);
		this._points.set(obj, point);
	}

	/**
	 * Returns true if the object was found; looks it up at the point it was added with.
	 * @param {T} obj
	 */
	removeObject(obj) {
		const point = this._points.get(obj);
		if (!point) {
			return false;
		}
		this._points.delete(obj);

		const x = this._getCoord(point.x),
			row = /** @type {Map<number, Array<T | number>>} */ (this._rows.get(this._getCoord(point.y))),
			cell = /** @type {Array<T | number>} */ (row.get(x));

		for (let i = 0; i < cell.length; i += 3) {
			if (cell[i] === obj) {
				cell.splice(i, 3);
				if (!cell.length) {
					row.delete(x);
				}
				return true;
			}
		}
		return false;
	}

	/**
	 * The object closest to the point within the cell size, or null.
	 * @param {XY} point
	 * @returns {T | null}
	 */
	getNearObject(point) {
		const px = point.x,
			py = point.y,
			x = this._getCoord(px),
			y = this._getCoord(py);
		let closestDistSq = this._sqCellSize,
			closest = null;

		for (let i = y - 1; i <= y + 1; i++) {
			const row = this._rows.get(i);
			if (!row) continue;

			for (let j = x - 1; j <= x + 1; j++) {
				const cell = row.get(j);
				if (!cell) continue;

				for (let k = 0; k < cell.length; k += 3) {
					const dx = /** @type {number} */ (cell[k + 1]) - px,
						dy = /** @type {number} */ (cell[k + 2]) - py,
						dist = dx * dx + dy * dy;
					if (dist < closestDistSq || dist <= closestDistSq && closest === null) {
						closestDistSq = dist;
						closest = /** @type {T} */ (cell[k]);
					}
				}
			}
		}
		return closest;
	}

	/** @param {number} x */
	_getCoord(x) {
		const coord = Math.floor(x / this._cellSize);
		return isFinite(coord) ? coord : x;
	}
}
