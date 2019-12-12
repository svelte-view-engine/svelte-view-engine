let {exec} = require("child_process");
let util = require("util");

let asyncExec = util.promisify(exec);

module.exports = async function(cmd) {
	let {stdout, stderr} = await asyncExec(cmd.replace(/\n/g, " "));
	
	if (stdout) {
		console.log(stdout);
	}
	
	if (stderr) {
		console.error(stderr);
	}
}
