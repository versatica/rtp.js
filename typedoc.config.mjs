/**
 * This is the configuration for Typedoc.
 *
 * NOTE: We don't set entryPoints because we make Typedoc rely on the "typedoc"
 * entries in "exports" in package.json. Note that those "typedoc" entries must
 * be located before "import", otherwise Typedoc will read the "import" ones.
 */

/** @type {Partial<import('typedoc').TypeDocOptions>} */
const config = {
	out: 'docs',
	skipErrorChecking: false,
	excludePrivate: true,
	excludeProtected: true,
	excludeNotDocumented: true,
	excludeInternal: true,
	excludeExternals: true,
	includeVersion: true,
	gitRemote: 'origin',
	hideGenerator: false,
	treatWarningsAsErrors: true,
	cacheBust: true,
	categorizeByGroup: false,
	categoryOrder: ['RTP', 'RTCP', 'RTCP Extended Reports', 'Utils', '*'],
	searchInComments: true,
	projectDocuments: ['README.md', 'LICENSE'],
	navigationLinks: {
		GitHub: 'https://github.com/versatica/rtp.js',
		NPM: 'https://www.npmjs.com/package/rtp.js',
	},
	customCss: './docs-assets/custom-styles.css',
};

export default config;
