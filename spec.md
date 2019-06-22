Tenets:

- each page is a svelte component, but you render it manually like a view, it's not done automatically like a framework (sapper)

- pages are built by the server, not the build system -- the build system is integrated into the server.  this avoids having src/ and lib/ -- the server can cache the artifacts internally or in an aribtrary /tmp dir or e.g. memcached; you only ever see the source.

- everything is inlined -- the entire app (html, css, js) is delivered as a single stream

- SSR & hydration

so basically Sapper, but the framework is limited to the concern of render()ing a svelte component in the most efficient way possible, without the user having to bother about config or using an opinionated framework.

res.render("Home.svelte", {
	// props
});
