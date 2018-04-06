
// Config file for running Rollup in "normal" mode (non-watch)

import rollupGitVersion from 'rollup-plugin-git-version'
import json from 'rollup-plugin-json'

import gitRev from 'git-rev-sync'


let version = require('../package.json').version;
let release;

// Skip the git branch+rev in the banner when doing a release build
if (process.env.NODE_ENV === 'release') {
	release = true;
} else {
	release = false;
	const branch = gitRev.branch();
	const rev = gitRev.short();
	version += '+' + branch + '.' + rev;
}

const banner = `/*
 * Leaflet.markercluster ` + version + `,
 * Provides Beautiful Animated Marker Clustering functionality for Leaflet, a JS library for interactive maps.
 * https://github.com/Leaflet/Leaflet.markercluster
 * (c) 2012-2017, Dave Leaver, smartrak
 */`;

export default {
	format: 'umd',
	moduleName: 'Leaflet.markercluster',
	banner: banner,
	entry: 'src/index.js',
	dest: 'dist/leaflet.markercluster-src.js',
	plugins: [
		release ? json() : rollupGitVersion(),
	],
	sourceMap: true,
	legacy: true // Needed to create files loadable by IE8
};
