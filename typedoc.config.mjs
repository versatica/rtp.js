/**
 * This is the configuration for Typedoc.
 *
 * NOTE: We don't set entryPoints because we make Typedoc rely on the "typedoc"
 * entries in "exports" in package.json. Those "typedoc" entries must be
 * located before "types", otherwise Typedoc reads the "types" ones (the built
 * .d.ts files in lib) and, if lib is not built, those modules are missing in
 * the docs.
 */

/** @type {Partial<import('typedoc').TypeDocOptions>} */
const config = {
	out: 'docs',
	skipErrorChecking: false,
	excludePrivate: true,
	excludeProtected: true,
	excludeNotDocumented: false,
	excludeInternal: true,
	excludeExternals: true,
	includeVersion: true,
	gitRemote: 'origin',
	hideGenerator: false,
	treatWarningsAsErrors: true,
	cacheBust: true,
	categorizeByGroup: false,
	sort: ['kind', 'source-order'],
	sortEntryPoints: false,
	searchInComments: true,
	readme: 'README.md',
	projectDocuments: ['README.md', 'LICENSE.md'],
	validation: {
		notExported: true,
		invalidLink: true,
		invalidPath: true,
		rewrittenLink: true,
		notDocumented: true,
		unusedMergeModuleWith: true,
	},
	navigation: {
		includeCategories: false,
		includeGroups: false,
		includeFolders: true,
		compactFolders: true,
	},
	navigationLinks: {
		GitHub: 'https://github.com/versatica/rtp.js',
		NPM: 'https://www.npmjs.com/package/rtp.js',
	},
	customCss: './docs-assets/custom-styles.css',
};

export default config;
