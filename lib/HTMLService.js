var Entities = require('html-entities').AllHtmlEntities;
var entities = new Entities();
var cheerio = require('cheerio');

var Sanitize = require('node-lib').sanitize;

var HTMLService = {

	htmlToDom: function (html) {
		var $ = cheerio.load(html);

		return $;
	},

	cleanText: function (text) {
		// Remove non-extended-ASCII characters
		text = text.replace(/[^\u0000-\u00ff]/g, '');
		text = text.replace(/\s+/g, ' ');

		text = entities.decode(text);
		text = Sanitize.escapeHTML(text);
		text = text.trim();

		return text;
	},

	getText: function ($) {
		var body = $('body').eq(0).clone();

		$('script', body).remove();
		$('iframe', body).remove();
		$('link', body).remove();
		$('code', body).remove();

		var text = body.eq(0).text();

		text = this.cleanText(text);

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

		title = this.cleanText(title);

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
	
		description = this.cleanText(description);

		return description;
	},

	getKeywords: function ($) {
		var keywords = $('meta[name="keywords"]').attr('content');

		if(!keywords) {
			keywords = '';
		}
	
		keywords = this.cleanText(keywords);
		keywords = keywords.split(/\s?,\s?/);

		return keywords;
	}

};

module.exports = HTMLService;
