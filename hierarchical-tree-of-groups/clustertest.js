/**
 * Created by boris on 9/14/15.
 */

// See also https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#hsl%28%29
// and https://developer.mozilla.org/en-US/docs/Web/CSS/color_value#hsla%28%29
function getRandomHue2() {
    return Math.floor(Math.random() * 360);
}

// Try to get a minimum of saturation (colorness) (0% is grey)
function getRandomSaturation2() {
    return Math.round(30 + Math.random() * 70);
}

// Try to stay within average lightness (0% is black, 100% is white)
function getRandomLightness2() {
    return Math.round(40 + Math.random() * 40);
}

function generateHSL(hue) {
    if (typeof hue === "undefined") {
        hue = getRandomHue2();
    }

    return {
        h: hue,
        s: getRandomSaturation2(),
        l: getRandomLightness2()
    }
}

function getHSL(hsl) {
    return "hsl(" + hsl.h + "," + hsl.s + "%," + hsl.l + "%)";
}

function getHSLA(hsl, alpha) {
    alpha = alpha || 1;

    return "hsla(" + hsl.h + "," + hsl.s + "%," + hsl.l + "%," + alpha + ")";
}

// Adapted from: http://stackoverflow.com/questions/10787782/full-height-of-a-html-element-div-including-border-padding-and-margin
function getOuterHeight(elmID) {
    var elmHeight, elmMargin, elmPadding, elm = document.getElementById(elmID);
    if(document.all) {// IE
        elmHeight = parseInt(elm.currentStyle.height, 10);
        elmMargin = parseInt(elm.currentStyle.marginTop, 10) + parseInt(elm.currentStyle.marginBottom, 10);
        elmPadding = parseInt(elm.currentStyle.paddingTop, 10) + parseInt(elm.currentStyle.paddingBottom, 10);
    } else {// Mozilla
        elmHeight = parseInt(document.defaultView.getComputedStyle(elm, '').getPropertyValue('height'), 10);
        elmMargin = parseInt(document.defaultView.getComputedStyle(elm, '').getPropertyValue('margin-top'), 10) +
            parseInt(document.defaultView.getComputedStyle(elm, '').getPropertyValue('margin-bottom'), 10);
        elmPadding = parseInt(document.defaultView.getComputedStyle(elm, '').getPropertyValue('padding-top'), 10) +
            parseInt(document.defaultView.getComputedStyle(elm, '').getPropertyValue('padding-bottom'), 10);
    }
    return (elmHeight + elmMargin + elmPadding);
}

var map,
    zoomLevel = document.getElementById("zoomLevel"),
    form = document.getElementById("options"),
    forceSingletonPosition,
    addCities,
    wrapCoordinates,
    countryGroup;

form.addEventListener("submit", function (evt) {
    forceSingletonPosition = document.getElementById("forceSingletonPosition").checked;
    addCities = document.getElementById("addCities").checked;
    wrapCoordinates = document.getElementById("wrapCoordinates").checked;

    showTopGroup();

    evt.preventDefault();
    return false;
});

document.addEventListener("DOMContentLoaded", function () {

    // Resize the map container.
    var h1 = getOuterHeight("pageTitle"),
        h2 = getOuterHeight("options"),
        h3 = getOuterHeight("zoomInfo"),
        h0 = document.getElementById("leftPane").offsetHeight;

    document.getElementById("map").style.height = (h0 - h1 - h2 - h3) + "px";

    // Initialize the map.
    map = L.map(
            'map',
            {
                center: [39.5, -98.35],
                zoom: 4,
                layers: [
                    new L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
                    })
                ]
            }
        );

    // Prepare the zoom information.
    map.on("zoomend", function () {
        zoomLevel.innerHTML = map.getZoom();
    });

    // Prepare the links to set map view.
    var mapSetViewLinks = document.getElementsByClassName("mapSetView"),
        mapSetViewLink;

    for(var i = 0; i < mapSetViewLinks.length; i += 1) {
        mapSetViewLink = mapSetViewLinks[i];
        mapSetViewLink.addEventListener("click", function (evt) {
            var data = evt.target.dataset,
                lat = parseFloat(data.lat),
                lng = parseFloat(data.lng),
                zoom = (typeof data.zoom !== "undefined") ?
                    parseInt(data.zoom, 10) : map.getZoom();

            map.setView([lat, lng], zoom);

            evt.preventDefault();
            return false;
        });
    }

    // Fill the map with data.
    document.getElementById("submit").click();
});

