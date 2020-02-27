let os = require("os");
let Engine = require("./src/Engine");

module.exports = function(opts={}) {
	let dev = process.env.NODE_ENV !== "production";
	
	let options = Object.assign({
		dir: null,
		type: "html",
		init: false,
		build: false,
		buildConcurrency: os.cpus().length,
		template: null,
		payloadFormat: "json",
		buildScript: null,
		buildDir: null,
		watch: dev,
		liveReload: dev,
		liveReloadPort: 5000 + Math.floor(Math.random() * 60535),
		transpile: !dev,
		minify: !dev,
		saveJs: dev,
		verbose: true,
		excludeLocals: [
			"_locals",
			"settings",
			"cache",
		],
		dev,
		stores: null,
		rebuildOnRenderError: false,
	}, opts);
	
	return new Engine(options);
}
