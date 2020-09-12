let babel = require("@babel/core");
let rollup = require("rollup");
let resolve = require("rollup-plugin-node-resolve");
let commonjs = require("rollup-plugin-commonjs");
let fs = require("flowfs");

module.exports = async function(path, name, code) {
	let js = await babel.transformAsync(code, {
		presets: [
			["@babel/env", {
				targets: "ie 9",
				useBuiltIns: "usage",
				corejs: 3,
			}],
		],
	});
	
	let origFile = fs(path);
	let file = origFile.sibling(origFile.basename + ".babel.js");
	
	// await origFile.sibling(origFile.basename + ".cjs.js").write(code);
	
	await file.write(js.code);
	
	let bundle = await rollup.rollup({
		input: file.path,
		
		plugins: [
			resolve({
				browser: true,
			}),
			
			commonjs(),
		],
	});
	
	let {output} = await bundle.generate({
		name,
		format: "iife",
	});
	
	file.delete();
	
	return output[0];
}
