let Page = require("./Page");
let Template = require("./Template");
let merge = require("lodash.merge");
let ws = require("ws");

module.exports = (opts) => {
	let dev = process.env.NODE_ENV !== "production";
	
	let options = merge({
		template: null,
		watch: dev,
		liveReload: dev,
		// this will throw an error if the port is in use, so the process
		// manager (e.g. pm2) will restart until we find an open one
		// (was gonna use portfinder but it means making all this stuff
		// async).  if you really want guaranteed unused ports you can
		// just set the option
		liveReloadPort: 5000 + Math.floor(Math.random() * 60535),
		minify: !dev,
		useLocalsForSsr: false,
		svelte: {
			dev,
		},
		excludeLocals: [
			"_locals",
			"settings",
			"cache",
		],
	}, opts);
	
	if (opts.excludeLocals) {
		options.excludeLocals = opts.excludeLocals;
	}
	
	let liveReloadSocket = new ws.Server({
		port: options.liveReloadPort,
	});
	
	let pages = {};
	let template = new Template(options.template, options);
	
	return async (path, locals, callback) => {
		let sendLocals = {};
		
		for (let p in locals) {
			if (!options.excludeLocals.includes(p)) {
				sendLocals[p] = locals[p];
			}
		}
		
		if (!pages[path]) {
			pages[path] = new Page(template, path, options, liveReloadSocket);
		}
		
		try {
			callback(null, await pages[path].render(sendLocals));
		} catch (e) {
			callback(e);
		}
	}
}
