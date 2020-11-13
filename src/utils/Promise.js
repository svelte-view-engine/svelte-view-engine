/*
Promise that can be resolved/rejected from outside
*/

module.exports = function() {
	let resolve;
	let reject;
	
	let promise = new Promise(function(res, rej) {
		resolve = res;
		reject = rej;
	});
	
	promise.resolve = resolve;
	promise.reject = reject;
	
	return promise;
}
