let rollup = require("rollup");
let svelte = require("rollup-plugin-svelte");
let resolve = require("rollup-plugin-node-resolve");
let commonjs = require("rollup-plugin-commonjs");
let {terser} = require("rollup-plugin-terser");

module.exports = async (path) => {
	let allCss = [];
	
	let options = {
		input: {
			input: path,
			plugins: [
				svelte({
					dev: true, // TODO process.env.NODE_ENV
					// we'll extract any component CSS out into
					// a separate file — better for performance
					css: (css) => {
						allCss.push(css);
					},
					//preprocess: {
					//	style: sass
					//},
					generate: "ssr",
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
		
				// Watch the `public` directory and refresh the
				// browser on changes when not in production
				//!production && livereload("public"),
		
				// If we're building for production (npm run build
				// instead of npm run dev), minify
				//production && terser()
			],
		},
		output: {
			format: "cjs",
			name: "Page",
			sourcemap: true,
		},
	};
	
	let bundle = await rollup.rollup(options.input);
	
	let {output} = await bundle.generate(options.output);
	
	for (let chunk of output) {
		if (chunk.isAsset) {
			// not sure what assets are, but our css is handled by Svelte.
		} else {
			console.log("Chunk");
			console.log(chunk.code);
		}
	}
	
	console.log(allCss);
}
