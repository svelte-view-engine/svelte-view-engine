let {exec} = require("child_process");

module.exports = function(cmd, stdin=null) {
	return new Promise(function(resolve, reject) {
		let child = exec(cmd.replace(/\n/g, " "), function(error, stdout, stderr) {
			if (stdout) {
				console.log(stdout);
			}
			
			if (stderr) {
				console.error(stderr);
			}
			
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
		
		if (stdin) {
			child.stdin.write(stdin);
		}
		
		child.stdin.end();
	});
}
