(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['leaflet'], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('leaflet'));
    } else {
        root.returnExports = factory(root.L);
    }
}(this, function (L) {
	
// $COMBINED
	
    return L;
}));
