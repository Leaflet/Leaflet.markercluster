import {expect, inject, it} from 'vitest';
import * as L from 'leaflet';

it('runs on the Leaflet version of the test project', () => {
	expect(L.version.startsWith(inject('leafletVersion'))).toBe(true);
});
