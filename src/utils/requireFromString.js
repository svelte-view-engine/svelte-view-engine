let os = require("os");
let fs = require("flowfs");

module.exports = async (code) => {
	let tmpFile = fs(os.tmpdir()).child((new Date).valueOf().toString() + Math.random());
	
	await tmpFile.write(code);
	
	let module = require(tmpFile.path);
	
	tmpFile.delete();
	
	return module;
}
