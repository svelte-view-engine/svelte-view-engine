let buildSsrComponent = require("./buildSsrComponent");
let buildDomComponent = require("./buildDomComponent");

module.exports = async (path, options) => {
	let Component = await buildSsrComponent(path, options);
	let {head, html, css} = Component.render();
	let {js, watchFiles} = await buildDomComponent(path, options);
	
	return {
		head,
		html,
		js,
		css,
		watchFiles,
	};
}
