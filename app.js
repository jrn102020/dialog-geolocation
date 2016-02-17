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
  
  console.log("/static_lookup with params", params)
  if (!params.radius) params.radius = 99999999;
  if (!params.services) params.services = [];
  console.log("/static_lookup defaults", params)
  
  
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
    
  function filterByService(services, places) {
    var filtered = [];
    for (var p = 0; p < places.length; p++) {
      if (hasAllServices(services, places[p])) {
        filtered.push(places[p])
      }
    }
    return filtered;
  }
  
  function isWithin(a, b, distance) {
    var rough_degree_dist = distance / 110000;
    var d_lat = b.lat - a.lat;
    var d_lng = b.lng - a.lng;
    return (Math.sqrt(d_lat*d_lat + d_lng*d_lng) < rough_degree_dist);
  }
  
  function filterByDistance(location, radius, places) {
    var filtered = [];
    for (var p = 0; p < places.length; p++) {
      if (isWithin(location, places[p].geometry.location, radius)) {
        filtered.push(places[p]);
      }
    }
    return filtered;
  }
    
  var filtered_places = filterByService(params.services, static_place_data);
  filtered_places = filterByDistance({lat:params.lat, lng:params.lng}, params.radius, filtered_places)
  
  res.json({ results: filtered_places })
})

// data setup

function convertToPlace(item) {
  
  var obj = { geometry: { location: { lat: 0, lng: 0 } } };
  
  obj.name = item['Name'];
  obj.geometry.location.lat = Number(item['location/coordinate/latitude']);
  obj.geometry.location.lng = Number(item['location/coordinate/longitude']);
  obj.phone = item.phone;
  obj.working_hours = { 
        start: item['Start Working Hours'],
        end: item['End Working Hours'],
        asString: 'Open from ' + item['Start Working Hours'] + ' to ' + item['End Working Hours']
      }
  obj.vicinity = item['location/display_address/0'] + ", " + item['location/display_address/1'] + ", " + item['location/display_address/2'];
  obj.rating = item.rating;
  
  obj.services = [item['categories/0/0'].toLowerCase()];
  if (item['categories/0/1'] !== '') obj.services.push(item['categories/0/1'].toLowerCase());
  if (item['categories/1/0'] !== '') obj.services.push(item['categories/1/0'].toLowerCase());
  if (item['categories/1/1'] !== '') obj.services.push(item['categories/1/1'].toLowerCase());
  if (item['categories/2/0'] !== '') obj.services.push(item['categories/2/0'].toLowerCase());
  if (item['categories/2/1'] !== '') obj.services.push(item['categories/2/1'].toLowerCase());
  
  return obj;
}

var node_xj = require("xls-to-json");

node_xj({
          input: "salon_sample.xls",  // input xls 
          output: null,
          sheet: "Sheet1",  // specific sheetname 
        }, function(err, result) {
              if(err) {
                console.error("error while reading static place data");
                return;
              }
              static_place_data = [];
              
              for (var i = 0; i < result.length; i++) {
                console.log("converting ", result[i].Name)
                var obj = convertToPlace(result[i]);
                console.log("converted ", obj)
                static_place_data.push(obj);
              }            
            });

// error-handler settings
require('./config/error-handler')(app);

var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at:', port);
