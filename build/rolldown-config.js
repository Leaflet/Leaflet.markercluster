import {readFileSync} from 'node:fs';
import {defineConfig} from 'rolldown';
import pkg from '../package.json' with {type: 'json'};

const banner = `/* @preserve
 * Leaflet.markercluster ${pkg.version}, animated marker clustering for Leaflet. https://github.com/Leaflet/Leaflet.markercluster
 * (c) 2012-${new Date().getFullYear()} Dave Leaver, Volodymyr Agafonkin
 */`;

/** @type {import('rolldown').OutputOptions} */
const commonOptions = {
	postBanner: banner,
	minify: true,
	comments: false,
	sourcemap: true
};

// keep the minifier from emitting syntax newer than what the sources may use
const transform = {target: 'es2022'};

// the stylesheet ships as is, next to the scripts
const copyCSS = {
	name: 'copy-css',
	generateBundle() {
		const fileName = 'MarkerCluster.Default.css';
		this.emitFile({type: 'asset', fileName, source: readFileSync(new URL(`../src/${fileName}`, import.meta.url))});
	}
};

export default defineConfig([
	{
		input: './src/index.js',
		external: ['leaflet'],
		transform,
		plugins: [copyCSS],
		output: {
			...commonOptions,
			file: './dist/leaflet.markercluster.js'
		}
	},
	{
		input: './build/global.js',
		external: ['leaflet'],
		transform,
		output: {
			...commonOptions,
			file: './dist/leaflet.markercluster-global.js',
			format: 'iife',
			globals: {leaflet: 'L'}
		}
	}
]);
