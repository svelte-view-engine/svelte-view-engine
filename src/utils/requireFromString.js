let fs = require("flowfs");

module.exports = async function(code, path) {
	let tmpFile = fs(path);
	
	await tmpFile.write(code);
	
	delete require.cache[require.resolve(tmpFile.path)];
	
	let module = require(tmpFile.path);
	
	tmpFile.delete();
	
	return module;
}
