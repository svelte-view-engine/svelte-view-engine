#!/usr/bin/env node

let fs = require("flowfs");
let yargs = require("yargs");
let findConfigFile = require("./utils/findConfigFile");
let svelteViewEngine = require("..");
let CONFIG_FILENAME = require("./configFilename");

function error(message) {
	console.error(message);
	process.exit(1);
}

let configFile = findConfigFile();

if (!configFile) {
	error("No config file (" + CONFIG_FILENAME + ") found");
}

let config = require(configFile);

let [command, ...args] = yargs.argv._;

let commands = {
	async build(env, ...pages) {
		if (!env) {
			env = "prod";
		}
		
		let engine = svelteViewEngine({
			...config,
			env,
			init: false,
		});
		
		pages = pages.map(p => fs(config.dir).child(p).withExt("." + config.type).path);
		
		if (pages.length > 0) {
			await engine.buildPages(pages);
		} else {
			await engine.buildPages();
		}
	},
};

if (!command) {
	error("No command specified (available commands: " + Object.keys(commands).join(", ") + ")");
}

if (!commands[command]) {
	error("Unrecognised command " + command + " (available commands: " + Object.keys(commands).join(", ") + ")");
}

commands[command](...args);
