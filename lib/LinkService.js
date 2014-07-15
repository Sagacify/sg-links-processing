var path = require('path');
var fs = require('fs');

var cheerio = require('cheerio');
var request = require('request');
var tmp = require('tmp');

var webshot = require('webshot');

var sgFilesSystem = require('sg-files-system');
var FSService = sgFilesSystem.FSService;
var S3Service = sgFilesSystem.S3Service;

var SgMessagingServer = require('sg-messaging-server');
var sgMessagingServer = new SgMessagingServer();

var validate = require('node-lib').validateFormat;
var sanitize = require('node-lib').Sanitize;
var contentType = require('node-lib').content_type.ext;

exports.launch = function (link, s3Config, callback) {
	var s3Service = new S3Service(s3Config);

	exports.createLink(link, s3Service, callback);
};

exports.createLink = function (link, s3ServiceOrConfig, callback) {
	var s3Service = s3ServiceOrConfig;

	var url = link.url || link._id;
	link.url = url.startsWith('http') ? url : 'http://' + url;

	console.log('<' + link.url + '>');

	if (!validate.isUrl(link.url)) {
		console.log("Error URL :", link.url);

		return callback(new SGError("URL_VALIDATION_FAIL"));
	}

	var self = this;
	request({
		url: link.url,
		agent: false,
		rejectUnauthorized: false,
		timeout: 1 * 60 * 1000
	}, function (error, response, body) {
		if (error /*|| response.statusCode != 200*/ ) {
			console.log("error:", error);

			if (response) {
				console.log("response.statusCode: " + response.statusCode);
			}

			return callback(new SGError('ERROR', 500, error + '\n\nlink responds with status code ' + response.statusCode));
		}

		if (!response) {
			return callback(new SGError('NO_RESPONSE'));
		}

		if (!body) {
			return callback(new SGError('NO_BODY', 500, 'link responds with status code ' + response.statusCode));
		}

		console.log("response.statusCode:", response.statusCode);
		console.log("response.headers['content-type']:", response.headers['content-type']);

		// Because sometimes response.headers['content-type'] = text/html; charset=UTF-8 for example.
		if (response.headers['content-type'].contains(contentType.getContentType('pdf'))) {
			console.log("response.req.path", response.req.path);
			return exports.getFileFromLink(link, response.req.path);
		}

		var $ = cheerio.load(body);

		link.contentData = sanitize.clearText($('body').text());

		link.title = $("meta[property='og:title']").attr("content") || $("title").text() || link;
		link.title = sanitize.sanitize(link.title);

		link.description = $("meta[property='og:description']").attr("content") || $("meta[name=description]").attr("content") || "";
		link.description = sanitize.sanitize(link.description);
		var keywords = $("meta[name=keywords]").attr("content") || "";
		keywords = sanitize.sanitize(keywords);
		if (keywords) {
			var splitKeywords = keywords.split(',');
			var trimKeywords = [];
			splitKeywords.forEach(function (str) {
				trimKeywords.push(str.trim());
			});
			link.keywords = trimKeywords;
		}

		sgMessagingServer().publish('link:' + link._id, {
			link: link
		});

		exports.createWebshot(link, s3Service, function (err, filepath) {
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

	// req.on('response', function (response) {
	// 	if (response.headers['content-type'] == contentType.getContentType('pdf')) {
	// 		var filename = path.basename(response.req.path);
	// 		fileManager.writeStreamToFileSystem(filename, function (err, filepath, stream) {
	// 			var req = req.pipe(stream);
	// 			stream.on('finish', function () {
	// 				console.log('file downloaded');
	// 				fileManager.getSize(filepath, function (err, size) {
	// 					if (err) {
	// 						return callback(err);
	// 					}
	// 					model('File').createDocument({
	// 						filepath: filepath,
	// 						filename: filename,
	// 						mimetype: mime.lookup(filepath),
	// 						size: size
	// 					}, callback);
	// 				});
	// 			});
	// 			req.on('close', function () {
	// 				console.log("end request");
	// 			});
	// 		});
	// 	}
	// });
};

// Redirect example : http://www.forbes.com/sites/matthewherper/2014/03/26/once-seen-as-too-scary-editing-peoples-genes-with-viruses-makes-a-618-million-comeback/

exports.createWebshot = function (url, s3Service, callback) {
	tmp.file({
		postfix: '.png'
	}, function (err, path) {
		if (err) {
			return callback(err);
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
		webshot(url, path, options, function (err) {
			if (err) {
				console.log("Phantomjs error: ", err);
				return callback(new SGError(err));
			}

			s3Service.uploadThenDeleteLocalFile(path, filename, 'png', false, callback);
		});
	});
};

exports.getFileFromLink = function (link, tempPath) {
	link.filename = path.basename(tempPath);

	FSService.createStreamToFileSystem(link.filename, function (err, filepath, stream) {
		if (err) {
			return callback(err);
		}

		var req = request(link).pipe(stream);

		stream.on('finish', function () {
			console.log('file downloaded');

			link.filepath = filepath;

			sgMessagingServer().publish('link:' + link._id + ':file', {
				link: link
			});
		});

		req.on('close', function () {
			console.log("end request");
		});
	});
};