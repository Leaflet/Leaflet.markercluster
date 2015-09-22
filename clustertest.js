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

var map = L.map(
    'map',
    {
        center: [39.5, -98.35],
        zoom: 4,
        layers: [
            new L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
        ]
    }
);

// USA map
var i,
    j,
    k,
    hue = 1,
    hsl = {},
    hsla = "",
    USA = DATA.USA,
    link = USA.states,
    // USA keys: lat,lng,states
    countryGroup = L.markerClusterGroup({
        center: L.latLng(USA.lat, USA.lng),
        data: {
            name: "USA"
        },
        iconCreateFunction: function (cluster) {
            var alienClustersCount = cluster.getAlienClustersCount(),
                options = cluster._originalGroup.options,
                isSingleton = cluster.isSingletonCluster();

            return new L.DivIcon({
                html: '<div style="background-color: ' + "yellow" + '; border-color: ' +
                (isSingleton ? "black" : "red") + ';">' + alienClustersCount +
                (isSingleton ? '<span>' + options.data.name + '</span>' : "") + '</div>',
                className: isSingleton ? "marker-state" : 'marker-counties-cluster',
                iconSize: null
            });
        },
        setLabel: function (cluster) {
            var isSingleton = cluster.isSingletonCluster(),
                options = cluster._originalGroup.options;

            cluster.bindLabel(
                isSingleton ?
                    "States in " + options.data.name +
                    "<br />Total included cities: " + cluster.getChildCount() +
                    "<br />Lat: " + cluster._latlng.lat +
                    "<br />Lng: " + cluster._latlng.lng :

                    "States in part of " + options.data.name +
                    "<br />Total included cities: " + cluster.getChildCount(),
                {
                    offset: [25, -15]
                }
            );
        }
    }).addTo(map),
    stateCodes = Object.keys(link),
    stateGroup,
    stateData,
    county,
    countiesTotal = 0,
    countyGroup,
    city,
    citiesTotal = 0;

for(i = 0; i < stateCodes.length; i += 1) {
    if (true || stateCodes[i] === "HI" || stateCodes[i] === "DE" || stateCodes[i] === "DC") {
        // stateData keys: stateName,lat,lng,stateCounties
        stateData = link[stateCodes[i]];
        hue = getRandomHue2();
        hsl = {h: hue, s: 100, l: 50};
        stateGroup = L.markerClusterGroup({
            stateData: L.extend(L.extend({}, stateData), {stateCode: stateCodes[i]}),
            stateHue: hue,
            stateHSL: getHSL(hsl),
            stateHSLA: getHSLA(hsl, 0.6),
            center: L.latLng(stateData.lat, stateData.lng),
            iconCreateFunction: function (cluster) {
                var childCount = cluster.getChildCount(),
                    alienClustersCount = cluster.getAlienClustersCount(),
                    options = cluster._originalGroup.options,
                    isSingleton = cluster.isSingletonCluster();

                return new L.DivIcon({
                    html: '<div style="background-color: ' + options.stateHSL + '; border-color: ' +
                            (isSingleton ? "black" : options.stateHSLA) + ';">' + alienClustersCount +
                            (isSingleton ? '<span>' + options.stateData.stateName + '</span>' : "") + '</div>',
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
                        "<br />Total included cities: " + childCount :

                        "Counties in part of " + options.stateData.stateName +
                        "<br />Total included cities: " + childCount,
                    {
                        offset: [25, -15]
                    }
                );
            }
        }).addTo(map);

        for(j = 0; j < stateData.stateCounties.length; j += 1) {
            county = stateData.stateCounties[j];
            hsl = generateHSL(hue);
            hsla = getHSLA(hsl, 0.6);

            // Special case of county "Aleutians West" (code 16) in Alaska, coordinates [51.959447, 178.338813]
            // Wrap it back to negative longitude, so that it is displayed closer to the rest of the State.
            if (county.code === 16) {
                county.lng -= 360;
            }

            countyGroup = L.markerClusterGroup({
                // countyData keys: name,type,code,lat,lng
                countyData: L.extend({}, county),
                countyHSLA: hsla,
                countyHSL: getHSL(hsl),
                center: L.latLng(county.lat, county.lng),
                //forcedSingletonClusterAtZoom: 13,
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

            for(k = 0; k < county.cities.length; k += 1) {
                city = county.cities[k];

                // Special case of city (GNIS 2418783) in Alaska, coordinates [52.880248, 173.256076]
                // Wrap it back to negative longitude, so that it is displayed closer to the rest of the State.
                if (city.GNIS === 2418783) {
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
                countyGroup.options.forcedSingletonClusterAtZoom = 17;
            }

            countyGroup.addTo(map);
            map.removeLayer(countyGroup);

            //console.log("Adding county: " + county.name + " with cities: " + countyGroup._topClusterLevel.getChildCount());

            if (countyGroup._topClusterLevel.getChildCount()) {
                if (stateData.stateCounties.length === 1) {
                    stateGroup.options.forcedSingletonClusterAtZoom = countyGroup.getSingletonCluster()._zoom + 1;
                }
                stateGroup.addLayer(countyGroup);
            }
            //stateGroup.addLayer(countyGroup);
            countyGroup = null;
            county = null;
            hsl = null;
            hsla = null;
            county = null;
            countiesTotal += 1;
        }

        // Clean stateGroup.
        map.removeLayer(stateGroup);

        // Add stateGroup to countryGroup.
        countryGroup.addLayer(stateGroup);
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

console.log("Total Cities: " + countryGroup._topClusterLevel.getChildCount() + " / " + citiesTotal);
console.log("Total Counties: " + countryGroup._topClusterLevel.getChildCount() + " / " + countiesTotal);
