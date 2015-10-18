describe('animate option', function () {

	/**
	 * Wrapper for Mocha's `it` function, to avoid using `beforeEach` and `afterEach`
	 * which create problems with PhantomJS when total number of tests (across all suites)
	 * increases. Might be due to use of promises for which PhantomJS would performs badly?
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

	var div, map, group, previousTransitionSetting;

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

	it2('hooks animated methods version by default', function () {

		// Need to add to map so that we have the top cluster level created.
		group = L.markerClusterGroup().addTo(map);

		var withAnimation = L.MarkerClusterGroup.prototype._withAnimation;

		// MCG animated methods.
		expect(group._animationStart).to.be(withAnimation._animationStart);
		expect(group._animationZoomIn).to.be(withAnimation._animationZoomIn);
		expect(group._animationZoomOut).to.be(withAnimation._animationZoomOut);
		expect(group._animationAddLayer).to.be(withAnimation._animationAddLayer);

		// MarkerCluster spiderfy animated methods
		var cluster = group._topClusterLevel;

		withAnimation = L.MarkerCluster.prototype;

		expect(cluster._animationSpiderfy).to.be(withAnimation._animationSpiderfy);
		expect(cluster._animationUnspiderfy).to.be(withAnimation._animationUnspiderfy);

	});

	it2('hooks non-animated methods version when set to false', function () {

		// Need to add to map so that we have the top cluster level created.
		group = L.markerClusterGroup({animate: false}).addTo(map);

		var noAnimation = L.MarkerClusterGroup.prototype._noAnimation;

		// MCG non-animated methods.
		expect(group._animationStart).to.be(noAnimation._animationStart);
		expect(group._animationZoomIn).to.be(noAnimation._animationZoomIn);
		expect(group._animationZoomOut).to.be(noAnimation._animationZoomOut);
		expect(group._animationAddLayer).to.be(noAnimation._animationAddLayer);

		// MarkerCluster spiderfy non-animated methods
		var cluster = group._topClusterLevel;

		noAnimation = L.MarkerClusterNonAnimated.prototype;

		expect(cluster._animationSpiderfy).to.be(noAnimation._animationSpiderfy);
		expect(cluster._animationUnspiderfy).to.be(noAnimation._animationUnspiderfy);

	});

	it2(
		'always hooks non-animated methods version when L.DomUtil.TRANSITION is false',

		function () {

			previousTransitionSetting = L.DomUtil.TRANSITION;
			// Fool Leaflet, make it think the browser does not support transitions.
			L.DomUtil.TRANSITION = false;

			// Need to add to map so that we have the top cluster level created.
			group = L.markerClusterGroup({animate: true}).addTo(map);

			var noAnimation = L.MarkerClusterGroup.prototype._noAnimation;

			// MCG non-animated methods.
			expect(group._animationStart).to.be(noAnimation._animationStart);
			expect(group._animationZoomIn).to.be(noAnimation._animationZoomIn);
			expect(group._animationZoomOut).to.be(noAnimation._animationZoomOut);
			expect(group._animationAddLayer).to.be(noAnimation._animationAddLayer);

			// MarkerCluster spiderfy non-animated methods
			var cluster = group._topClusterLevel;

			noAnimation = L.MarkerClusterNonAnimated.prototype;

			expect(cluster._animationSpiderfy).to.be(noAnimation._animationSpiderfy);
			expect(cluster._animationUnspiderfy).to.be(noAnimation._animationUnspiderfy);

		},

		function () {
			// Restore previous setting so that next tests are unaffected.
			L.DomUtil.TRANSITION = previousTransitionSetting;
		}
	);


	/////////////////////////////
	// CLEAN UP CODE
	/////////////////////////////

	map.remove();
	document.body.removeChild(div);

});
