const CHIBA_CITY_HALL = [35.6071392, 140.1064909];
const EMPTY_MAP_ZOOM = 11;
const FOCUS_ZOOM = 16;
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

function createMarkerIcon(className, label = '') {
  return window.L.divIcon({
    className: 'custom-map-icon',
    html: `<span class="${className}">${label}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -17],
  });
}

function createPopupContent(site, hasLocation) {
  const wrapper = document.createElement('div');
  const name = document.createElement('strong');
  const address = document.createElement('p');

  name.textContent = site.name;
  address.textContent = site.address;
  wrapper.append(name, address);

  if (hasLocation) {
    const distance = document.createElement('p');
    distance.textContent = `直線距離：${site.distanceKm.toFixed(1)} km`;
    wrapper.append(distance);
  }

  return wrapper;
}

function showMapFailure(container, map, onFailure) {
  if (map !== null) {
    map.remove();
  }

  container.className = 'map-placeholder map-unavailable';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-label', '地図を読み込めませんでした');

  const message = document.createElement('p');
  message.textContent = '地図を読み込めませんでした。回収場所一覧とGoogleマップは利用できます。';
  container.replaceChildren(message);
  onFailure();
}

export function createSiteMap({
  container,
  sites,
  currentLocation,
  hasLocation,
  onReady,
  onFailure,
}) {
  if (window.L === undefined) {
    showMapFailure(container, null, onFailure);
    return null;
  }

  let map;

  try {
    container.replaceChildren();
    container.className = 'map-canvas';
    container.removeAttribute('role');
    container.setAttribute('aria-label', '回収場所の地図');

    map = window.L.map(container, {
      scrollWheelZoom: false,
    });

    const markersById = new Map();
    let initialTileRequests = 0;
    let initialTileSuccesses = 0;
    let initialTileFailures = 0;
    let initialLoadFinished = false;

    const tileLayer = window.L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    });

    tileLayer.on('tileloadstart', () => {
      if (!initialLoadFinished) {
        initialTileRequests += 1;
      }
    });

    tileLayer.on('tileload', () => {
      if (!initialLoadFinished) {
        initialTileSuccesses += 1;
      }
    });

    tileLayer.on('tileerror', () => {
      if (!initialLoadFinished) {
        initialTileFailures += 1;
      }
    });

    tileLayer.on('load', () => {
      if (initialLoadFinished) {
        return;
      }

      initialLoadFinished = true;
      if (
        initialTileRequests > 0
        && initialTileSuccesses === 0
        && initialTileFailures === initialTileRequests
      ) {
        showMapFailure(container, map, onFailure);
        map = null;
        return;
      }

      onReady();
    });

    tileLayer.addTo(map);

    if (sites.length === 0) {
      map.setView(CHIBA_CITY_HALL, EMPTY_MAP_ZOOM);
    } else {
      const bounds = [];

      if (hasLocation) {
        const currentMarker = window.L.marker(
          [currentLocation.latitude, currentLocation.longitude],
          {
            icon: createMarkerIcon('map-marker map-marker-current'),
            title: '現在地',
            alt: '現在地',
          },
        ).addTo(map);
        currentMarker.bindPopup('現在地');
        bounds.push([currentLocation.latitude, currentLocation.longitude]);
      }

      sites.forEach((site, index) => {
        const rankLabel = hasLocation ? String(index + 1) : '';
        const marker = window.L.marker(
          [site.latitude, site.longitude],
          {
            icon: createMarkerIcon('map-marker map-marker-site', rankLabel),
            title: site.name,
            alt: site.name,
          },
        ).addTo(map);

        marker.bindPopup(createPopupContent(site, hasLocation));
        markersById.set(String(site.id), marker);
        bounds.push([site.latitude, site.longitude]);
      });

      map.fitBounds(bounds, {
        padding: [24, 24],
        maxZoom: 14,
      });
    }

    return {
      focusSite(siteId) {
        const marker = markersById.get(String(siteId));
        if (map === null || marker === undefined) {
          return false;
        }

        map.setView(marker.getLatLng(), FOCUS_ZOOM);
        marker.openPopup();
        return true;
      },
      destroy() {
        if (map !== null) {
          map.remove();
          map = null;
        }
      },
    };
  } catch (error) {
    showMapFailure(container, map || null, onFailure);
    return null;
  }
}
