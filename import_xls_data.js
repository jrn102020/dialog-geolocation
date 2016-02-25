var path = require('path');
var fs = require('fs');
var node_xj = require("xls-to-json");
var async = require('async');


var FOLDER_WITH_XLS_FILES = path.join(__dirname, 'xls_data');
var OUTPUT_JSON_FILENAME = path.join(__dirname, 'places.json');

// load any .xls files present in the xls-data folder
// synchronous calls used where possible here as we don't care about blocking node
var contents = fs.readdirSync(FOLDER_WITH_XLS_FILES);
var files = [];

// prune any sub directories
contents.forEach(function(fileOrDir) {
	var fullpath = path.join(FOLDER_WITH_XLS_FILES, fileOrDir);
	if (fs.statSync(fullpath).isDirectory()) return;
	if ((path.extname(fullpath) !== '.xls') && (path.extname(fullpath) !== '.xlsx')) return; 
	files.push(fullpath);
})

// convert each of these and add to a JS object
var data = [];

// need to use an async loop (using https://github.com/caolan/async)
async.eachSeries(files, function(filename, nextFile) {
	node_xj({
	          input: filename,  // input xls 
	          output: null,
	          sheet: "Sheet1",  // specific sheetname 
	        }, function(err, result) {
	              if(err) {
	                console.error("error while reading " + filename + ":Sheet1");
	                return;
	              }
				
	              for (var i = 0; i < result.length; i++) {
	                // console.log("converting ", result[i].Name)
	                var obj = convertToPlace(result[i]);
	                // console.log("converted ", obj)
	                data.push(obj);
	              }
				  nextFile();            
			});
}, function() {
	// this is the final callback, so write out the data to json here
	console.log("sadasd")
	var readability = 4; // note if size of file becomes and issue set this to null
	fs.writeFile(OUTPUT_JSON_FILENAME, JSON.stringify(data, null, readability), function(err) {
		if (err) throw err;
		console.log(files.length, "files processed");
		console.log(data.length, " places found");
		console.log("data written to", OUTPUT_JSON_FILENAME);
	})
})


/*
	This function accepts an "item" when an item is a JS object representing 
	one row from an xls file. We expect this object to have properties that match the
	column names in the example salon file we have been using.
	
	Note the salon data we have seems to have some structure to the categories data, 
	indidcated by the /0/1 and so on. Perhaps this should affect their ranking somehow.
	Here we produce a single flat array of services where the order preserves the catergory 
	order to some degree.
	
	This will transform the item into an object representation that conforms to what
	we would expect from the Google Places API.
*/
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



