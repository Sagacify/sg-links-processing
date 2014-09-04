var cheerio = require('cheerio');
var sanitize = require('node-lib').sanitize;

function HTMLService(html) {
	var $ = cheerio.load(html);
	this.$ = function () {
		return $;
	}();
}

HTMLService.prototype.getText = function () {
	this._execute(ConcreteService.getText);
};

HTMLService.prototype.getTitle = function () {
	this._execute(ConcreteService.getTitle);
};

HTMLService.prototype.getDescription = function () {
	this._execute(ConcreteService.getDescription);
};

HTMLService.prototype.getKeywords = function () {
	this._execute(ConcreteService.getKeywords);
};

HTMLService.prototype.getImage = function () {
	this._execute(ConcreteService.getImage);
};

HTMLService.prototype._execute = function (command) {
	return sanitize.clearText(command(this.$));
};

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

		keywords = keywords.split(/\s?,\s?/);

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