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
		buildScript: null,
		buildDir: null,
		
		template: null,
		payloadFormat: "json",
		
		watch: dev,
		liveReload: dev,
		liveReloadPort: 5000 + Math.floor(Math.random() * 60535),
		verbose: dev,
		saveJs: dev,
		
		transpile: !dev,
		minify: !dev,
		
		excludeLocals: [
			"_locals",
			"settings",
			"cache",
		],
		
		dev,
		stores: null,
		
		/*
		not sure if needed
		*/
		rebuildOnRenderError: false,
		
		/*
		for dev -- don't wait for all pages to build before rendering
		with init option (we want quick inits if the build files are
		there, but also to be able to delete all build files and then
		render while initing)
		
		this is disabled by default to prevent pages from being rendered
		while initing, as trying to build the same page twice at the same
		time can cause errors
		*/
		renderBeforeInit: false,
	}, opts);
	
	return new Engine(options);
}
