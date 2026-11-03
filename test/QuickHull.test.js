import {describe, expect, it} from 'vitest';
import {QuickHull} from '../src/QuickHull.js';

describe('quickhull', () => {
	describe('getDistant', () => {
		it('zero distance', () => {
			const bl = [
				{lat: 0, lng: 0},
				{lat: 0, lng: 10}
			];
			expect(QuickHull.getDistant({lat: 0, lng: 0}, bl)).toEqual(0);
		});
		it('non-zero distance', () => {
			const bl = [
				{lat: 0, lng: 0},
				{lat: 0, lng: 10}
			];
			expect(QuickHull.getDistant({lat: 5, lng: 5}, bl)).toEqual(-50);
		});
	});

	describe('getConvexHull', () => {
		it('creates a hull', () => {
			expect(QuickHull.getConvexHull([{lat: 0, lng: 0},
				{lat: 10, lng: 0},
				{lat: 10, lng: 10},
				{lat: 0, lng: 10},
				{lat: 5, lng: 5}
			])).toEqual([
				{lat: 0, lng: 10},
				{lat: 10, lng: 10},
				{lat: 10, lng: 0},
				{lat: 0, lng: 0}
			]);
		});
		it('creates a hull for vertically-aligned objects', () => {
			expect(QuickHull.getConvexHull([{lat: 0, lng: 0},
				{lat: 5, lng: 0},
				{lat: 10, lng: 0}
			])).toEqual([
				{lat: 0, lng: 0},
				{lat: 10, lng: 0}
			]);
		});
		it('creates a hull for horizontally-aligned objects', () => {
			expect(QuickHull.getConvexHull([{lat: 0, lng: 0},
				{lat: 0, lng: 5},
				{lat: 0, lng: 10}
			])).toEqual([
				{lat: 0, lng: 0},
				{lat: 0, lng: 10}
			]);
		});
	});
});
