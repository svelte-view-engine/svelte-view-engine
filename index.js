let Page = require("./src/Page");
let Template = require("./Template");
let fs = require("flowfs");
let chokidar = require("chokidar");

module.exports = (options) => {
	let pages = {};
	let template = new Template(options.template, options.watch);
	
	return async (path, locals, callback) => {
		if (!pages[path]) {
			pages[path] = new Page(template, path, options.watch);
		}
		
		callback(await pages[path].render(locals));
	}
}
