import { createSiteMap } from './map.js';

const LOCATION_ERROR_MESSAGE = '位置情報を取得できなかったため、回収場所を区ごとに表示します。';
const SITE_ERROR_MESSAGE = '回収場所を読み込めませんでした。';
const EMPTY_SITE_MESSAGE = '対応する回収場所が見つかりませんでした。';

const resultRoot = document.querySelector('[data-live-result="true"]');

if (resultRoot !== null) {
  const itemId = resultRoot.dataset.itemId;
  const locationInformation = document.querySelector('#location-information');
  const mapContainer = document.querySelector('#map-container');
  const sitesHeading = document.querySelector('#sites-heading');
  const loadingPanel = document.querySelector('#sites-loading');
  const feedbackPanel = document.querySelector('#sites-feedback');
  const feedbackMessage = document.querySelector('#sites-feedback-message');
  const retryButton = document.querySelector('#sites-retry');
  const resultsPanel = document.querySelector('#sites-results');

  let requestLocation = null;
  let mapController = null;

  function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function setLoading() {
    loadingPanel.hidden = false;
    loadingPanel.setAttribute('aria-busy', 'true');
    feedbackPanel.hidden = true;
    resultsPanel.hidden = true;
  }

  function setMapLoading(message = '回収場所の地図を準備しています。') {
    if (mapController !== null) {
      mapController.destroy();
      mapController = null;
    }

    mapContainer.className = 'map-placeholder';
    mapContainer.setAttribute('role', 'status');
    mapContainer.setAttribute('aria-label', message);
    mapContainer.replaceChildren(createTextElement('span', '', message));
  }

  function showFeedback(message, canRetry = false) {
    loadingPanel.hidden = true;
    loadingPanel.setAttribute('aria-busy', 'false');
    resultsPanel.hidden = true;
    feedbackMessage.textContent = message;
    retryButton.hidden = !canRetry;
    feedbackPanel.classList.toggle('state-panel-error', canRetry);
    feedbackPanel.setAttribute('role', canRetry ? 'alert' : 'status');
    feedbackPanel.hidden = false;
  }

  function disableMapButtons() {
    resultsPanel.querySelectorAll('[data-map-site-id]').forEach((button) => {
      button.disabled = true;
    });
  }

  function enableMapButtons() {
    resultsPanel.querySelectorAll('[data-map-site-id]').forEach((button) => {
      button.disabled = false;
    });
  }

  function scrollMapIntoViewIfNeeded() {
    const mapPosition = mapContainer.getBoundingClientRect();
    const isOutsideViewport = mapPosition.top < 0
      || mapPosition.bottom > window.innerHeight;

    if (isOutsideViewport) {
      mapContainer.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }

  function createGoogleMapsLink(site) {
    const destination = `${site.latitude},${site.longitude}`;
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('destination', destination);

    const link = createTextElement('a', 'button', 'Googleマップで経路');
    link.href = url.toString();
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function createSiteCard(site, rank, hasLocation) {
    const card = document.createElement('li');
    card.className = 'site-card';

    if (hasLocation) {
      const meta = document.createElement('div');
      meta.className = 'site-card-meta';
      meta.append(
        createTextElement('span', 'site-rank', String(rank)),
        createTextElement('span', 'site-distance', `${site.distanceKm.toFixed(1)} km`),
      );
      card.append(meta);
    }

    card.append(
      createTextElement('h3', 'site-name', site.name),
      createTextElement('p', 'site-detail', site.address),
      createTextElement(
        'p',
        'site-detail site-hours',
        `利用時間：${site.businessHours === null || site.businessHours.trim() === '' ? '情報なし' : site.businessHours}`,
      ),
    );

    const actions = document.createElement('div');
    actions.className = 'site-actions';

    const mapButton = createTextElement('button', 'button', '地図で見る');
    mapButton.type = 'button';
    mapButton.dataset.mapSiteId = String(site.id);
    mapButton.disabled = true;
    mapButton.addEventListener('click', () => {
      if (
        mapController !== null
        && mapController.focusSite(site.id)
      ) {
        scrollMapIntoViewIfNeeded();
      }
    });

    actions.append(mapButton, createGoogleMapsLink(site));
    card.append(actions);
    return card;
  }

  function renderLocatedSites(sites) {
    const list = document.createElement('ol');
    list.className = 'site-list';
    sites.forEach((site, index) => {
      list.append(createSiteCard(site, index + 1, true));
    });
    resultsPanel.replaceChildren(list);
  }

  function renderGroupedSites(sites) {
    const wardList = document.createElement('div');
    wardList.className = 'ward-list';
    let currentWard = null;
    let currentList = null;

    sites.forEach((site) => {
      if (site.ward !== currentWard) {
        currentWard = site.ward;
        const wardGroup = document.createElement('section');
        wardGroup.className = 'ward-group';
        wardGroup.append(createTextElement('h3', 'ward-heading', currentWard));
        currentList = document.createElement('ul');
        currentList.className = 'site-list ward-site-list';
        wardGroup.append(currentList);
        wardList.append(wardGroup);
      }

      currentList.append(createSiteCard(site, null, false));
    });

    resultsPanel.replaceChildren(wardList);
  }

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
  }

  function isValidCoordinate(value, minimum, maximum) {
    return typeof value === 'number'
      && Number.isFinite(value)
      && value >= minimum
      && value <= maximum;
  }

  function isValidSite(site, hasLocation) {
    if (site === null || typeof site !== 'object' || Array.isArray(site)) {
      return false;
    }

    const numericId = Number(site.id);
    const hasValidBaseValues = Number.isInteger(numericId)
      && numericId > 0
      && isNonEmptyString(site.name)
      && isNonEmptyString(site.reading)
      && isNonEmptyString(site.ward)
      && isNonEmptyString(site.address)
      && isValidCoordinate(site.latitude, -90, 90)
      && isValidCoordinate(site.longitude, -180, 180)
      && (site.businessHours === null || typeof site.businessHours === 'string');

    if (!hasValidBaseValues) {
      return false;
    }

    if (hasLocation) {
      return typeof site.distanceKm === 'number'
        && Number.isFinite(site.distanceKm)
        && site.distanceKm >= 0;
    }

    return site.distanceKm === null;
  }

  function showMapForSites(sites, hasLocation) {
    mapController = createSiteMap({
      container: mapContainer,
      sites,
      currentLocation: requestLocation,
      hasLocation,
      onReady: enableMapButtons,
      onFailure: disableMapButtons,
    });

    if (mapController === null) {
      disableMapButtons();
    }
  }

  function renderSites(sites, hasLocation) {
    loadingPanel.hidden = true;
    loadingPanel.setAttribute('aria-busy', 'false');
    feedbackPanel.hidden = true;

    if (sites.length === 0) {
      resultsPanel.hidden = true;
      showFeedback(EMPTY_SITE_MESSAGE);
      showMapForSites([], false);
      return;
    }

    if (hasLocation) {
      renderLocatedSites(sites);
    } else {
      renderGroupedSites(sites);
    }

    resultsPanel.hidden = false;
    showMapForSites(sites, hasLocation);
  }

  function buildRequestUrl() {
    const url = new URL(
      `/api/items/${encodeURIComponent(itemId)}/sites`,
      window.location.origin,
    );

    if (requestLocation !== null) {
      url.searchParams.set('lat', String(requestLocation.latitude));
      url.searchParams.set('lng', String(requestLocation.longitude));
    }

    return url;
  }

  async function loadSites() {
    const hasLocation = requestLocation !== null;
    setLoading();
    setMapLoading();

    try {
      const response = await fetch(buildRequestUrl(), {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Site request failed');
      }

      const data = await response.json();
      if (
        data === null
        || typeof data !== 'object'
        || !Array.isArray(data.sites)
        || !data.sites.every((site) => isValidSite(site, hasLocation))
      ) {
        throw new Error('Invalid site response');
      }

      renderSites(data.sites, hasLocation);
    } catch (error) {
      setMapLoading('回収場所を取得できないため、地図を表示できません。');
      showFeedback(SITE_ERROR_MESSAGE, true);
    }
  }

  function getCurrentLocation() {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          if (
            isValidCoordinate(latitude, -90, 90)
            && isValidCoordinate(longitude, -180, 180)
          ) {
            resolve({ latitude, longitude });
            return;
          }

          resolve(null);
        },
        () => resolve(null),
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        },
      );
    });
  }

  async function start() {
    requestLocation = await getCurrentLocation();
    const hasLocation = requestLocation !== null;

    sitesHeading.textContent = hasLocation
      ? '回収場所（近い順）'
      : '回収場所（区ごと）';

    if (!hasLocation) {
      locationInformation.textContent = LOCATION_ERROR_MESSAGE;
      locationInformation.hidden = false;
    }

    await loadSites();
  }

  retryButton.addEventListener('click', loadSites);
  start();
}
