let Page = require("./Page");
let Template = require("./Template");
let ws = require("ws");
let fs = require("flowfs");

module.exports = (opts={}) => {
	let dev = process.env.NODE_ENV !== "production";
	
	let options = Object.assign({
		dir: "./pages",
		type: "html",
		init: true,
		template: null,
		watch: dev,
		liveReload: dev,
		liveReloadPort: 5000 + Math.floor(Math.random() * 60535),
		minify: !dev,
		excludeLocals: [
			"_locals",
			"settings",
			"cache",
		],
		dev,
	}, opts);
	
	let liveReloadSocket = new ws.Server({
		port: options.liveReloadPort,
	});
	
	let pages = {};
	let template = new Template(options.template, options);
	
	let createPage = (path) => {
		return new Page(template, path, options, liveReloadSocket);
	}
	
	if (options.init) {
		(async () => {
			let files = await fs(options.dir).glob("**/*." + options.type);
			
			for (let node of files) {
				let page = createPage(node.path);
				
				pages[node.path] = page;
				
				page.build();
			}
		})();
	}
	
	return async (path, locals, callback) => {
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
			if (callback) {
				callback(e);
			} else {
				throw e;
			}
		}
	}
}
