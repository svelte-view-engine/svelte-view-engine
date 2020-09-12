let {dirname} = require("path");
let sassCompiler = require("node-sass");

module.exports = async function({filename, content, attributes}) {
	let {css, stats} = await new Promise(function(resolve, reject) {
		sassCompiler.render({
			file: filename,
			data: content,
			includePaths: [
				dirname(filename),
			],
		}, function(err, result) {
			if (err) {
				reject(err);
			} else {
				resolve(result);
			}
		});
	});
	
	return {
		code: css.toString(),
		dependencies: stats.includedFiles,
	};
}
