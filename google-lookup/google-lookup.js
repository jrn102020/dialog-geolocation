module.exports = function(https, apiKey) {
	
	var $https = https;
	var myApiKey = apiKey;
	var httpsOpts = {
		hostname: 'maps.googleapis.com',
		port: 443,
		path: ""
	};
	var path_stub = '/maps/api/place/nearbysearch/json?'
	
	return {
						
		lookup: function(lat, lng) {
			httpsOpts.path = path_stub;
			if (myApiKey) httpsOpts.path += ("key=" + myApiKey + "&"); 
			httpsOpts.path += "location=" + lat + "," + lng
			return this;
		},
		
		radius: function(r) {
			httpsOpts.path += ("&radius=" + r);	
			return this;
		},
		
		rankBy: function(rankOption) {
			httpsOpts.path += ("&rankBy=" + rankOption);
			return this;
		},
		
		types: function(typeOption) {
			var types = '';
			if (!typeOption) {
				return this;
			}
			else if (typeof typeOption === 'string') {
				types = typeOption;
				console.log("string")
			}
			else
			{
				for (var i = 0; i < typeOption.length; i++) {
					types += typeOption[i] + "|";
				}
				console.log("ARRAY", typeOption, types)
			}
			httpsOpts.path += ("&types=" + types);
			return this;
		},
				
		end: function(cb) {
			return $https.get(httpsOpts, cb);
		},
		
		endpoint: function() {
			return httpsOpts.hostname + httpsOpts.path;
		},
	};
}