let fs = require("fs");
let flowfs = require("flowfs");
let {CONFIG_FILENAME} = require("../constants");

module.exports = function() {
	let dir = flowfs(process.cwd());
	
	while (true) {
		let file = dir.child(CONFIG_FILENAME).path;
		
		if (fs.existsSync(file)) {
			return file;
		}
		
		if (dir.isRoot) {
			break;
		} else {
			dir = dir.parent;
		}
	}
	
	return null;
}
