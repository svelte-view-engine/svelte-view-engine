let indentOrWhiteSpaceOnlyLine = /^\s*/gm;

module.exports = function(str) {
	return str.replace(indentOrWhiteSpaceOnlyLine, "");
}
