let snakeToTitle = (str) => {
	return `-${str}`.replace(/-(\w)/g, (_, letter) => {
		return letter.toUpperCase();
	}).replace("-", "");
}

module.exports = (str) => {
	str = snakeToTitle(str);
	
	if (str.match(/^\d/)) {
		str = "_" + str;
	}
	
	return str.replace(/[^\w\d]/g, "");
}
