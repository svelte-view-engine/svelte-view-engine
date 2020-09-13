let ws = require("ws");
let fs = require("flowfs");
let bluebird = require("bluebird");
let getPort = require("get-port");
let isElectron = require("./utils/isElectron");
let Page = require("./Page");
let Template = require("./Template");
let buildScheduler = require("./buildScheduler");

module.exports = class {
	constructor(config) {
		this.config = config;
		this.dir = config.dir;
		this.type = config.type;
		this.buildDir = fs(config.buildDir).child(config.env).path;
		
		this.template = new Template(config);
		
		this.scheduler = buildScheduler(config);
		this.pages = {};
		this.init();
		this.render = this.render.bind(this);
	}
	
	async init() {
		if (this.config.liveReload && !isElectron) {
			let port = await getPort();
			
			let socket = new ws.Server({
				port,
			});
			
			this.liveReload = {
				port,
				socket,
			};
			
			// remove default EventEmitter limit
			socket.setMaxListeners(0);
		}
		
		if (this.config.init) {
			this.initPages();
		}
	}
	
	createPage(path) {
		return new Page(this, path);
	}
	
	async createPages() {
		if (this.pagesCreated) {
			return;
		}
		
		let files = await fs(this.config.dir).glob("**/*." + this.config.type);
		
		for (let node of files) {
			this.pages[node.path] = this.createPage(node.path);
		}
		
		this.pagesCreated = true;
	}

	async awaitPendingBuilds() {
		await this.scheduler.awaitPendingBuilds();
	}
	
	hasPendingBuilds() {
		return this.scheduler.hasPendingBuilds();
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
	date); and on prod -- on prod, use prebuilt pages.
	*/
	
	async buildPages(pages=null) {
		await this.createPages();
		
		if (pages) {
			for (let path of pages) {
				this.scheduler.scheduleBuild(this.pages[path]);
			}
		} else {
			await fs(this.config.buildDir).rmrf();
			
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
		await this.createPages();
		
		await bluebird.map(Object.values(this.pages), page => page.init());
	}
	
	async render(path, locals, callback, forEmail=false) {
		if (!this.template.ready) {
			await this.template._init();
		}
		
		if (path[0] !== "/") {
			path = this.dir + "/" + path + "." + this.type;
		}
		
		let sendLocals = {};
		
		if (!this.pages[path]) {
			this.pages[path] = this.createPage(path);
		}
		
		let page = this.pages[path];
		
		for (let p in locals) {
			if (!this.config.excludeLocals.includes(p)) {
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
	
	renderEmail(path, locals, callback) {
		return this.render(path, locals, callback, true);
	}
}
