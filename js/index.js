var map
var markers = []
var autocomplete
var infoWindow
var locationListWrapper
var csvData = []
var australia = {lat: -25.2744, lng: 133.7751}
var importFrom = "sheet"

$(document).on("click", ".locationlistitem", function(event) {
    var markerNum = $(this).data("index")
    if (markerNum != "none") {
        google.maps.event.trigger(markers[markerNum], "click")
    }
})

function createLocationList(data) {
    let template = `
    <li class="list-marker locationlistitem" data-index="__ID__">
          <div class="list-details" title="__distance__">
            <div class="list-content">
              <div class="name">__name__</div>
              <div class="address">__address__</div>
              <div class="telephone"><a href="tel:__tel__">__tel__</a></div>
              <div class="direction">
                <a href="__link__" target="_blank">Get Direction</a>
              </div>
            </div>
          </div>
        </li>
    `

    let lists = ""

    locationListWrapper.html("")
    data.forEach((list, index) => {
        let listHtml = template
        listHtml = listHtml.replace(/__ID__/g, index)
        listHtml = listHtml.replace(/__distance__/g, list.distance ? `Distance: ${list.distance.toFixed(2)} km` : "")
        listHtml = listHtml.replace(/__name__/g, list.name)
        listHtml = listHtml.replace(/__address__/g, list.address)
        listHtml = listHtml.replace(/__tel__/g, list.telephone)
        listHtml = listHtml.replace(/__link__/g, getDirectionUrl(list.address, list.lat, list.lng))

        lists += listHtml
    })

    locationListWrapper.html(lists)
}

function getDirectionUrl(address, lat, lng) {
    return `https://www.google.com/maps/dir/Current+Location/${address}/@${lat},${lng},15z`
}

function importGoogleSheetData() {
    initTableTop()

    function initTableTop() {
        var publicSpreadsheetUrl =
            "https://docs.google.com/spreadsheets/d/1M4A03v3VvP5g4zUZ57n6KcWmclWLSzOH0l9bZok7QDU/edit?usp=sharing"

        Tabletop.init({
            key: publicSpreadsheetUrl,
            callback: function(data, tabletop) {
                csvData = data
                searchLocationsNear(null)
            },

            simpleSheet: true,
        })
    }
}

function importCSV() {
    Papa.parse("js/collection-centers.csv", {
        download: true,
        complete: function(results) {
            csvData = results.data

            searchLocationsNear(null)
        },
    })
}

function resetMap() {
    searchLocationsNear(null)
    document.getElementById("addressInput").value = ""
    var latlng = new google.maps.LatLng(australia.lat, australia.lng)
    map.setCenter(latlng)
    map.setZoom(5)
}

function initMap() {
    if (importFrom === "sheet") {
        importGoogleSheetData()
    } else {
        importCSV()
    }

    map = new google.maps.Map(document.getElementById("map"), {
        center: australia,
        zoom: 5,
        mapTypeId: "roadmap",
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
        },
    })

    infoWindow = new google.maps.InfoWindow()

    listenAutocomplete()

    radiusSelect = document.getElementById("radiusSelect")
    radiusSelect.onchange = function() {
        google.maps.event.trigger(autocomplete, "place_changed")
    }

    document.getElementById("resetButton").onclick = resetMap

    locationListWrapper = $("#locationListWrapper")
}

function listenAutocomplete() {
    autocomplete = new google.maps.places.Autocomplete(
        document.getElementById("addressInput"),
    )

    // Bind the map's bounds (viewport) property to the autocomplete object,
    // so that the autocomplete requests use the current map bounds for the
    // bounds option in the request.
    autocomplete.bindTo("bounds", map)

    // Set the data fields to return when the user selects a place.
    autocomplete.setFields(["address_components", "geometry", "icon", "name"])

    autocomplete.addListener("place_changed", function() {
        var place = autocomplete.getPlace()

        if (
            !place ||
            !place.geometry ||
            !document.getElementById("addressInput").value
        ) {
            // User entered the name of a Place that was not suggested and
            // pressed the Enter key, or the Place Details request failed.
            window.alert("No details available for input")
            return
        }

        let dataFound = searchLocationsNear(place.geometry.location)
        if (dataFound) {
            return
        }

        // If the place has a geometry, then present it on a map.
        if (place.geometry.viewport) {
            // map.setZoom(8);
            map.fitBounds(place.geometry.viewport)
        } else {
            map.setCenter(place.geometry.location)
            map.setZoom(17) // Why 17? Because it looks good.
        }
    })
}