function showTopGroup() {
    // Reset any pre-existing group.
    if (countryGroup && countryGroup instanceof L.MarkerClusterGroup && countryGroup._map) {
        map.removeLayer(countryGroup);
        countyGroup = null;
    }

    // USA map
    var i = 0,
        j = 0,
        k = 0,
        hue = 1,
        hsl = {},
        hsla = "",
        USA = DATA.USA,
        link = USA.states,
        stateCodes = Object.keys(link),
        stateGroup = null,
        stateData = null,
        county = null,
        countiesTotal = 0,
        countyGroup = null,
        city = null,
        citiesTotal = 0;


    // USA keys: lat,lng,states
    countryGroup = L.markerClusterGroup({
        center: forceSingletonPosition ? L.latLng(USA.lat, USA.lng) : null,
        data: {
            name: "USA",
            code: "USA",
            color: "#b22234" //rgb(178,34,52) from https://en.wikipedia.org/wiki/Flag_of_the_United_States
        },
        //disableClusteringAtZoom: 3, // Try this option to keep individual States at low zoom levels, but there will be a bunch overlapping...
        iconCreateFunction: function (cluster) {
            var alienClustersCount = cluster.getAlienClustersCount(),
                options = cluster._originalGroup.options,
                isSingleton = cluster.isSingletonCluster();

            return new L.DivIcon({
                html: '<div style="background-color: ' + options.data.color + '; border-color: ' +
                (isSingleton ? "black" : "rgba(178,34,52,0.6)") + ';">' + alienClustersCount +
                (isSingleton ? '<span class="country-' + options.data.code + '"> ' + options.data.name + '</span>' : "") + '</div>',
                className: isSingleton ? "marker-country" : 'marker-states-cluster',
                iconSize: null
            });
        },
        setLabel: function (cluster) {
            var isSingleton = cluster.isSingletonCluster(),
                options = cluster._originalGroup.options;

            cluster.bindLabel(
                isSingleton ?
                "States in " + options.data.name +
                "<br />Total included " + (addCities ? "cities" : "counties") + ": " + cluster.getChildCount() +
                "<br />Lat: " + cluster._latlng.lat +
                "<br />Lng: " + cluster._latlng.lng :

                "States in part of " + options.data.name +
                "<br />Total included " + (addCities ? "cities" : "counties") + ": " + cluster.getChildCount(),
                {
                    offset: [25, -15]
                }
            );
        }
    }).addTo(map);

    // For each State.
    for(i = 0; i < stateCodes.length; i += 1) {
        // Condtion used only for testing with fewer data.
        if (true || stateCodes[i] === "AK" || stateCodes[i] === "DE" || stateCodes[i] === "DC") {
            // stateData keys: stateName,lat,lng,stateCounties
            stateData = link[stateCodes[i]];
            hue = getRandomHue2();
            hsl = {h: hue, s: 100, l: 50};
            stateGroup = L.markerClusterGroup({
                stateData: L.extend(L.extend({}, stateData), {stateCode: stateCodes[i]}),
                stateHue: hue,
                stateHSL: getHSL(hsl),
                stateHSLA: getHSLA(hsl, 0.6),
                center: forceSingletonPosition ? L.latLng(stateData.lat, stateData.lng) : null,
                //forceSingletonClusterAtZoom: 3, // For Alaska // does not work as expected because even at this zoom level, we still have individual cities not clustered in counties...
                iconCreateFunction: function (cluster) {
                    var childCount = cluster.getChildCount(),
                        alienClustersCount = addCities ? cluster.getAlienClustersCount() : childCount,
                        options = cluster._originalGroup.options,
                        isSingleton = cluster.isSingletonCluster();

                    return new L.DivIcon({
                        html: '<div style="background-color: ' + options.stateHSL + '; border-color: ' +
                        (isSingleton ? "black" : options.stateHSLA) + ';">' + alienClustersCount +
                        (isSingleton ? '<span class="state-' + options.stateData.stateCode + '"> ' + options.stateData.stateName + '</span>' : "") + '</div>',
                        className: isSingleton ? "marker-state" : 'marker-counties-cluster',
                        iconSize: null
                    });
                },
                setLabel: function (cluster) {
                    var isSingleton = cluster.isSingletonCluster(),
                        options = cluster._originalGroup.options,
                        childCount = cluster.getChildCount();

                    cluster.bindLabel(
                        isSingleton ?
                        "Total counties in " + options.stateData.stateName + " State" +
                        "<br />State Code: " + options.stateData.stateCode +
                        "<br />Lat: " + options.stateData.lat +
                        "<br />Lng: " + options.stateData.lng +
                        (addCities ? "<br />Total included cities: " + childCount : "") :

                        "Counties in part of " + options.stateData.stateName +
                        (addCities ? "<br />Total included cities: " + childCount : ""),
                        {
                            offset: [25, -15],
                            direction: isSingleton ?
                                "left": // To let the flag and State Name visible
                                "right"
                        }
                    );
                }
            }).addTo(map);

            // For each county.
            for(j = 0; j < stateData.stateCounties.length; j += 1) {
                county = stateData.stateCounties[j];
                hsl = generateHSL(hue);
                hsla = getHSLA(hsl, 0.6);

                // Special case of county "Aleutians West" (code 16) in Alaska, coordinates [51.959447, 178.338813]
                // Wrap it back to negative longitude, so that it is displayed closer to the rest of the State.
                if (wrapCoordinates && county.code === 16) {
                    county = L.extend({}, county); // Get a shallow copy of data to keep it intact.
                    county.lng -= 360;
                }

                if (stateData.stateCode === "DC") {
                    console.log("Processing Washington DC " + addCities);
                }

                if (addCities) {
                    countyGroup = L.markerClusterGroup({
                        // countyData keys: name,type,code,lat,lng
                        countyData: L.extend({}, county),
                        countyHSLA: hsla,
                        countyHSL: getHSL(hsl),
                        center: forceSingletonPosition ? L.latLng(county.lat, county.lng) : null,
                        iconCreateFunction: function (cluster) {
                            var childCount = cluster.getChildCount(),
                                options = cluster._originalGroup.options,
                                isSingleton = cluster.isSingletonCluster();

                            return new L.DivIcon({
                                html: '<div style="background-color: ' + options.countyHSL + '; border-color: ' +
                                (isSingleton ? "black" : options.countyHSLA) + ';">' + childCount +
                                (isSingleton ? '<span>' + options.countyData.name /*+ " " + options.countyData.type*/ + '</span>' : "") + '</div>',
                                className: isSingleton ? "marker-county" : 'marker-cities-cluster',
                                iconSize: null
                            });
                        },
                        setLabel: function (cluster) {
                            var isSingleton = cluster.isSingletonCluster(),
                                options = cluster._originalGroup.options;

                            cluster.bindLabel(
                                isSingleton ?
                                "Total cities in " + options.countyData.name + " " + options.countyData.type +
                                "<br />County Code: " + options.countyData.code +
                                "<br />Lat: " + options.countyData.lat +
                                "<br />Lng: " + options.countyData.lng :
                                "Cities in part of " + options.countyData.name + " " + options.countyData.type,
                                {
                                    offset: [20, -15]
                                }
                            );
                        }
                    });

                    // For each City.
                    for(k = 0; k < county.cities.length; k += 1) {
                        city = county.cities[k];

                        // Special case of city (GNIS 2418783) in Alaska, coordinates [52.880248, 173.256076]
                        // Wrap it back to negative longitude, so that it is displayed closer to the rest of the State.
                        if (wrapCoordinates && city.GNIS === 2418783) {
                            city = L.extend({}, city); // Get a shallow copy of data to keep it intact.
                            city.lng -= 360;
                        }

                        // city keys: code,GNIS,name,type,lat,lng
                        L.marker([city.lat, city.lng], {
                            icon: new L.DivIcon({
                                html: '<div style="background-color: ' + hsla + ';"><span>' + city.name + '</span></div>',
                                className: 'marker-city',
                                iconSize: null
                            })
                        }).
                            addTo(countyGroup).
                            bindPopup(
                            "City: " + city.name +
                            "<br />Code: " + city.code +
                            "<br />GNIS: " + city.GNIS +
                            "<br />Type: " + city.type +
                            "<br />From County: " + county.name +
                            "<br />Latitude: " + city.lat +
                            "<br />Longitude: " + city.lng
                        );
                        city = null;
                        citiesTotal += 1;
                    }

                    // In case a county has only 1 city, force a cluster so that the user sees the county icon at some point.
                    if (k === 1) {
                        countyGroup.options.forceSingletonClusterAtZoom = 17;
                    }

                    // countyGroup does not need to be added on map before adding markers into it,
                    // because we do not nest sub-groups into it.
                    countyGroup.addTo(map);
                    map.removeLayer(countyGroup);

                    // Add the county in State if not empty.
                    if (countyGroup._topClusterLevel.getChildCount()) {
                        // In case the State has only 1 county, force a cluster so that the user sees the State icon at some point.
                        if (stateData.stateCounties.length === 1) {
                            stateGroup.options.forceSingletonClusterAtZoom = countyGroup.getSingletonCluster()._zoom + 1;
                        }
                        stateGroup.addLayer(countyGroup);
                    }
                    countyGroup = null;
                    county = null;
                    hsl = null;
                    hsla = null;
                    county = null;
                    countiesTotal += 1;

                } else { // Not adding cities.
                    // county
                    // countyData keys: name,type,code,lat,lng
                    countyGroup = L.marker([county.lat, county.lng], {
                        icon: new L.DivIcon({
                            html: '<div style="background-color: ' + getHSL(hsl) + ';"><span>' + county.name  + " " + county.type + '</span></div>',
                            className: "marker-county",
                            iconSize: null
                        })
                    }).
                        bindPopup(
                        "County: " + county.name +
                        "<br />Code: " + county.code +
                        "<br />Type: " + county.type +
                        "<br />From State: " + stateData.stateName +
                        "<br />Latitude: " + county.lat +
                        "<br />Longitude: " + county.lng
                    );

                    // In case the State has only 1 county, force a cluster so that the user sees the State icon at some point.
                    if (stateData.stateCounties.length === 1) {
                        stateGroup.options.forceSingletonClusterAtZoom = 17;
                    }
                    stateGroup.addLayer(countyGroup);
                    countyGroup = null;
                    county = null;
                    countiesTotal += 1;
                }


            }

            // Clean stateGroup.
            map.removeLayer(stateGroup);

            // Add stateGroup to countryGroup if not empty.
            if (stateGroup._topClusterLevel.getChildCount()) {
                countryGroup.addLayer(stateGroup);
            }
            stateGroup = null;
            stateData = null;
        }

    }

// Since we have forced single marker clusters, remove them when not needed.
    countryGroup.cleanSingleMarkerClusters();

// If a group "center" latlng position is specified, use it to display the singleton cluster, instead of the weighted latlng.
    countryGroup.replaceSingletonLatLng();

// Bind labels if specified.
    countryGroup.setIconLabels();

// Hack to display layers that are in the viewport.
// Needed because we have disabled the display in addLayer().
    map.removeLayer(countryGroup);
    countryGroup.addTo(map);

    if (addCities) {
        console.log("Total Cities: " + countryGroup._topClusterLevel.getChildCount() + " added / " + citiesTotal + " in data");
        console.log("Total Counties: " + countiesTotal);
    } else {
        console.log("Total Counties: " + countryGroup._topClusterLevel.getChildCount() + " added / " + countiesTotal + " in data");
    }

}


