let rollup = require("rollup");
let svelte = require("rollup-plugin-svelte");
let resolve = require("rollup-plugin-node-resolve");
let commonjs = require("rollup-plugin-commonjs");
let {terser} = require("rollup-plugin-terser");
let merge = require("lodash.merge");
let requireFromString = require("./utils/requireFromString");

/*
input: path to a .svelte file

output: {
	cache,
	component: Component,
	css: {
		code,
		map
	}
}

.cache is passed back in to speed up rebuilds

Component is the module.exports of the Svelte component compiled with generate: ssr
(server-side rendering).  This is an object with a render method, which takes props and returns {html, head, css}.  We don't use .css - see below.

.css is the CSS for the component and all components it imports.  This is different to .component.render().css, which is the CSS from the component instance and all its child components at render time.  Using that one would cause an issue where components that are not there in SSR but get instantiated on the client, wouldn't have their CSS.
*/

module.exports = async (path, options, cache) => {
	let css;
	
	let inputOptions = {
		input: path,
		cache,
		plugins: [
			svelte(merge({
				generate: "ssr",
				
				css: (c) => {
					css = c;
				},
			}, options.svelte)),
	
			resolve({
				browser: true
			}),
			
			commonjs(),
	
			options.minify && terser()
		],
	};
	
	let outputOptions = {
		format: "cjs",
	};
	
	let bundle = await rollup.rollup(inputOptions);
	
	let {output} = await bundle.generate(outputOptions);
	
	return {
		cache: bundle.cache,
		component: await requireFromString(output[0].code),
		css,
	};
}
