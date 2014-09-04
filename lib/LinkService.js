// Node.js core module
var path = require('path');

// NPM modules
var request = require('request');
var typeis = require('type-is');
var tmp = require('tmp');

// SSH modules
var webshot = require('webshot');

var sgFilesSystem = require('sg-files-system');
var FSService = sgFilesSystem.FSService;
var S3Service = sgFilesSystem.S3Service;

var SgMessagingServer = require('sg-messaging-server');
var sgMessagingServer;

// node-lib modules
var validate = require('node-lib').validateFormat;

var HTMLService = require('./HTMLService');

exports.launch = function (link, s3Config, redisConfig, callback) {
	var s3Service = new S3Service(s3Config);
	sgMessagingServer = new SgMessagingServer(redisConfig);

	exports.createLink(link, s3Service, callback);
};

exports.createLink = function (link, s3ServiceOrConfig, callback) {
	var s3Service = s3ServiceOrConfig;

	if (!s3ServiceOrConfig instanceof S3Service) {
		s3Service = new S3Service(s3ServiceOrConfig);
	}

	var url = link.url || link._id;
	if(url.slice(0, 4) !== 'http') {
		link.url = 'http://' + url;
	}

	console.log('<' + link.url + '>');

	if(!validate.isUrl(link.url)) {
		console.log("Error URL :", link.url);
		return callback(new Error("URL_VALIDATION_FAIL"));
	}

	var self = this;
	request({
		url: link.url,
		agent: false,
		rejectUnauthorized: false,
		timeout: 1 * 60 * 1000
	}, function (error, response, body) {
		if(error) {
			console.log("error:", error);
			return callback(new Error('ERROR - 500 - ' + error));
		}

		var statusCode = response.statusCode;
		console.log("response.statusCode: " + statusCode);
		console.log("response.headers['content-type']:", response.headers['content-type']);

		if(statusCode < 200 && statusCode <= 300) {
			return callback(new Error('ERROR - 500 - link responds with status code: ' + statusCode));
		}

		if(typeof body !== 'string') {
			return callback(new Error('ERROR - 500 - link responds with status code: ' + statusCode));
		}

		if(!typeis(response, ['html'])) {
			if(typeis(response, ['pdf'])) {
				return callback(null, link, true);
			}
			
			return callback(new Error("PAGE_NOT_CONTAINS_HTML"));
		}

		var $ = HTMLService.htmlToDom(body);

		link.title = HTMLService.getTitle($) || link;
		link.keywords = HTMLService.getKeywords($);
		link.contentData = HTMLService.getText($);
		link.description = HTMLService.getDescription($);

		sgMessagingServer().publish('link:' + link._id, {
			link: link
		});

		exports.createWebshot(link.url, s3Service, function (err, filepath) {
			if (err) {
				return callback(err);
			}

			link.snapshots = {
				large: filepath
			};

			var ogImage = $("meta[property='og:image']").attr("content");
			ogImage = sanitize.sanitize(ogImage);

			link.thumbnails = {
				large: ogImage || filepath
			};

			sgMessagingServer().publish('link:' + link._id, {
				link: link
			});

			callback(null, link);
		});
	});
};

// Redirect example : http://www.forbes.com/sites/matthewherper/2014/03/26/once-seen-as-too-scary-editing-peoples-genes-with-viruses-makes-a-618-million-comeback/

exports.createWebshot = function (url, s3Service, callback) {
	tmp.file({
		postfix: '.png'
	}, function (e, filepath) {
		if(e) {
			return callback(e);
		}

		var options = {
			phantomConfig: {
				'ssl-protocol': 'any',
				'ignore-ssl-errors': true
			},
			defaultWhiteBackground: true,
			// https://support.google.com/webmasters/answer/1061943?hl=en
			// userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
			// Chrome 35.0.1916.153
			userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.153 Safari/537.36',
			timeout: 2 * 60 * 1000
		};

		console.log("Ready to snapshot : " + url);

		webshot(url, filepath, options, function (e) {
			if(e) {
				console.log("Phantomjs error: ", e);
				return callback(new Error(e));
			}

			s3Service.uploadThenDeleteLocalFile(filepath, path.basename(filepath), 'png', false, callback);
		});
	});
};