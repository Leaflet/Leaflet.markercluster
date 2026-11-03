import * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../dist/MarkerCluster.css';
import '../dist/MarkerCluster.Default.css';

// the plugin still patches a global L, which must exist before its modules evaluate
globalThis.L = {...Leaflet};
await import('../src/index.js');
