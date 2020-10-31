let os = require("os");
let fs = require("flowfs");
let Engine = require("./src/Engine");

module.exports = function(config={}) {
	let env = config.env || (process.env.NODE_ENV === "development" ? "dev" : "prod");
	let dev = env === "dev";
	
	return new Engine({
		// common
		
		env,
		template: null,
		dir: null,
		type: "html",
		buildDir: null,
		watch: dev,
		liveReload: dev,
		ssr: true,
		dom: true,
		
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
		buildScript: fs(__dirname).child("src/build/build.js").path,
		root: process.cwd(),
		
		excludeLocals: [
			"_locals",
			"settings",
			"cache",
		],
		
		...config,
	});
}
