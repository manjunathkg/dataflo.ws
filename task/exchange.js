var util = require('util'),
	https = require('https'),
	url	= require('url'),
	crypto = require ('crypto'),
	crack = require('crack'),
	task = require('./base'),
	io = require ('./io/easy');

var exchangeConfig = project.config.consumerConfig.exchange;
var wsdlUrl = exchangeConfig.wsdlUrl;
var servicesUrl = exchangeConfig.servicesUrl;

var exchange = module.exports = function (config) {
	this.init (config);
};

util.inherits(exchange, task);

util.extend(exchange.prototype, {
	run: function () {
		this.failed('use method [login|profile|check]');
	},

	login: function () {
		var self = this,
			login = self.credentials.login,
			password = self.credentials.password;

		var auth = 'Basic ' + new Buffer(login + ":" + password).toString('base64'),
			options = url.parse(wsdlUrl);

		options.method = 'GET';
		options.auth = login + ":" + password;

		var req = https.request(options, function(response){
			switch (response.statusCode)
			{
				case 200:
					self.completed({
						statusCode: 200,
						err: '',
						accessAllowed: true,
						success: true
					});
					break;
				default:
					self.completed({
						statusCode: 401,
						err: 'User not authorized',
						accessAllowed: false,
						success: false
					});
					break;
			}
			response.destroy();
		});

		req.on('error', function(e) {
		  console.error(e);
		});
		req.end();
	},

	encode: function (str) {
		return new Buffer(str).toString('base64');
	},

	decode: function (str) {
		return new Buffer(str, 'base64').toString('utf8');
	},

	profile: function() {
		var self = this,
			ldapRequest = self.ldapResponse,
			sessionUID = self.sessionUID,
			user = ldapRequest.data && ldapRequest.data.length && ldapRequest.data[0],
			credentials = self.credentials;

		if (user) {
			if (Object.prototype.toString.call( user.memberof ) === '[object String]') {
				// we came here from login
				user.memberof = [ user.memberof ];
			} else {
				// we came here from ldap
				user.memberof = user.memberof.map(function(item) {
					return item.split(',')[0].split('=')[1];
				});
			}

			var result = {
				email: user.mail || user.email,
				name: user.cn || user.name,
				groupIds: user.memberof,
				sessionUIDs: sessionUID,
				authType: 'exchange',
				tokens: {
					login: credentials.login,
					password: this.encode(credentials.password)
				}
			};

			if (user.thumbnailphoto){
				var shasum = crypto.createHash('sha1');
				shasum.update(user.mail);
				var filePath = '/images/avatars/'+shasum.digest('hex')+'.png';
				var cacheFileStream = project.root.fileIO('htdocs'+filePath).writeStream({flags: 'w', mode: 0666});
				cacheFileStream.write(new Buffer(user.thumbnailphoto, 'base64'));

				result.avatar = filePath;
			}
			if (user.department){
				result.department = user.department;
			}
			if (user.division){
				result.division = user.division;
			}

			self.completed(result);
		} else {
			self.failed({
				statusCode: 404,
				msg: 'User Not Found!'
			});
		}

	},

	check: function() {
		var self = this,
			user = self.user;

		if (user && user.authType == 'exchange' && user.tokens && user.tokens.login && user.tokens.password) {

			self.credentials = {
				login: user.tokens.login,
				password: this.decode(user.tokens.password)
			};

			self.login();

		} else {

			self.completed({
				accessAllowed: true
			});

		}
	},

	tmpl: function (str, obj) {
		return str.replace(
			/{\$(.+?)}/g,
			function (_, key) { return obj[key]; }
		);
	},

	prepareQuery: function () {
		var queryTpl = [
			'<?xml version="1.0" encoding="utf-8"?>',
			'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types">',
			'<soap:Body>',
			'<ResolveNames xmlns="http://schemas.microsoft.com/exchange/services/2006/messages" xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" ReturnFullContactData="true">',
			'<UnresolvedEntry>{$filter}</UnresolvedEntry>',
			'</ResolveNames>',
			'</soap:Body>',
			'</soap:Envelope>'
		].join(' ');


	},

	encodePassword: function () {
		this.completed({
			password: this.encode(this.plainPassword)
		});
	},

	searchUsers: function () {
		var self = this,
			user = self.user;

		if (user && user.authType == 'exchange' && user.tokens && user.tokens.login && user.tokens.password) {

			var login    = user.tokens.login,
				password = this.decode(user.tokens.password);

			var options = url.parse(servicesUrl);

			var queryTpl = [
				'<?xml version="1.0" encoding="utf-8"?>',
				'<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types">',
				'<soap:Body>',
				'<ResolveNames xmlns="http://schemas.microsoft.com/exchange/services/2006/messages" xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types" ReturnFullContactData="true">',
				'<UnresolvedEntry>{$filter}</UnresolvedEntry>',
				'</ResolveNames>',
				'</soap:Body>',
				'</soap:Envelope>'
			].join(' ');

			var query = this.tmpl(queryTpl, this.pager);

			options.auth = login + ':' + password;
			options.port = 443;
			options.headers = {
				'Content-Type': 'text/xml'
			};
			options.method = 'POST';

			var req = https.request(options, function (response) {
				var exchangeXmlAnswer = [];

				response.setEncoding('utf-8');

				response.on('data', function (data) {
				  exchangeXmlAnswer.push(data);
				});

				response.on('end', function () {
					var error = '';
					var users = [];

					if (exchangeXmlAnswer.length) {
						exchangeXmlAnswer = exchangeXmlAnswer.join('');

						var crackedResponse = crack(exchangeXmlAnswer);
						var objResponse = crackedResponse.toJS();

						if (objResponse.Body.Fault) {
							console.log('!!!!!!!!!!!!!!! RESPONSE FAULT:', objResponse.Body.Fault.faultstring.__content);
							self.failed({
								statusCode: 500,
								msg: 'Response Fault!'
							});
							return;
						}

						var objResolveNamesResponseMessage = objResponse.Body.ResolveNamesResponse.ResponseMessages.ResolveNamesResponseMessage;

						if (objResolveNamesResponseMessage.ResponseClass != 'Success' && objResolveNamesResponseMessage.ResponseClass != 'Warning'){
							console.log('!!!!!!!!!!!!!!! NOT SUCCESS!');
							self.failed({
								statusCode: 500,
								msg: 'Response Not Success!'
							});
							error = 'Response Not Success!';
							//return;
						}

						if (!error) {
							var objResolutionSet = objResolveNamesResponseMessage.ResolutionSet;
							if (Object.prototype.toString.call( objResolutionSet ) === '[object Array]') {
								console.log('Found: ' + objResolutionSet.TotalItemsInView);
								console.log('Query:', self.pager.filter);
							}
							if (Object.prototype.toString.call( objResolutionSet.Resolution ) === '[object Array]') {
								objResolutionSet.Resolution.forEach(function (objResolution){
									var objMailbox = objResolution.Mailbox;
									var objContact = objResolution.Contact;
									users.push({
										name: objMailbox.Name,
										authType: 'exchange',
										avatar: '',
										email: objMailbox.EmailAddress,
										_id: objMailbox.EmailAddress,
										text: objMailbox.Name,
										memberof: objContact.Department
									});
									//console.log('Name: ' + objMailbox.Name);
									//console.log('Email: ' + objMailbox.EmailAddress);
								});
							} else if (Object.prototype.toString.call( objResolutionSet.Resolution ) === '[object Object]') {
								users.push({
									name: objResolutionSet.Resolution.Mailbox.Name,
									link: undefined,
									authType: 'exchange',
									avatar: '',
									email: objResolutionSet.Resolution.Mailbox.EmailAddress,
									_id: objResolutionSet.Resolution.Mailbox.EmailAddress,
									text: objResolutionSet.Resolution.Mailbox.Name,
									memberof: objResolutionSet.Resolution.Contact.Department
								});
								//console.log('Name: ' + objResolutionSet.Resolution.Mailbox.Name);
								//console.log('Email: ' + objResolutionSet.Resolution.Mailbox.EmailAddress);
							}
						}
					}
					self.completed({
						data: users || null,
						total: users ? users.length : 0,
						success: !error,
						error: error
					});
				});
			});
			req.on('error', function(e) {
			  console.error('!!!!!!!!!!!!!', e);
			});


			req.write(query);
			req.end();

		} else {

			self.completed({

			});

		}
	}
});
