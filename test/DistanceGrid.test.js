import {describe, expect, it, vi} from 'vitest';
import {DistanceGrid} from '../src/DistanceGrid.js';

describe('distance grid', () => {
	it('addObject', () => {
		const grid = new DistanceGrid(100),
			obj = {};

		expect(grid.addObject(obj, {x: 0, y: 0})).toEqual(undefined);
		expect(grid.removeObject(obj)).toEqual(true);
		expect(grid.removeObject(obj)).toEqual(false);
	});

	it('updateObject', () => {
		const grid = new DistanceGrid(100),
			obj = {};

		grid.addObject(obj, {x: 0, y: 0});
		grid.updateObject(obj, {x: 500, y: 500});

		expect(grid.getNearObject({x: 0, y: 0})).toBe(null);
		expect(grid.getNearObject({x: 450, y: 450})).toBe(obj);
	});

	it('eachObject', () => {
		const fired = vi.fn();
		const grid = new DistanceGrid(100),
			obj = {};

		expect(grid.addObject(obj, {x: 0, y: 0})).toEqual(undefined);

		grid.eachObject((o) => {
			expect(o).toEqual(obj);
			fired();
		});
		expect(fired).toHaveBeenCalledOnce();
	});

	it('getNearObject', () => {
		const grid = new DistanceGrid(100),
			obj = {};

		grid.addObject(obj, {x: 0, y: 0});

		expect(grid.getNearObject({x: 50, y: 50})).toBe(obj);
		expect(grid.getNearObject({x: 100, y: 0})).toBe(obj);
	});

	it('getNearObject with cellSize 0', () => {
		const grid = new DistanceGrid(0),
			obj = {};

		grid.addObject(obj, {x: 0, y: 0});

		expect(grid.getNearObject({x: 50, y: 50})).toBe(null);
		expect(grid.getNearObject({x: 0, y: 0})).toBe(obj);
	});
});
