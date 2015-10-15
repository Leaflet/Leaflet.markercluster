describe('Option removeOutsideVisibleBounds', function () {

	/**
	 * Wrapper for Mocha's `it` function, to avoid using `beforeEach` and `afterEach`
	 * which create problems with PhantomJS when total number of tests (across all suites)
	 * increases. Might be due to use of promises for which PhantomJS performs badly?
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

		// Nothing for this test suite.

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

	var marker1 = L.marker([1.5, -0.4]), // 2 screens width away.
	    marker2 = L.marker([1.5, 0.6]), // 1 screen width away.
	    marker3 = L.marker([1.5, 1.5]), // In view port.
	    marker4 = L.marker([1.5, 2.4]), // 1 screen width away.
	    marker5 = L.marker([1.5, 3.4]), // 2 screens width away.
	    div, map, group, previousMobileSetting;

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

	// Add all markers once to map then remove them immediately so that their icon is null (instead of undefined).
	map.removeLayer(marker1.addTo(map));
	map.removeLayer(marker2.addTo(map));
	map.removeLayer(marker3.addTo(map));
	map.removeLayer(marker4.addTo(map));
	map.removeLayer(marker5.addTo(map));


	function prepareGroup() {

		// Group should be assigned with a Marker Cluster Group before calling this function.
		group.addTo(map);

		// Add markers 1 by 1 to make sure we do not create an async process.
		marker1.addTo(group);
		marker2.addTo(group);
		marker3.addTo(group);
		marker4.addTo(group);
		marker5.addTo(group);
	}


	/////////////////////////////
	// TESTS
	/////////////////////////////

	it2('removes objects more than 1 screen away from view port by default', function () {

		group = L.markerClusterGroup();

		prepareGroup();

		expect(marker1._icon).to.be(null);
		expect(map._panes.markerPane.childNodes.length).to.be(3); // markers 2, 3 and 4.
		expect(marker5._icon).to.be(null);

	});

	it2(
		'removes objects out of view port by default for mobile device',

		function () {

			// Fool Leaflet, make it thinks it runs on a mobile device.
			previousMobileSetting = L.Browser.mobile;
			L.Browser.mobile = true;

			group = L.markerClusterGroup();

			prepareGroup();

			expect(marker1._icon).to.be(null);
			expect(marker2._icon).to.be(null);
			expect(map._panes.markerPane.childNodes.length).to.be(1); // marker 3 only.
			expect(marker4._icon).to.be(null);
			expect(marker5._icon).to.be(null);

		},

		// Extra final instruction to be called even on failure.
		function () {
			// Restore original setting, so that next tests are unaffected.
			L.Browser.mobile = previousMobileSetting;
		}
	);

	it2('leaves all objects on map when set to false', function () {

		group = L.markerClusterGroup({
			removeOutsideVisibleBounds: false
		});

		prepareGroup();

		expect(map._panes.markerPane.childNodes.length).to.be(5); // All 5 markers.

	});


	/////////////////////////////
	// CLEAN UP CODE
	/////////////////////////////

	map.remove();
	document.body.removeChild(div);

});
