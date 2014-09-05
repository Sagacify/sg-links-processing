var cheerio = require('cheerio');
var sanitize = require('node-lib').sanitize;
var url = require('url');

function HTMLService(html) {
	var $ = cheerio.load(html);
	this.$ = function () {
		return $;
	};
}

HTMLService.prototype.getText = function () {
	return _proxy(ConcreteService.getText(this.$()));
};

HTMLService.prototype.getTitle = function () {
	return _proxy(ConcreteService.getTitle(this.$()));
};

HTMLService.prototype.getDescription = function () {
	return _proxy(ConcreteService.getDescription(this.$()));
};

HTMLService.prototype.getKeywords = function () {
	var keywords = _proxy(ConcreteService.getKeywords(this.$()));
	return keywords.split(/\s?,\s?/);
};

HTMLService.prototype.getImage = function (link) {
	var image = _proxy(ConcreteService.getImage(this.$()));

	if (image && link) {
		return url.resolve(link, image);
	}

	return image;
};

function _proxy(command) {
	return sanitize.clearText(command);
}

var ConcreteService = {

	getText: function ($) {
		var body = $('body').eq(0).clone();

		$('script', body).remove();
		$('iframe', body).remove();
		$('link', body).remove();
		$('code', body).remove();

		var text = body.eq(0).text();

		return text;
	},

	getTitle: function ($) {
		var title = $('meta[property="og:title"]').eq(0).attr('content');

		if(!title) {
			title = $('title').eq(0).text();
		}

		if(!title) {
			title = '';
		}

		return title;
	},

	getDescription: function ($) {
		var description = $('meta[property="og:description"]').eq(0).attr('content');

		if(!description) {
			description = $('meta[name="description"]').eq(0).attr('content');
		}

		if(!description) {
			description = '';
		}

		return description;
	},

	getKeywords: function ($) {
		var keywords = $('meta[name="keywords"]').attr('content');

		if(!keywords) {
			keywords = '';
		}

		return keywords;
	},

	getImage: function ($) {
		var ogImage = $("meta[property='og:image']").attr("content");

		if(!ogImage) {
			ogImage = '';
		}

		return ogImage;
	}
};

module.exports = HTMLService;