function clearLocations() {
    infoWindow.close()

    for (var i = 0; i < markers.length; i++) {
        markers[i].setMap(null)
    }

    markers.length = 0
    locationListWrapper.html("No data found...")
    var option = document.createElement("option")
    option.value = "none"
    option.innerHTML = "See all results:"
}

function createMarker(latlng, name, address, city, telephone, opening_hour) {
    var html = `
  <div class="marker-detail">
  <h2 class="title">${name}</h2>
  <span class="city">${city}</span>
  <div class="address-wrap">
  <span class="address">${address}</span>
  <a href="tel:${telephone}" class="telephone">${telephone}</a>
  <span class="time">${opening_hour}</span>
  <a href="${getDirectionUrl(
        address,
        latlng.lat(),
        latlng.lng(),
    )}" class="direction" target="_blank">Get Direction</a>
  </div>
  </div> 
  `
    var marker = new google.maps.Marker({
        map: map,
        position: latlng,
        icon: "./image/ic_location.svg",
    })
    google.maps.event.addListener(marker, "click", function() {
        infoWindow.setContent(html)
        infoWindow.open(map, marker)
    })
    markers.push(marker)
}

function searchLocationsNear(center) {
    clearLocations()
    var radius = document.getElementById("radiusSelect").value
    var data = readFromCSV(center, radius)

    var bounds = new google.maps.LatLngBounds()

    if (data.length > 0) {
        for (var i = 0; i < data.length; i++) {
            var id = data[i].id
            var name = data[i].name
            var address = data[i].address
            var distance = data[i].distance
            var city = data[i].city
            var telephone = data[i].telephone
            var opening_hour = data[i].opening_hour

            var latlng = new google.maps.LatLng(
                parseFloat(data[i].lat),
                parseFloat(data[i].lng),
            )
            createMarker(latlng, name, address, city, telephone, opening_hour)
            bounds.extend(latlng)
        }

        createLocationList(data)
        map.fitBounds(bounds)
        return true
    } else {
        return false
    }
}

function readFromCSV(center, radius) {
    return csvData.map(data => {
        let distance = null
        let id = importFrom === "sheet" ? data["ID"] : data[0],
            name = importFrom === "sheet" ? data["Name"] : data[1],
            city = importFrom === "sheet" ? data["City"] : data[2],
            address = importFrom === "sheet" ? data["Address"] : data[3],
            telephone = importFrom === "sheet" ? data["Telephone"] : data[4],
            opening_hour = importFrom === "sheet" ? data["Opening Hours"] : data[6],
            lat = importFrom === "sheet" ? data["Latitude"] : data[7],
            lng = importFrom === "sheet" ? data["Longitude"] : data[8]

        if (center && radius) {
            distance = calculateDistance(
                {lat: center.lat(), lng: center.lng()},
                {lat: lat, lng: lng},
            )
        }

        return {
            id: id,
            name: name,
            city: city,
            address: address,
            telephone: telephone,
            opening_hour: opening_hour,
            lat: lat,
            lng: lng,
            distance: distance,
        }
    }).filter(data => data.distance === null || data.distance <= radius).sort((a, b) => a.distance - b.distance)
}

function calculateDistance(point1, point2) {
    return (
        3959 *
        Math.acos(
            Math.cos(radians(point1.lat)) *
            Math.cos(radians(point2.lat)) *
            Math.cos(radians(point2.lng) - radians(point1.lng)) +
            Math.sin(radians(point1.lat)) * Math.sin(radians(point2.lat)),
        )
    )
}

function radians(degree) {
    return Math.sin((degree * Math.PI) / 180)
}
