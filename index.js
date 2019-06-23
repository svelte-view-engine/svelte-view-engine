module.exports = (options) => {
	return (path, locals, callback) => {
		console.log(path, locals);
		
		callback(null, "<h1>test</h1>");
	}
}
