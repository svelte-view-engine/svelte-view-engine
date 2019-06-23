let rollup = require("rollup");
let svelte = require("rollup-plugin-svelte");
let resolve = require("rollup-plugin-node-resolve");
let commonjs = require("rollup-plugin-commonjs");
let {terser} = require("rollup-plugin-terser");
let requireFromString = require("require-from-string");
let fs = require("flowfs");

/*
input: path to a .svelte file

output: client-side Svelte component bundle as a string of JS in iife format
*/

module.exports = async (path) => {
	let inputOptions = {
		input: path,
		plugins: [
			svelte({
				dev: true, // TODO process.env.NODE_ENV
				// TODO accept extra svelte options (inc preprocess) as args
				//preprocess: {
				//	style: sass
				//},
				hydratable: true,
			}),
	
			// If you have external dependencies installed from
			// npm, you'll most likely need these plugins. In
			// some cases you'll need additional configuration —
			// consult the documentation for details:
			// https://github.com/rollup/rollup-plugin-commonjs
			resolve({
				browser: true
			}),
			
			commonjs(),
	
			//!production && livereload("public"),
	
			//production && terser()
		],
	};
	
	let outputOptions = {
		format: "iife",
		name: fs(path).basename,
	};
	
	let bundle = await rollup.rollup(inputOptions);
	
	let {output} = await bundle.generate(outputOptions);
	
	return output[0];
}
