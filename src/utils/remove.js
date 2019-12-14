module.exports = function(array, item) {
	let index;
	
	while ((index = array.indexOf(item)) !== -1) {
		array.splice(index, 1);
	}
}
