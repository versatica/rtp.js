/**
 * This is needed for Jest tests only.
 */

module.exports = {
	presets: [
		['@babel/preset-env', { targets: { node: 'current' } }],
		'@babel/preset-typescript',
	],
};
