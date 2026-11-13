import {describe, expect, it} from 'vitest';
import {DistanceGrid} from '../src/DistanceGrid.js';

describe('distance grid', () => {
	it('addObject', () => {
		const grid = new DistanceGrid(100),
			obj = {};

		expect(grid.addObject(obj, {x: 0, y: 0})).toEqual(undefined);
		expect(grid.removeObject(obj, {x: 0, y: 0})).toEqual(true);
		expect(grid.removeObject(obj, {x: 0, y: 0})).toEqual(false);
	});

	it('removeObject deletes empty rows', () => {
		const grid = new DistanceGrid(100),
			a = {},
			b = {};

		grid.addObject(a, {x: 0, y: 0});
		grid.addObject(b, {x: 500, y: 0});
		grid.removeObject(a, {x: 0, y: 0});
		expect(grid._rows.size).toBe(1);
		grid.removeObject(b, {x: 500, y: 0});
		expect(grid._rows.size).toBe(0);
	});

	it('getNearObject terminates for infinite and huge coordinates', () => {
		const grid = new DistanceGrid(100),
			a = {},
			b = {};

		grid.addObject(a, {x: Infinity, y: -Infinity});
		expect(grid.getNearObject({x: Infinity, y: -Infinity})).toBe(null);

		grid.addObject(b, {x: 2 ** 70, y: 2 ** 70});
		expect(grid.getNearObject({x: 2 ** 70, y: 2 ** 70})).toBe(b);
	});

	it('getNearObject', () => {
		const grid = new DistanceGrid(100),
			obj = {};

		grid.addObject(obj, {x: 0, y: 0});

		expect(grid.getNearObject({x: 50, y: 50})).toBe(obj);
		expect(grid.getNearObject({x: 100, y: 0})).toBe(obj);
	});

	it('getNearObject finds the closest object within the radius across cells', () => {
		const grid = new DistanceGrid(100),
			a = {},
			b = {},
			c = {};

		grid.addObject(a, {x: 210, y: 0});
		grid.addObject(b, {x: -60, y: -60});
		grid.addObject(c, {x: 150, y: 250});

		expect(grid.getNearObject({x: 190, y: 0})).toBe(a);
		expect(grid.getNearObject({x: 0, y: 0})).toBe(b);
		expect(grid.getNearObject({x: 150, y: 151})).toBe(c);
		expect(grid.getNearObject({x: 150, y: 149})).toBe(null);
		expect(grid.getNearObject({x: 90, y: 0})).toBe(null);
	});

	it('getNearObject with radius 0', () => {
		const grid = new DistanceGrid(0),
			obj = {};

		grid.addObject(obj, {x: 0, y: 0});

		expect(grid.getNearObject({x: 50, y: 50})).toBe(null);
		expect(grid.getNearObject({x: 0, y: 0})).toBe(obj);
	});
});
