let fs = require("flowfs");

module.exports = async function(code, path) {
	let tmpFile = fs(path);
	
	await tmpFile.write(code);
	
	let module = require(tmpFile.path);
	
	tmpFile.delete();
	
	return module;
}
