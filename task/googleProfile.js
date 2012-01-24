var googleConfig	= project.config.consumerConfig.google;
var googleScopes	= googleConfig.scopes;

// - - -

var OAuth = require('oauth').OAuth,
	task = require('task/base'),
	util = require('util');

// - - - -

var googleProfile = module.exports = function(config) {

	this.source = "https://www.googleapis.com/oauth2/v1/userinfo";
	this.init (config);		

};

util.inherits (googleProfile, task);

util.extend (googleProfile.prototype, {

	run: function () {
		
		var self = this;
		var req = self.req;
		var tokens = req.user.tokens;
		
		var oa = new OAuth(tokens._requestUrl,
			googleConfig.accessTokenUrl,
			googleConfig.clientId,
			googleConfig.clientSecret,
			"1.0",
			tokens._authorize_callback,
			"HMAC-SHA1");
		
		oa._headers['GData-Version'] = '2'; 
		
		oa.getProtectedResource(
			self.source, 
			"GET", 
			tokens.oauth_access_token, 
			tokens.oauth_access_token_secret,
			function (error, data, response) {
				
				if (error) {
					self.failed(error.message);
				} else {
					try {
						var user = JSON.parse(data);
						self.completed(self.mappingUser(user));
					} catch (e) {
						self.failed(e);
					}
				}
			}
		);
	},
	
	mappingUser: function(user) {
		
		return {
			name: user.name,
			email: user.email,
			avatar: user.picture,
			link: user.link
		};
		
	}
});