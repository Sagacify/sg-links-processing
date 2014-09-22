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
	if (!link || !s3ServiceOrConfig) {
		return callback(new Error('ERROR_ARGUMENTS'));
	}

	var s3Service = s3ServiceOrConfig;

	if (!s3ServiceOrConfig instanceof S3Service) {
		s3Service = new S3Service(s3ServiceOrConfig);
	}

	link.url = link.url || link._id;
	if (link.url.slice(0, 4) !== 'http') {
		link.url = 'http://' + link.url;
	}

	console.log('<' + link.url + '>');

	if (!validate.isUrl(link.url)) {
		console.log("Error URL :", link.url);
		return callback(new Error("URL_VALIDATION_FAIL"));
	}

	var self = this;
	request({
		url: link.url,
		agent: false,
		rejectUnauthorized: false,
		timeout: 1 * 60 * 1000,
		followAllRedirects: true,
		jar: true
	}, function (error, response, body) {
		if (error) {
			console.log("error:", error);
			return callback(new Error('ERROR - 500 - ' + error));
		}

		var statusCode = response.statusCode;
		console.log("response.statusCode: " + statusCode);
		console.log("response.headers['content-type']:", response.headers['content-type']);

		if (statusCode < 200 && statusCode <= 300) {
			return callback(new Error('ERROR - 500 - link responds with status code: ' + statusCode));
		}

		if (typeof body !== 'string') {
			return callback(new Error('ERROR - 500 - link responds with status code: ' + statusCode));
		}

		if (!typeis.is(response.headers['content-type'], ['html'])) {
			return callback(null, link, true);
		}

		var htmlService = new HTMLService(body);

		link.title = htmlService.getTitle() || link;
		link.keywords = htmlService.getKeywords();
		link.contentData = htmlService.getText();
		link.description = htmlService.getDescription();

		if (link.title && link.description && link.title.length > link.description.length) {
            var title = link.title;
            link.title = link.description;
            link.description = title;
        }

        var ogImage = htmlService.getImage(link.url);

        if (ogImage) {
			link.thumbnails = {
				large: ogImage
			};
        }

		sgMessagingServer().publish('link:' + link._id, {
			link: link
		});

		exports.createWebshot(link.url, s3Service, function (err, filepath) {
			if (err && !ogImage) {
				return callback(err);
			}

			if (filepath) {
				link.snapshots = {
					large: filepath
				};

				link.thumbnails = {
					large: ogImage || filepath
				};
			}

			callback(null, link);
		});
	});
};

exports.createWebshot = function (url, s3Service, callback) {
	tmp.file({
		postfix: '.jpg'
	}, function (err, filepath) {
		if (err) {
			return callback(err);
		}

		var options = {
			streamType: 'jpg',
			quality: 80,
			phantomConfig: {
				'ssl-protocol': 'any',
				'ignore-ssl-errors': true
			},
			defaultWhiteBackground: true,
			// https://support.google.com/webmasters/answer/1061943?hl=en
			userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
			timeout: 2 * 60 * 1000
		};

		console.log("Ready to snapshot : " + url);

		webshot(url, filepath, options, function (err) {
			if (err) {
				console.log("Phantomjs error: ", err.message);
				return callback(err);
			}

			s3Service.uploadThenDeleteLocalFile(filepath, path.basename(filepath), 'jpg', false, callback);
		});
	});
};