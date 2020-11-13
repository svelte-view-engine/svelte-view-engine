let {spawn} = require("child_process");
let {default: parseCommand} = require("string-argv");
let Promise = require("./Promise");

module.exports = function(cmd, stdin=null) {
	let promise = Promise();
	let [command, ...args] = parseCommand(cmd.replace(/\n/g, " "));
	
	let child = spawn(command, args, {
		stdio: ["pipe", "inherit", "inherit"],
	});
	
	if (stdin) {
		child.stdin.write(stdin);
	}
	
	child.stdin.end();
	
	child.on("exit", function(code) {
		if (code === 0) {
			promise.resolve();
		} else {
			promise.reject(code);
		}
	});
	
	return {
		child,
		promise,
	};
}
