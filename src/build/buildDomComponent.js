let fs = require("flowfs/mkdirp");
let rollup = require("rollup");
let svelte = require("rollup-plugin-svelte");
let resolve = require("rollup-plugin-node-resolve");
let commonjs = require("rollup-plugin-commonjs");
let terser = require("terser");
let babel = require("./babel");
let sass = require("./sass");

let pathStartRe = /([A-Z]:|\/)/;

module.exports = async function(path, name, config, cache) {
	let buildDirFull = fs(config.buildDir).child(config.env);
	let prod = config.env === "prod";
	let dev = !prod;
	let {dynamicImports} = config;
	let transpile = prod && !dynamicImports;
	let minify = prod;
	
	let inputOptions = {
		input: path,
		cache,
		
		plugins: [
			svelte({
				hydratable: true,
				
				preprocess: {
					style: sass,
				},
				
				css: dev,
				
				onwarn() {},
				
				dev,
			}),
	
			resolve({
				browser: true,
			}),
			
			commonjs(),
		],
	};
	
	/*
	if we're transpiling, do CJS instead of IIFE.  this is because babel with
	useBuiltIns: "usage" (required for converting async/await) adds CJS
	requires for core-js.  The babel code takes a CJS module, babels it, then
	rolls it up into an IIFE (so with transpilation it ends up being rolled up
	twice)
	*/
	
	let outputOptions = {
		name,
		format: dynamicImports ? "es" : (transpile ? "cjs" : "iife"),
	};
	
	let bundle = await rollup.rollup(inputOptions);
	
	let {output} = await bundle.generate(outputOptions);
	
	if (dynamicImports) {
		await bundle.write({
			dir: fs(path).parent.reparent(config.dir, buildDirFull).path,
		});
	}
	
	let js = output[0];
	
	if (transpile) {
		js = await babel(path, name, js.code);
	}
	
	if (minify) {
		js = terser.minify(js.code);
	}
	
	return {
		cache: dev && bundle.cache,
		js,
		
		watchFiles: bundle.watchFiles.map(function(path) {
			/*
			some paths have markers from rollup plugins - strip these for watching
			
			some are also not absolute; these are also internal to rollup and can
			be stripped
			*/
			
			let start = path.match(pathStartRe);
			
			if (start) {
				return path.substr(start.index);
			} else {
				return false;
			}
		}).filter(Boolean),
	};
}
