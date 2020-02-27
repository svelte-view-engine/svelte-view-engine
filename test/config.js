let fs = require("flowfs");

function here(path) {
	return fs(__dirname).child(path).path;
}

module.exports = function(overrides) {
	return Object.assign({
		template: here("./template.json"),
		dir: here("./pages"),
		type: "html",
		buildScript: here("./build.js"),
		buildDir: here("./build"),
		watch: false,
		buildConcurrency: 2,
		verbose: false,
	}, overrides);
}
