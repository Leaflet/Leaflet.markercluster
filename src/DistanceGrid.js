/** @typedef {{x: number, y: number}} XY */

/**
 * Objects bucketed by their projected points into square cells, for finding the closest one within a radius. Cells are
 * twice the radius wide, so that the radius around any point overlaps only 2x2 of them.
 * @template {object} T
 */
export class DistanceGrid {

	/** @param {number} radius */
	constructor(radius) {
		this._radius = radius;
		this._sqRadius = radius * radius;
		this._cellSize = 2 * radius;
		/** Rows by cell y, cells by cell x, each cell a flat [obj, x, y, obj, x, y, ...] array. @type {Map<number, Map<number, Array<T | number>>>} */
		this._rows = new Map();
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
	}

	/**
	 * Returns true if the object was found.
	 * @param {T} obj
	 * @param {XY} point The point it was added with.
	 */
	removeObject(obj, point) {
		const x = this._getCoord(point.x),
			y = this._getCoord(point.y),
			row = this._rows.get(y),
			cell = row?.get(x);
		if (!row || !cell) {
			return false;
		}

		for (let i = 0; i < cell.length; i += 3) {
			if (cell[i] === obj) {
				if (cell.length === 3) {
					row.delete(x);
					if (row.size === 0) {
						this._rows.delete(y);
					}
				} else {
					for (let k = i + 3; k < cell.length; k++) cell[k - 3] = cell[k];
					cell.length -= 3;
				}
				return true;
			}
		}
		return false;
	}

	/**
	 * The object closest to the point within the radius, or null.
	 * @param {XY} point
	 * @returns {T | null}
	 */
	getNearObject(point) {
		const px = point.x,
			py = point.y,
			x = this._getCoord(px - this._radius),
			y = this._getCoord(py - this._radius);
		let closestDistSq = this._sqRadius,
			closest = null;

		// by offset, since y + 1 === y for an infinite or huge coordinate, e.g. from an invalid latlng
		for (let dy = 0; dy < 2; dy++) {
			const row = this._rows.get(y + dy);
			if (!row) continue;

			for (let dx = 0; dx < 2; dx++) {
				const cell = row.get(x + dx);
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
