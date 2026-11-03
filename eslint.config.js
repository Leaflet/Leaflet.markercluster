import {includeIgnoreFile} from '@eslint/compat';
import {fileURLToPath} from 'node:url';
import config from 'eslint-config-mourner';
import html from 'eslint-plugin-html';
import baselineJs from 'eslint-plugin-baseline-js';

export default [
	...config,
	includeIgnoreFile(fileURLToPath(new URL('.gitignore', import.meta.url))),
	{ignores: ['example/realworld.*.js']},
	{
		rules: {
			'@stylistic/indent': [2, 'tab', {flatTernaryExpressions: true, SwitchCase: 0}]
		}
	},
	{
		files: ['example/*.html'],
		plugins: {html}
	},
	{
		files: ['src/**/*.js'],
		plugins: {'baseline-js': baselineJs},
		rules: {
			'baseline-js/use-baseline': ['error', {
				available: 2022, // same fixed floor as Leaflet (Safari 15.4+)
				includeWebApis: {preset: 'auto'},
				includeJsBuiltins: {preset: 'auto'}
			}]
		}
	}
];
