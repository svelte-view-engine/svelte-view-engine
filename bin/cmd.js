#!/usr/bin/env node

let fs = require("flowfs");
let yargs = require("yargs");
let findConfigFile = require("./utils/findConfigFile");
let svelteViewEngine = require("..");
let {CONFIG_FILENAME} = require("./constants");

function error(message) {
	console.error(message);
	
	process.exit(1);
}

let configFile = findConfigFile();

if (!configFile) {
	error("No config file (" + CONFIG_FILENAME + ") found");
}

let config = require(configFile);

let [command] = yargs.argv._;

yargs.default({
	env: "prod",
	buildDir: config.buildDir,
});

let {
	env,
} = yargs.argv;

let commands = {
	async build() {
		let {
			buildDir,
		} = yargs.argv;
		
		let engine = svelteViewEngine({
			...config,
			env,
			buildDir,
			init: false,
			watch: false,
			verbose: true,
		});
		
		let [, ...pages] = yargs.argv._;
		
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

commands[command]();
