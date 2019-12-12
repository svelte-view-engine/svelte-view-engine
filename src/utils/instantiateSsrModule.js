let fs = require("flowfs");
let requireFromString = require("./requireFromString");

module.exports = async function(code, path) {
	let tmpPath = fs(path).reExt("js").path;

	return await requireFromString(code, tmpPath);
}
