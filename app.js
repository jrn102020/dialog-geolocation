/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var https = require('https');

var MAPS_APIKEY = "AIzaSyC4JQTJ20bk30fDgWuFT8sUxow78bQm7fM";
var PLACES_APIKEY = "AIzaSyBck9uWGrdudmu-Nkd4_mm6TGXmAnM2PoE";

var APIKEY = undefined;
var lookupService = require('./google-lookup/google-lookup.js')(https, PLACES_APIKEY);
var static_place_data = null;

'use strict';

var express  = require('express'),
  app        = express(),
  fs         = require('fs'),
  path       = require('path'),
  bluemix    = require('./config/bluemix'),
  extend     = require('util')._extend,
  watson     = require('watson-developer-cloud');

// Bootstrap application settings
require('./config/express')(app);

// if bluemix credentials exists, then override local
var credentials =  extend({
  url: 'https://gateway.watsonplatform.net/dialog/api',
  username: '50ebb78c-fae6-40c3-814c-b6cc51c916ab',
  password: 'GEyFxQ4agOdY',
  version: 'v1'
}, bluemix.getServiceCreds('dialog')); // VCAP_SERVICES


var dialog_id_in_json = (function() {
  try {
    var dialogsFile = path.join(path.dirname(__filename), 'dialogs', 'dialog-id.json');
    var obj = JSON.parse(fs.readFileSync(dialogsFile));
    return obj[Object.keys(obj)[0]].id;
  } catch (e) {
  }
})();


var dialog_id = process.env.DIALOG_ID || dialog_id_in_json || 'Dialog-ew';

// Create the service wrapper
var dialog = watson.dialog(credentials);

app.post('/conversation', function(req, res, next) {
  var params = extend({ dialog_id: dialog_id }, req.body);
  dialog.conversation(params, function(err, results) {
    if (err)
      return next(err);
    else
      res.json({ dialog_id: dialog_id, conversation: results});
  });
});

app.post('/profile', function(req, res, next) {
  var params = extend({ dialog_id: dialog_id }, req.body);
  dialog.getProfile(params, function(err, results) {
    if (err)
      return next(err);
    else
      res.json(results);
  });
});

app.get('/lookup', function(req, res, next) {
  
  var params = extend({ dialog_id: dialog_id }, req.query);

  console.log(params.types)
  
  var placesRequest = lookupService
        .lookup(params.lat, params.lng)
        .radius(params.radius)
        .rankBy('distance')
        .types(params.types);
        
  console.log('endpoint', placesRequest.endpoint())
                  
  placesRequest.end(function(placesRes) {
      placesRes.setEncoding('utf8');
      var results = "";
      placesRes.on('data', function(data) {
        results += data;
      })
      placesRes.on('end', function() {
        res.json(JSON.parse(results));
      })
    }).on('error', function(e) {
      res.status(400);
      res.json(e)
    })

})

app.get('/static_lookup', function(req, res, next) {
  var params = extend({ dialog_id: dialog_id }, req.query);
  
  // make sure all expected feilds are included
  if (!params.radius) params.radius = 99999999;
  if ( (!params.services) || (params.services == [])) {
    res.json({ results: [] })
    return;
  }
  
  /*
    checks to see if a place has a service based on string matching
    
    inputs:
      an array of services
      an array of places
      
    returns true
    */
  function hasAllServices(services, place) {
    for (var i = 0; i < services.length; i++) {
      var wanted = services[i].toLowerCase();
      var hasThisService = false;
      for (var j = 0; j < place.services.length; j++) {
        var available = place.services[j];
        if (wanted == available) hasThisService = true;
      }
      if (!hasThisService) return false;
    }
    return true
  }
    
  /*
      Takes arrays of services andplaces. Produces a new filtered array
      containing only places that have ALL the services listed in the serices
      input array.
  
      inputs:
        an array of services
        an array of places
        
      returns:
        a new array of places
  
  */
  function filterByService(services, places) {
    var filtered = [];
    for (var p = 0; p < places.length; p++) {
      if (hasAllServices(services, places[p])) {
        filtered.push(places[p])
      }
    }
    return filtered;
  }
  
  /*
    checks that two locations {lat: 0, lng:0} are within a certain distance
    there is a rough fiddle factor to get distance to roughly relate to miles
    
    intput:
      a - first location
      b - second location
      distance to test for 
      
    returns:
      true or false   
    
  */
  function isWithin(a, b, distance) {
    var rough_degree_dist = distance / 110000;
    var d_lat = b.lat - a.lat;
    var d_lng = b.lng - a.lng;
    return (Math.sqrt(d_lat*d_lat + d_lng*d_lng) < rough_degree_dist);
  }
  
  /*
    Created a new array of places that are within the specified distance of the location 
  
    input:
      location - the current geolocation to test against
      radius - the distance to test with
      places - the array of places
      
    returns:
      a new array of places filtered buy distance  
   */
  
  function filterByDistance(location, radius, places) {
    var filtered = [];
    for (var p = 0; p < places.length; p++) {
      if (isWithin(location, places[p].geometry.location, radius)) {
        filtered.push(places[p]);
      }
    }
    return filtered;
  }
    
  /*
    Will perform string matches aginst address fields and filter out places that have no match
  */
  function filterByNamedLocation(named_location, places) {
    named_location = named_location.toLowerCase();
    var filtered = [];
    console.log("named location", named_location)
    for (var p = 0; p < places.length; p++) {
      if (places[p].vicinity.toLowerCase().indexOf(named_location) !== -1) {
        console.log("matched", places[p].vicinity)
        filtered.push(places[p]);
      }
    }
    return filtered;
  }   
    
  var filtered_places = filterByService(params.services, static_place_data);
  
  
  if ((params.named_location === 'here') ||
        (params.named_location === 'right here') ||
        (params.named_location === 'nearby') ||
        (params.named_location === 'near me') ||
        (params.named_location === 'near here')) {
    params.named_location = undefined;
  }
  
  if (params.named_location) {
    filtered_places = filterByNamedLocation(params.named_location, filtered_places);
  }
  else
  {
    filtered_places = filterByDistance({lat:params.lat, lng:params.lng}, params.radius, filtered_places);  
  }
  
  res.json({ results: filtered_places })
})


/*

  Load all static place data form JSON at server start
  Do loading synchronously so we block server startup until its loaded

*/
var JSON_PLACE_DATA_FILE = path.join(__dirname, 'places.json');
var static_place_data = [];

console.log("loading static data from", JSON_PLACE_DATA_FILE)
static_place_data = JSON.parse(fs.readFileSync(JSON_PLACE_DATA_FILE));
console.log("Loaded", static_place_data.length, " places")

// error-handler settings
require('./config/error-handler')(app);

var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at:', port);