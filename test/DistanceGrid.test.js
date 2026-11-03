import {describe, expect, it, vi} from 'vitest';

describe('distance grid', () => {
	it('addObject', () => {
		const grid = new L.DistanceGrid(100),
			obj = {};

		expect(grid.addObject(obj, {x: 0, y: 0})).toEqual(undefined);
		expect(grid.removeObject(obj, {x: 0, y: 0})).toEqual(true);
	});

	it('eachObject', () => {
		const fired = vi.fn();
		const grid = new L.DistanceGrid(100),
			obj = {};

		expect(grid.addObject(obj, {x: 0, y: 0})).toEqual(undefined);

		grid.eachObject((o) => {
			expect(o).toEqual(obj);
			fired();
		});
		expect(fired).toHaveBeenCalledOnce();
	});

	it('getNearObject', () => {
		const grid = new L.DistanceGrid(100),
			obj = {};

		grid.addObject(obj, {x: 0, y: 0});

		expect(grid.getNearObject({x: 50, y: 50})).toBe(obj);
		expect(grid.getNearObject({x: 100, y: 0})).toBe(obj);
	});

	it('getNearObject with cellSize 0', () => {
		const grid = new L.DistanceGrid(0),
			obj = {};

		grid.addObject(obj, {x: 0, y: 0});

		expect(grid.getNearObject({x: 50, y: 50})).toBe(null);
		expect(grid.getNearObject({x: 0, y: 0})).toBe(obj);
	});
});
