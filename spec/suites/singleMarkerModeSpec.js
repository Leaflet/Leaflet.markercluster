describe('singleMarkerMode option', function () {

	/**
	 * Wrapper for Mocha's `it` function, to avoid using `beforeEach` and `afterEach`
	 * which create problems with PhantomJS when total number of tests (across all suites)
	 * increases. Might be due to use of promises for which PhantomJS would perform badly?
	 * NOTE: works only with synchronous code.
	 * @param testDescription string
	 * @param testInstructions function
	 * @param testFinally function to be executed just before afterEach2, in the `finally` block.
	 */
	function it2(testDescription, testInstructions, testFinally) {

		it(testDescription, function () {

			// Before each test.
			if (typeof beforeEach2 === "function") {
				beforeEach2();
			}

			try {

				// Perform the actual test instructions.
				testInstructions();

			} catch (e) {

				// Re-throw the exception so that Mocha sees the failed test.
				throw e;

			} finally {

				// If specific final instructions are provided.
				if (typeof testFinally === "function") {
					testFinally();
				}

				// After each test.
				if (typeof afterEach2 === "function") {
					afterEach2();
				}

			}
		});
	}


	/////////////////////////////
	// SETUP FOR EACH TEST
	/////////////////////////////

	/**
	 * Instructions to be executed before each test called with `it2`.
	 */
	function beforeEach2() {

		// Reset the marker icon.
		marker.setIcon(defaultIcon);

	}

	/**
	 * Instructions to be executed after each test called with `it2`.
	 */
	function afterEach2() {

		if (group instanceof L.MarkerClusterGroup) {
			group.removeLayers(group.getLayers());
			map.removeLayer(group);
		}

		// Throw away group as it can be assigned with different configurations between tests.
		group = null;
	}


	/////////////////////////////
	// PREPARATION CODE
	/////////////////////////////

	var div, map, group;

	var defaultIcon = new L.Icon.Default(),
	    clusterIcon = new L.Icon.Default(),
		marker = L.marker([1.5, 1.5]);

	div = document.createElement('div');
	div.style.width = '200px';
	div.style.height = '200px';
	document.body.appendChild(div);

	map = L.map(div, { maxZoom: 18 });

	// Corresponds to zoom level 8 for the above div dimensions.
	map.fitBounds(new L.LatLngBounds([
		[1, 1],
		[2, 2]
	]));


	/////////////////////////////
	// TESTS
	/////////////////////////////

	it2('overrides marker icons when set to true', function () {

		group = L.markerClusterGroup({
			singleMarkerMode: true,
			iconCreateFunction: function (layer) {
				return clusterIcon;
			}
		}).addTo(map);

		expect(marker.options.icon).to.equal(defaultIcon);

		marker.addTo(group);

		expect(marker.options.icon).to.equal(clusterIcon);

	});

	it2('does not modify marker icons by default (or set to false)', function () {

		group = L.markerClusterGroup({
			iconCreateFunction: function (layer) {
				return clusterIcon;
			}
		}).addTo(map);

		expect(marker.options.icon).to.equal(defaultIcon);

		marker.addTo(group);

		expect(marker.options.icon).to.equal(defaultIcon);

	});


	/////////////////////////////
	// CLEAN UP CODE
	/////////////////////////////

	map.remove();
	document.body.removeChild(div);

});
