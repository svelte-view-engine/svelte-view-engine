let rollup = require("rollup");
let svelte = require("rollup-plugin-svelte");
let resolve = require("rollup-plugin-node-resolve");
let commonjs = require("rollup-plugin-commonjs");
let {terser} = require("rollup-plugin-terser");
let fs = require("flowfs");
let merge = require("lodash.merge");

/*
input: path to a .svelte file

output: client-side Svelte component bundle as a string of JS in IIFE format;
and an array of files to watch for changes
*/

module.exports = async (path, name, options, cache) => {
	let inputOptions = {
		input: path,
		cache,
		plugins: [
			svelte(merge({
				hydratable: true,
				// TODO:
				// client-side CSS is needed in dev because the bundle doesn't write
				// any unchanged components' CSS when using cache (see issue below)
				// using client-side CSS is OK for dev but not prod as you get a FOUC
				// but we won't be using cache in prod anyway, so if the issue
				// doesn't get resolved we could leave it like this, as it only
				// affects dev
				// https://github.com/rollup/rollup-plugin-svelte/issues/62
				// if the issue is resolved it can just be false
				css: options.svelte.dev,
			}, options.svelte)),
	
			resolve({
				browser: true
			}),
			
			commonjs(),
	
			options.minify && terser()
		]
	};
	
	let outputOptions = {
		format: "iife",
		name,
	};
	
	let bundle = await rollup.rollup(inputOptions);
	
	let {output} = await bundle.generate(outputOptions);
	
	return {
		cache: bundle.cache,
		js: output[0],
		watchFiles: bundle.watchFiles,
	};
}
