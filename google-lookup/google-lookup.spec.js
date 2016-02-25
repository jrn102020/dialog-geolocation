var expect = require('chai').expect;
var https = require('https');

describe('Looking Up locations via google maps', function () {
	
	var lookupService;
	var APIKEY = "AIzaSyBck9uWGrdudmu-Nkd4_mm6TGXmAnM2PoE"; //NEED TO PUT YOUR API KEY HERE
	
	before(function() {
		lookupService = require('./google-lookup.js')(https, APIKEY);
	})
	
	it('ATMs in new york', function(done) {
		var my_locations = null;
		
		var lat = 40.7091307;
		var lng = -74.0148335;
		var request = lookupService
						.lookup(lat, lng)
						.radius(1000)
						.rankBy('distance')
						.types('atm');
										
		console.log("endpoint", request.endpoint())
		
		request.end(function(res) {
				console.log(res.statusCode)
				res.setEncoding('utf8');
				res.on('data', function(data) {
					console.log("body", data);
					my_locations = data;
				})
				
				res.on('end', done)
			}).on('error', function(e) {
				console.log("Got Error: " + e.message);
				done();
			})
	})
});