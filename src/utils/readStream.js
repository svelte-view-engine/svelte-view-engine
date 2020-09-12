module.exports = function(stream) {
	stream.setEncoding("utf8");
	
	return new Promise(function(resolve, reject) {
		let res = "";
		
		stream.on("data", function(chunk) {
			res += chunk;
		});
		
		stream.on("end", function() {
			resolve(res);
		});
		
		stream.on("error", function(error) {
			reject(error);
		});
	});
}
