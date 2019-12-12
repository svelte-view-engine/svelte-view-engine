let Page = require("./Page");
let Template = require("./Template");
let ws = require("ws");
let fs = require("flowfs");

module.exports = function(opts={}) {
	let dev = process.env.NODE_ENV !== "production";
	
	let options = Object.assign({
		dir: null,
		type: "html",
		init: true,
		template: null,
		buildScript: null,
		watch: dev,
		liveReload: dev,
		liveReloadPort: 5000 + Math.floor(Math.random() * 60535),
		transpile: !dev,
		minify: !dev,
		excludeLocals: [
			"_locals",
			"settings",
			"cache",
		],
		dev,
	}, opts);
	
	let liveReloadSocket;
	
	if (options.liveReload) {
		liveReloadSocket = new ws.Server({
			port: options.liveReloadPort,
		});
	}
	
	let pages = {};
	
	let template = new Template(options.template, {
		watch: options.watch,
	});
	
	function createPage(path) {
		return new Page(template, path, options, liveReloadSocket);
	}
	
	/*
	prebuild function is called if the init option is true.  it is also
	exposed for more fine-grained control, e.g. a script that prebuilds the
	pages then exits to free up memory
	
	the keep argument saves memory for standalone prebuild scripts -- if
	we're caching to files, we don't need to keep the pages in memory
	*/
	
	async function prebuild(keep=false) {
		let files = await fs(options.dir).glob("**/*." + options.type);
		
		for (let node of files) {
			let page = createPage(node.path);
			
			if (keep) {
				pages[node.path] = page;
			}
			
			await page.build();
		}
	}
	
	if (options.init) {
		prebuild(true);
	}
	
	return {
		dir: options.dir,
		type: options.type,
		
		prebuild,
		
		async render(path, locals, callback) {
			let sendLocals = {};
			
			for (let p in locals) {
				if (!options.excludeLocals.includes(p)) {
					sendLocals[p] = locals[p];
				}
			}
			
			if (!pages[path]) {
				pages[path] = createPage(path);
			}
			
			try {
				let result = await pages[path].render(sendLocals);
				
				if (callback) {
					callback(null, result);
				} else {
					return result;
				}
			} catch (e) {
				delete pages[path];
				
				if (callback) {
					callback(e);
				} else {
					throw e;
				}
			}
		},
	}
}
