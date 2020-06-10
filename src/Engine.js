let ws = require("ws");
let fs = require("flowfs");
let Bluebird = require("bluebird");
let isElectron = require("./utils/isElectron");
let Page = require("./Page");
let Template = require("./Template");
let buildScheduler = require("./buildScheduler");

module.exports = class {
	constructor(options) {
		this.options = options;
		this.dir = options.dir;
		this.type = options.type;
		
		this.template = new Template(options.template, {
			watch: options.watch,
		});
		
		this.scheduler = buildScheduler(options);
		this.liveReloadSocket = null;
		this.pages = {};
	
		if (options.liveReload && !isElectron) {
			this.liveReloadSocket = new ws.Server({
				port: options.liveReloadPort,
			});
			
			// remove default EventEmitter limit
			this.liveReloadSocket.setMaxListeners(0);
		}
		
		if (options.build) {
			this.buildPages();
		} else if (options.init) {
			this._init = this.initPages();
		}
	}
	
	createPage(path) {
		return new Page(this, path);
	}
	
	async createPages() {
		if (this.pagesCreated) {
			return;
		}
		
		let files = await fs(this.options.dir).glob("**/*." + this.options.type);
		
		for (let node of files) {
			this.pages[node.path] = this.createPage(node.path);
		}
		
		this.pagesCreated = true;
	}
	
	/*
	build/init
	
	build: rebuild all pages.  note -- this deletes the build dir before
	building pages, but if someone somehow manages to request a page while
	there is still an old build file for it (ie. in between app startup
	and the file being deleted), the existing build file will be used.
	
	init: init all pages, assuming an up-to-date build file exists.
	pages are built if there is no build file, but not rebuilt if it is
	out of date.  use this on dev, where it doesn't matter if you see an
	out of date page now and then (watching should keep everything up to
	date); and on prod -- on prod, use prebuilt pages.  this also sets
	.init to a promise that resolves when all pages are init'ed.
	*/

	async awaitPendingBuilds() {
		await this.scheduler.awaitPendingBuilds();
	}
	
	hasPendingBuilds() {
		return this.scheduler.hasPendingBuilds();
	}
	
	async buildPages(pages=null) {
		await this.createPages();
		
		if (pages) {
			for (let path of pages) {
				this.scheduler.scheduleBuild(this.pages[path]);
			}
		} else {
			await fs(this.options.buildDir).rmrf();
			
			for (let page of Object.values(this.pages)) {
				this.scheduler.scheduleBuild(page);
			}
		}
		
		await this.scheduler.awaitPendingBuilds();
	}
	
	/*
	initialise pages (build if necessary)
	*/
	
	async initPages() {
		this.initialising = true;
		
		await this.createPages();
		
		await Bluebird.map(Object.values(this.pages), page => page.init());
	}
	
	async render(path, locals, callback, forEmail=false) {
		if (path[0] !== "/") {
			path = this.dir + "/" + path + "." + this.type;
		}
		
		let sendLocals = {};
		
		if (!this.pages[path]) {
			this.pages[path] = this.createPage(path);
		}
		
		let page = this.pages[path];
		
		for (let p in locals) {
			if (!this.options.excludeLocals.includes(p)) {
				sendLocals[p] = locals[p];
			}
		}
		
		try {
			let result = await page.render(sendLocals, forEmail);
			
			if (callback) {
				callback(null, result);
			} else {
				return result;
			}
		} catch (e) {
			if (callback) {
				callback(e);
			} else {
				throw e;
			}
		}
	}
}
