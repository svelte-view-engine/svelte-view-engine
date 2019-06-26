let Page = require("./Page");
let Template = require("./Template");
let merge = require("lodash.merge");

module.exports = (opts) => {
	let dev = process.env.NODE_ENV !== "production";
	
	let options = merge({
		template: null,
		watch: dev,
		liveReload: dev,
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
			pages[path] = new Page(template, path, options);
		}
		
		try {
			callback(null, await pages[path].render(sendLocals));
		} catch (e) {
			callback(e);
		}
	}
}
