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

/* global $:true */

'use strict';

// conversation variables
var conversation_id, client_id, map, my_location, place_markers = [], location_marker,  infowindow;

var UNION_SQUARE_SF = { lat: 37.788070, lng: -122.406729 };
var my_location = UNION_SQUARE_SF;

function initMap() {
  map = new google.maps.Map($('#map').get(0), {
    center: my_location,
    zoom: 14
  });
  
  infowindow = new google.maps.InfoWindow();
  
  location_marker = new google.maps.Marker({
                  map: map,
                  position: my_location,
                  title: "You are here"
            });
            
  location_marker.setIcon('http://maps.google.com/mapfiles/arrow.png')
}

$(document).ready(function () {
  var $chatInput = $('.chat-window--message-input'),
    $jsonPanel = $('#json-panel .base--textarea'),
    $information = $('.data--information'),
    $profile = $('.data--profile'),
    $loading = $('.loader');


  $chatInput.keyup(function(event){
    if(event.keyCode === 13) {
      converse($(this).val());
    }
  });

  var converse = function(userText) {
    $loading.show();
    // $chatInput.hide();

    // check if the user typed text or not
    if (typeof(userText) !== undefined && $.trim(userText) !== '')
      submitMessage(userText);

    // build the conversation parameters
    var params = { input : userText };

    // check if there is a conversation in place and continue that
    // by specifing the conversation_id and client_id
    if (conversation_id) {
      params.conversation_id = conversation_id;
      params.client_id = client_id;
    }

    $.post('/conversation', params)
      .done(function onSucess(dialog) {
        $chatInput.val(''); // clear the text input

        $jsonPanel.html(JSON.stringify(dialog.conversation, null, 2));

        // update conversation variables
        conversation_id = dialog.conversation.conversation_id;
        client_id = dialog.conversation.client_id;

        console.log(dialog);
        var texts = dialog.conversation.response;
        var response = texts.join('&lt;br/&gt;'); // &lt;br/&gt; is <br/>

        $chatInput.show();
        $chatInput[0].focus();

        $information.empty();

        addProperty($information, 'Dialog ID: ', dialog.dialog_id);
        addProperty($information, 'Conversation ID: ', conversation_id);
        addProperty($information, 'Client ID: ', client_id);

        talk('WATSON', response); // show

        getProfile();
      })
      .fail(function(error){
        talk('WATSON', error.responseJSON ? error.responseJSON.error : error.statusText);
      })
      .always(function always(){
        $loading.hide();
        scrollChatToBottom();
        $chatInput.focus();
      });

  };

  var getProfile = function() {
    var params = {
      conversation_id: conversation_id,
      client_id: client_id
    };

    $.post('/profile', params).done(function(data) {
      $profile.empty();
      clearPlaces();
      
      console.log("profile data", data.name_values);
      var geoinfo = { services: [] };
      for (var i = 0; i < data.name_values.length; i++) {
        var par = data.name_values[i];
        if (par.value !== '') {
          addProperty($profile, par.name + ':', par.value);
          if (par.name.indexOf('service') !== -1) {
            console.log("name:", par.name, par.value)
            geoinfo.services.push(par.value);
          }
          else if (par.name.indexOf('method') !== -1) {
            geoinfo.method = par.value;
          }
        }
      }
      console.log("geoinfo", geoinfo)
      if (geoinfo.method && geoinfo.services.length > 0) {
        var RADII = { foot: 1600, bike: 8000, car: 20000 };
        var radius = 20000;
        if (RADII[geoinfo.method]) radius = RADII[geoinfo.method];
        getPlaces(my_location, geoinfo.services, radius);
      }
      
    }).fail(function(error){
      talk('WATSON', error.responseJSON ? error.responseJSON.error : error.statusText);
    });
  };

  var scrollChatToBottom = function() {
    var element = $('.chat-box--pane');
    element.animate({
      scrollTop: element[0].scrollHeight
    }, 420);
  };

  var scrollToInput = function() {
      var element = $('.chat-window--message-input');
      $('body, html').animate({
        scrollTop: (element.offset().top - window.innerHeight + element[0].offsetHeight) + 20 + 'px'
      });
  };

  var talk = function(origin, text) {
    var $chatBox = $('.chat-box--item_' + origin).first().clone();
    var $loading = $('.loader');
    $chatBox.find('p').html($('<p/>').html(text).text());
    // $('.chat-box--pane').append($chatBox);
    $chatBox.insertBefore($loading);
    setTimeout(function() {
      $chatBox.removeClass('chat-box--item_HIDDEN');
    }, 100);
  };

  var addProperty = function($parent, name, value) {
    var $property = $('.data--variable').last().clone();
    $property.find('.data--variable-title').text(name);
    $property.find('.data--variable-value').text(value);
    $property.appendTo($parent);
    setTimeout(function() {
      $property.removeClass('hidden');
    }, 100);
  };

  var submitMessage = function(text) {
    talk('YOU', text);
    scrollChatToBottom();
    clearInput();
  };

  var clearInput = function() {
    $('.chat-window--message-input').val('');
  };

  $('.tab-panels--tab').click(function(e){
    e.preventDefault();
    var self = $(this);
    var inputGroup = self.closest('.tab-panels');
    var idName = null;

    inputGroup.find('.active').removeClass('active');
    self.addClass('active');
    idName = self.attr('href');
    $(idName).addClass('active');
  });


  var clearPlaces = function() {
    for (var i = 0; i < place_markers.length; i++)
      place_markers[i].setMap(null);
  }

  var getPlaces = function(location, services, radius) {
    
    var params = { 
          lat: location.lat,
          lng: location.lng,
          services: services || ["atm"],
          radius: radius || 1000  
      };
          
    $.getJSON('/static_lookup', params).done(function(places) {
        console.log("get places ", places)
        var labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        place_markers = [];
        
        for (var i = 0; i < places.results.length; i++) {
            var place = places.results[i];
            
            var marker = new google.maps.Marker({
                  map: map,
                  position: place.geometry.location,
                  label: labels[i % labels.length],
                  title: place.name
            });
            
            google.maps.event.addListener(marker, 'click', (function(place, marker) { return function() {
              var rating = place.rating||"none";
              var content = "<h1>"+place.name+"</h1><br>"
              content += "<p>"+place.vicinity+"</p><br>"
              content += "<table><tbody>"
              content += "<tr><td>telephone:</td><td>"+place.phone+"</td></tr>"
              content += "<tr><td>working hours:</td><td>"+place.working_hours.asString+"</td></tr>"
              content += "<tr><td>rating:</td><td>"+rating+"</td></tr>"
              content += "<tr><td>services:</td><td>"
              if (!place.services) place.services = place.types; 
              for (var j = 0; j < place.services.length; j++) {
                content += place.services[j];
                if (j+1 < place.services.length)
                  content += ", "
              }
              content += "</td></tr></tbody></table>"
              infowindow.setContent(content);
              infowindow.open(map, marker);
            }})(place, marker));

            place_markers.push(marker);
        }  
 
        location_marker.setZIndex(google.maps.Marker.MAX_ZINDEX + 1);
    })
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(handle_geo_query, handle_error);
  } 
  
  function handle_geo_query(location) {
    my_location = { lat: location.coords.latitude, lng: location.coords.longitude };
    initMap();
  }
  function handle_error(e) {
    alert('An error occurred during geo-location.');
  }

  $('#override-location').click(function() {
    my_location = UNION_SQUARE_SF;
    map.setCenter(my_location);
    map.setZoom(12);
    location_marker.setPosition(my_location);
    // getPlaces(my_location, ['nails'], 10000);
  })

  // Initialize the conversation
  converse();
  scrollToInput();

});
