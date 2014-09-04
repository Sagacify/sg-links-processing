var cheerio = require('cheerio');
var sanitize = require('node-lib').sanitize;

var HTMLService = {

	htmlToDom: function (html) {
		var $ = cheerio.load(html);

		return $;
	},

	getText: function ($) {
		var body = $('body').eq(0).clone();

		$('script', body).remove();
		$('iframe', body).remove();
		$('link', body).remove();
		$('code', body).remove();

		var text = body.eq(0).text();

		text = sanitize.clearText(text);

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

		title = sanitize.clearText(title);

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
	
		description = sanitize.clearText(description);

		return description;
	},

	getKeywords: function ($) {
		var keywords = $('meta[name="keywords"]').attr('content');

		if(!keywords) {
			keywords = '';
		}
	
		keywords = sanitize.clearText(keywords);
		keywords = keywords.split(/\s?,\s?/);

		return keywords;
	}
};

module.exports = HTMLService;