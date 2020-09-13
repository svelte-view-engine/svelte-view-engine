let os = require("os");
let Engine = require("./src/Engine");

module.exports = function(opts={}) {
	let env = opts.env || (process.env.NODE_ENV === "production" ? "prod" : "dev");
	let dev = env === "dev";
	
	let options = {
		// common
		
		env,
		template: null,
		dir: null,
		type: "html",
		buildDir: null,
		watch: dev,
		liveReload: dev,
		
		// occasional
		
		init: true,
		assetsPrefix: "",
		prerender: null,
		payloadFormat: "json",
		svelteDirs: null,
		dynamicImports: false,
		
		// rare
		
		buildConcurrency: os.cpus().length,
		verbose: dev,
		renderBeforeInit: dev,
		
		excludeLocals: [
			"_locals",
			"settings",
			"cache",
		],
		
		...opts,
	};
	
	return new Engine(options);
}
