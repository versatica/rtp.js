import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';
import { globSync } from 'glob';

// Tell rollup explicitly that we don't want to include external dependencies
// in bundle files.
const external = id => !/^[./]/.test(id);

export default [
	/**
	 * Create ES and CJS bundle files for index.ts and source map files.
	 */
	{
		input: 'src/index.ts',
		plugins: [esbuild({ include: /\.ts$/ })],
		output: [
			{
				format: 'es',
				file: 'lib/rtpjs-bundle.mjs',
				sourcemap: true,
			},
			{
				format: 'cjs',
				file: 'lib/rtpjs-bundle.cjs',
				sourcemap: true,
			},
		],
		external: external,
	},
	/**
	 * Create a .d.ts bundle file for TypeScript types.
	 */
	{
		input: 'src/index.ts',
		plugins: [dts({ include: /\.ts$/ })],
		output: {
			format: 'es',
			file: 'lib/rtpjs-bundle.d.ts',
		},
		external: external,
	},
	/**
	 * Create ES and CJS bundles of index.ts, packets.ts and utils.ts and also
	 * source map files.
	 *
	 * NOTE: We also need to bundle utils/helpers.ts because it's used by
	 * packets.ts and, if not specified, rollup will generate two helpers-xxx.js
	 * files, one ES and another one CJS, and will make Node believe that both
	 * are CJS due to their .js extension.
	 */
	{
		input: [
			'src/index.ts',
			'src/packets.ts',
			'src/utils.ts',
			'src/utils/helpers.ts',
		],
		plugins: [esbuild({ include: /\.ts$/ })],
		output: [
			{
				format: 'es',
				dir: 'lib',
				entryFileNames: '[name].mjs',
				sourcemap: true,
			},
			{
				format: 'cjs',
				dir: 'lib',
				entryFileNames: '[name].cjs',
				sourcemap: true,
			},
		],
		external: external,
	},
	/**
	 * Create a .d.ts file for each .ts file.
	 */
	{
		input: Object.fromEntries(
			globSync('src/**/*.ts', { ignore: 'src/test/**' }).map(file => [
				path.relative(
					'src',
					file.slice(0, file.length - path.extname(file).length)
				),

				fileURLToPath(new URL(file, import.meta.url)),
			])
		),
		output: {
			format: 'es',
			dir: 'lib',
		},
		plugins: [dts({ include: /\.ts$/ })],
	},
];
