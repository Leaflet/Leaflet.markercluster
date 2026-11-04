/* eslint-disable no-await-in-loop -- steps run one after another */
// Benchmarks the group in headless Chromium. Usage:
//   npm run bench -- [sizes...] [--v1] [--sparse] [--min-zoom=0] [--runs=5] [--src=dir] [--prof]
// --src runs another copy of src/ (e.g. a baseline checkout), --v1 uses Leaflet 1.9 instead of 2.0, --sparse uses
// uniformly random points over the world instead of the dense real-world data, --min-zoom sets the map's minZoom (with
// sparse data, a high one leaves many markers unclustered at the top level), --prof prints a CPU profile per step.

import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {parseArgs} from 'node:util';

const {values: opts, positionals} = parseArgs({allowPositionals: true, options: {
	v1: {type: 'boolean', default: false},
	sparse: {type: 'boolean', default: false},
	'min-zoom': {type: 'string', default: '0'},
	runs: {type: 'string', default: '5'},
	src: {type: 'string', default: 'src'},
	prof: {type: 'boolean', default: false}
}});

const root = new URL('..', import.meta.url).pathname;
const sizes = positionals.length ? positionals.map(Number) : [50000, 200000];
const leaflet = opts.v1 ? 'node_modules/leaflet-v1/dist/leaflet-src.esm.js' : 'node_modules/leaflet/dist/leaflet.js';

const files = {
	'/': 'bench/index.html',
	'/page.js': 'bench/page.js',
	'/leaflet.js': leaflet,
	'/data.json': 'example/realworld.50000.json'
};
const types = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css'};

const browser = await chromium.launch({args: ['--js-flags=--expose-gc', '--enable-precise-memory-info']});
const page = await browser.newPage({viewport: {width: 1024, height: 768}});
page.on('pageerror', e => console.error('page error:', e.message));
page.on('console', m => m.type() === 'log' && console.log(m.text()));

await page.route('http://bench/**', async (route) => {
	const path = new URL(route.request().url()).pathname;
	const file = path.startsWith('/src/') ? resolve(root, opts.src, path.slice(5)) : files[path] && resolve(root, files[path]);
	await (file ?
		route.fulfill({body: await readFile(file), contentType: types[extname(file)]}) :
		route.fulfill({status: 404}));
});
await page.goto('http://bench/');
await page.waitForFunction(() => window.bench);

const cdp = opts.prof ? await page.context().newCDPSession(page) : null;
const steps = ['addLayersOffMap', 'onAdd', 'addLayers', 'zoomOut', 'zoomIn', 'pan', 'removeHalf', 'clearLayers'];

console.log(`Leaflet ${await page.evaluate(() => window.L.version)}, src: ${opts.src}, ${opts.sparse ? 'sparse' : 'real-world'} data, minZoom ${opts['min-zoom']}, median of ${opts.runs} runs`);

for (const n of sizes) {
	await page.evaluate(([n, sparse, minZoom]) => window.bench.setup(n, sparse, minZoom), [n, opts.sparse, +opts['min-zoom']]);
	const results = {};
	for (let run = 0; run < +opts.runs; run++) {
		for (const step of [...steps, 'gc', 'heap']) {
			const profiling = cdp && run === 0 && step !== 'heap' && step !== 'gc';
			if (profiling) await startProfile();
			(results[step] ??= []).push(await page.evaluate(step => window.bench.run(step), step));
			if (profiling) await printProfile(`${step}, ${n}`);
		}
		await page.evaluate(() => window.bench.teardown());
	}
	console.log(`\n${n} markers`);
	for (const [step, times] of Object.entries(results)) {
		const sorted = times.sort((a, b) => a - b);
		const unit = step === 'heap' ? ' B/marker' : ' ms';
		const fmt = x => (step === 'heap' ? Math.round(x) : x.toFixed(1)) + unit;
		console.log(`${step.padEnd(16)} ${fmt(sorted[sorted.length >> 1]).padStart(14)}   (${sorted.map(x => step === 'heap' ? Math.round(x) : x.toFixed(1)).join(', ')})`);
	}
}

await browser.close();

async function startProfile() {
	await cdp.send('Profiler.enable');
	await cdp.send('Profiler.setSamplingInterval', {interval: 50});
	await cdp.send('Profiler.start');
}

async function printProfile(label) {
	const {profile} = await cdp.send('Profiler.stop');
	const nodes = new Map(profile.nodes.map(n => [n.id, n]));
	const self = new Map();
	let total = 0;
	for (let i = 0; i < profile.samples.length; i++) {
		const {functionName, url, lineNumber} = nodes.get(profile.samples[i]).callFrame;
		if (functionName === '(idle)' || functionName === '(program)') continue;
		const key = `${functionName || '(anonymous)'} ${url.split('/').pop()}:${lineNumber + 1}`;
		self.set(key, (self.get(key) || 0) + profile.timeDeltas[i]);
		total += profile.timeDeltas[i];
	}
	console.log(`\n== ${label}: ${(total / 1000).toFixed(0)} ms sampled`);
	for (const [key, t] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
		console.log(`${(t / total * 100).toFixed(1).padStart(5)}%  ${key}`);
	}
}
