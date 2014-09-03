var Cheerio = require('cheerio');
var Sanitize = require('node-lib').sanitize;

var HTMLService = {

	htmlToDom: function (html) {
		var $ = Cheerio.load(html);

		return $;
	},

	getText: function ($) {
		var body = $('body').eq(0).clone();

		$('script', body).remove();
		$('iframe', body).remove();
		$('link', body).remove();
		$('code', body).remove();

		var text = body.eq(0).text();

		text = Sanitize.clearText(text);

		return text;
	},

	getTitle: function ($) {
		var title = $('meta[property="og:title"]').eq(0).attr('content');

		if(!title) {
			title = $('title').text();
		}

		if(!title) {
			title = '';
		}

		title = Sanitize.clearText(title);

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
	
		description = Sanitize.clearText(description);

		return description;
	},

	getKeywords: function ($) {
		var keywords = $('meta[name="keywords"]').attr('content');

		if(!keywords) {
			keywords = '';
		}
	
		keywords = Sanitize.clearText(keywords);
		keywords = keywords.split(/\s?,\s?/);

		return keywords;
	}

};

module.exports = HTMLService;
