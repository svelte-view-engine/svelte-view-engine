let Page = require("./src/Page");
let Template = require("./src/Template");

module.exports = (options) => {
	let pages = {};
	let template = new Template(options.template, options.watch);
	
	return async (path, locals, callback) => {
		if (!pages[path]) {
			pages[path] = new Page(template, path, options.watch);
		}
		
		callback(null, await pages[path].render(locals));
	}
}
