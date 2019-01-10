var map;
var markers = [];
var autocomplete;
var infoWindow;
var locationSelect;
var csvData = [];
var australia = { lat: -25.2744, lng: 133.7751 };

function importCSV() {
  Papa.parse("js/collection-centers.csv", {
    download: true,
    complete: function (results) {
      csvData = results.data

      searchLocationsNear(null)
    }
  })
}

function resetMap() {
  searchLocationsNear(null)
  document.getElementById('addressInput').value = ''
  var latlng = new google.maps.LatLng(australia.lat, australia.lng);
  map.setCenter(latlng);
  map.setZoom(5);
}

function initMap() {
  importCSV()

  map = new google.maps.Map(document.getElementById('map'), {
    center: australia,
    zoom: 5,
    mapTypeId: 'roadmap',
    mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU }
  });

  infoWindow = new google.maps.InfoWindow();

  listenAutocomplete()

  radiusSelect = document.getElementById("radiusSelect");
  radiusSelect.onchange = function () {
    google.maps.event.trigger(autocomplete, 'place_changed');
  }

  document.getElementById("resetButton").onclick = resetMap;

  locationSelect = document.getElementById("locationSelect");
  locationSelect.onchange = function () {
    var markerNum = locationSelect.options[locationSelect.selectedIndex].value;
    if (markerNum != "none") {
      google.maps.event.trigger(markers[markerNum], 'click');
    }
  };
}

function listenAutocomplete() {
  autocomplete = new google.maps.places.Autocomplete(document.getElementById("addressInput"));

  // Bind the map's bounds (viewport) property to the autocomplete object,
  // so that the autocomplete requests use the current map bounds for the
  // bounds option in the request.
  autocomplete.bindTo('bounds', map);

  // Set the data fields to return when the user selects a place.
  autocomplete.setFields(['address_components', 'geometry', 'icon', 'name']);

  autocomplete.addListener('place_changed', function () {
    var place = autocomplete.getPlace();

    if (!place || !place.geometry || !document.getElementById("addressInput").value) {
      // User entered the name of a Place that was not suggested and
      // pressed the Enter key, or the Place Details request failed.
      window.alert("No details available for input");
      return;
    }

    let dataFound = searchLocationsNear(place.geometry.location)
    if (dataFound) {
      return;
    }

    // If the place has a geometry, then present it on a map.
    if (place.geometry.viewport) {
      // map.setZoom(8);
      map.fitBounds(place.geometry.viewport);
    } else {
      map.setCenter(place.geometry.location);
      map.setZoom(17);  // Why 17? Because it looks good.
    }
  });
}

function clearLocations() {
  infoWindow.close();

  for (var i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }

  markers.length = 0;
  locationSelect.innerHTML = "";
  var option = document.createElement("option");
  option.value = "none";
  option.innerHTML = "See all results:";
  locationSelect.appendChild(option);
}

function createMarker(latlng, name, address) {
  var html = `
  <b>${name}</b>
  <br/>
  ${address}
  `
  var marker = new google.maps.Marker({
    map: map,
    position: latlng
  });
  google.maps.event.addListener(marker, 'click', function () {
    infoWindow.setContent(html);
    infoWindow.open(map, marker);
  });
  markers.push(marker);
}

function createOption(name, distance, num) {
  var option = document.createElement("option");
  option.value = num;
  option.innerHTML = name;
  locationSelect.appendChild(option);
}

function doNothing() { }

function searchLocationsNear(center) {
  clearLocations();
  var radius = document.getElementById('radiusSelect').value;
  var data = readFromCSV(center, radius);

  var bounds = new google.maps.LatLngBounds();

  if (data.length > 0) {
    for (var i = 0; i < data.length; i++) {
      var id = data[i].id;
      var name = data[i].name
      var address = data[i].address
      var distance = data[i].distance;

      var latlng = new google.maps.LatLng(
        parseFloat(data[i].lat),
        parseFloat(data[i].lng)
      );

      createOption(name, distance, i);
      createMarker(latlng, name, address);
      bounds.extend(latlng);
    }

    map.fitBounds(bounds);
    locationSelect.style.visibility = "visible";
    locationSelect.onchange = function () {
      var markerNum = locationSelect.options[locationSelect.selectedIndex].value;
      google.maps.event.trigger(markers[markerNum], 'click');
    };
    return true;
  } else {
    return false;
  }
}

function readFromCSV(center, radius) {
  return csvData.map(data => {
    let distance = null;
    if (center && radius) {
      distance = calculateDistance({ lat: center.lat(), lng: center.lng() }, { lat: data[7], lng: data[8] })
    }

    return {
      'id': data[0],
      'name': data[1],
      'address': data[2],
      'lat': data[7],
      'lng': data[8],
      'distance': distance,
    }
  }).filter(data => data.distance === null || data.distance <= radius)
}

function calculateDistance(point1, point2) {
  return (3959 * Math.acos(Math.cos(radians(point1.lat)) * Math.cos(radians(point2.lat)) * Math.cos(radians(point2.lng) - radians(point1.lng)) + Math.sin(radians(point1.lat)) * Math.sin(radians(point2.lat))))
}

function radians(degree) {
  return Math.sin(degree * Math.PI / 180)
}