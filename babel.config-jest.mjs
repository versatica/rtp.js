/**
 * This Babel configuration is for TypeScript transpilation to JavaScript CJS
 * files when running Jest with ts-jest.
 *
 * In this case we don't want to replace the .mts extension of imports/exports.
 */

export default {
	presets: [
		[
			'@babel/preset-env',
			{
				// Convert ESM modules to CJS.
				modules: 'commonjs',
				targets: 'defaults',
			},
		],
		['@babel/preset-typescript', { allowDeclareFields: true }],
	],
};
