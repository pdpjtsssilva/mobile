import MapboxGL from '@rnmapbox/maps';
import { MAPBOX_ACCESS_TOKEN } from './config';

const applyMapboxDefaults = () => {
  if (typeof MapboxGL.setAccessToken === 'function' && MAPBOX_ACCESS_TOKEN) {
    try {
      MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);
    } catch (error) {
      // Ignore init errors; map will report if token is invalid.
    }
  }
  if (typeof MapboxGL.setTelemetryEnabled === 'function') {
    try {
      MapboxGL.setTelemetryEnabled(false);
    } catch (error) {
      // Ignore.
    }
  }
};

applyMapboxDefaults();

export const initMapbox = async () => {
  applyMapboxDefaults();
};

export default MapboxGL;
