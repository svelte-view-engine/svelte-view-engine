let render = require("./src/render");
//let options = require("./options");

//let renderer = render(options);

//render("test/Home.svelte");

let Home = require("./test/Home.svelte.js");

console.log(Home.render());
