/* Copyright (c) 2012 the authors listed at the following URL, and/or
the authors of referenced articles or incorporated external code:
http://en.literateprograms.org/Quickhull_(Javascript)?action=history&offset=20120410175256

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Retrieved from: http://en.literateprograms.org/Quickhull_(Javascript)?oldid=18434
*/

/** @import {LatLng} from 'leaflet' */

/** @typedef {[LatLng, LatLng]} BaseLine */

export const QuickHull = {

	/**
	 * An approximate distance measure of a point from the baseline.
	 * @param {LatLng} cpt
	 * @param {BaseLine} bl
	 */
	getDistant(cpt, bl) {
		const vY = bl[1].lat - bl[0].lat,
			vX = bl[0].lng - bl[1].lng;
		return (vX * (cpt.lat - bl[0].lat) + vY * (cpt.lng - bl[0].lng));
	},

	/**
	 * The point farthest from the baseline, and all points on its outer side, which stay in consideration for the hull.
	 * @param {BaseLine} baseLine
	 * @param {LatLng[]} latLngs
	 */
	findMostDistantPointFromBaseLine(baseLine, latLngs) {
		/** @type {LatLng[]} */
		const newPoints = [];
		let maxD = 0,
			/** @type {LatLng | null} */
			maxPt = null,
			i, pt, d;

		for (i = latLngs.length - 1; i >= 0; i--) {
			pt = latLngs[i];
			d = this.getDistant(pt, baseLine);

			if (d > 0) {
				newPoints.push(pt);
			} else {
				continue;
			}

			if (d > maxD) {
				maxD = d;
				maxPt = pt;
			}
		}

		return {maxPoint: maxPt, newPoints};
	},

	/**
	 * Given a baseline, compute the convex hull of latLngs as an array of latLngs.
	 * @param {BaseLine} baseLine
	 * @param {LatLng[]} latLngs
	 * @returns {LatLng[]}
	 */
	buildConvexHull(baseLine, latLngs) {
		const t = this.findMostDistantPointFromBaseLine(baseLine, latLngs);

		if (t.maxPoint) { // if there is still a point "outside" the base line
			return [
				...this.buildConvexHull([baseLine[0], t.maxPoint], t.newPoints),
				...this.buildConvexHull([t.maxPoint, baseLine[1]], t.newPoints)
			];
		}   // if there is no more point "outside" the base line, the current base line is part of the convex hull
		return [baseLine[0]];

	},

	/**
	 * Given an array of latlngs, compute a convex hull as an array of latlngs.
	 * @param {LatLng[]} latLngs
	 * @returns {LatLng[]}
	 */
	getConvexHull(latLngs) {
		if (latLngs.length === 0) {
			return [];
		}

		// find first baseline
		let maxLat = -Infinity, minLat = Infinity,
			maxLng = -Infinity, minLng = Infinity,
			maxLatPt = latLngs[0], minLatPt = latLngs[0],
			maxLngPt = latLngs[0], minLngPt = latLngs[0],
			maxPt, minPt,
			i;

		for (i = latLngs.length - 1; i >= 0; i--) {
			const pt = latLngs[i];
			if (pt.lat > maxLat) {
				maxLatPt = pt;
				maxLat = pt.lat;
			}
			if (pt.lat < minLat) {
				minLatPt = pt;
				minLat = pt.lat;
			}
			if (pt.lng > maxLng) {
				maxLngPt = pt;
				maxLng = pt.lng;
			}
			if (pt.lng < minLng) {
				minLngPt = pt;
				minLng = pt.lng;
			}
		}

		if (minLat !== maxLat) {
			minPt = minLatPt;
			maxPt = maxLatPt;
		} else {
			minPt = minLngPt;
			maxPt = maxLngPt;
		}

		return [
			...this.buildConvexHull([minPt, maxPt], latLngs),
			...this.buildConvexHull([maxPt, minPt], latLngs)
		];
	}
};
