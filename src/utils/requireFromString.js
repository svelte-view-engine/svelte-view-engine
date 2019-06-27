let fs = require("flowfs");
let tmp = require("tmp");
let util = require("util");

module.exports = async (code) => {
	let tmpFile = fs(await util.promisify(tmp.tmpName)());
	
	await tmpFile.write(code);
	
	let module = require(tmpFile.path);
	
	tmpFile.delete();
	
	return module;
}
