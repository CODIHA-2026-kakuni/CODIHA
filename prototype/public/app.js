const CHIBA_CENTER = [35.6074, 140.1065];

const elements = {
  locateButton: document.querySelector("#locate-button"),
  retryButton: document.querySelector("#retry-button"),
  statusMessage: document.querySelector("#status-message"),
  errorPanel: document.querySelector("#error-panel"),
  errorMessage: document.querySelector("#error-message"),
  resultCount: document.querySelector("#result-count"),
  siteList: document.querySelector("#site-list"),
  mapCaption: document.querySelector("#map-caption"),
  mapFallback: document.querySelector("#map-fallback"),
};

let map;
let tileErrorCount = 0;
let userMarker;
let latestOrigin = null;
let latestSites = [];
const siteMarkers = new Map();

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createSiteIcon(site, rank, selected = false) {
  const label = rank ? String(rank) : "●";
  return window.L.divIcon({
    className: "site-marker-wrap",
    html: `<div class="site-marker${selected ? " is-selected" : ""}"><span aria-hidden="true">${label}</span><span class="screen-reader-only">${escapeHtml(site.name)}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -28],
  });
}

function initializeMap() {
  if (!window.L) {
    elements.mapFallback.hidden = false;
    return;
  }

  map = window.L.map("map", { zoomControl: true }).setView(CHIBA_CENTER, 10);
  const tiles = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
  });

  tiles.on("tileerror", () => {
    tileErrorCount += 1;
    if (tileErrorCount >= 3) {
      elements.mapFallback.hidden = false;
    }
  });

  tiles.addTo(map);
}

function setStatus(message) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.hidden = false;
}

function clearError() {
  elements.errorPanel.hidden = true;
  elements.errorMessage.textContent = "";
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorPanel.hidden = false;
  elements.siteList.setAttribute("aria-busy", "false");
}

function googleMapsUrl(site) {
  const destination = `${site.latitude},${site.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function renderSites(sites, hasOrigin) {
  elements.siteList.replaceChildren();

  for (const [index, site] of sites.entries()) {
    const article = document.createElement("article");
    article.className = "site-card";
    article.id = `site-${site.id}`;
    article.dataset.siteId = String(site.id);

    article.innerHTML = `
      <div class="site-card-header">
        <span class="rank" aria-label="${hasOrigin ? `${index + 1}番目` : "掲載順"}">${
          hasOrigin ? index + 1 : site.displayOrder
        }</span>
        <div class="site-title-area">
          <span class="site-ward">${escapeHtml(site.ward)}</span>
          <h3>${escapeHtml(site.name)}</h3>
        </div>
        ${hasOrigin ? `<span class="distance">約${site.distanceKm.toFixed(2)} km</span>` : ""}
      </div>
      <div class="site-details">
        <div class="detail-row">
          <span class="detail-label">住所</span>
          <span>${escapeHtml(site.address)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">利用時間</span>
          <span>${escapeHtml(site.hoursText)}</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="focus-map-button" type="button" data-focus-site="${site.id}">地図で見る</button>
        <a class="map-link" href="${googleMapsUrl(
          site,
        )}" target="_blank" rel="noopener noreferrer">Googleマップで経路</a>
      </div>
    `;

    elements.siteList.append(article);
  }

  elements.siteList.setAttribute("aria-busy", "false");
}

function clearSelectedSite() {
  document.querySelectorAll(".site-card.is-selected").forEach((card) => {
    card.classList.remove("is-selected");
  });

  for (const [siteId, marker] of siteMarkers) {
    const index = latestSites.findIndex((site) => site.id === siteId);
    const site = latestSites[index];
    marker.setIcon(createSiteIcon(site, latestOrigin ? index + 1 : null));
  }
}

function selectSite(siteId, { scrollToCard = false } = {}) {
  const site = latestSites.find((candidate) => candidate.id === siteId);
  const marker = siteMarkers.get(siteId);
  const card = document.querySelector(`[data-site-id="${siteId}"]`);
  if (!site || !marker || !card) return;

  clearSelectedSite();
  card.classList.add("is-selected");
  const rank = latestOrigin ? latestSites.findIndex((candidate) => candidate.id === siteId) + 1 : null;
  marker.setIcon(createSiteIcon(site, rank, true));
  marker.openPopup();
  map?.setView([site.latitude, site.longitude], Math.max(map.getZoom(), 14), { animate: true });

  if (scrollToCard) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function renderMap(sites, origin) {
  if (!map) return;

  for (const marker of siteMarkers.values()) {
    marker.removeFrom(map);
  }
  siteMarkers.clear();

  sites.forEach((site, index) => {
    const marker = window.L.marker([site.latitude, site.longitude], {
      icon: createSiteIcon(site, origin ? index + 1 : null),
      keyboard: true,
      title: site.name,
    });
    marker.bindPopup(
      `<strong class="popup-name">${escapeHtml(site.name)}</strong><span class="popup-address">${escapeHtml(
        site.address,
      )}</span>`,
    );
    marker.on("click", () => selectSite(site.id, { scrollToCard: true }));
    marker.addTo(map);
    siteMarkers.set(site.id, marker);
  });

  if (userMarker) {
    userMarker.removeFrom(map);
    userMarker = undefined;
  }

  if (origin) {
    userMarker = window.L.circleMarker([origin.latitude, origin.longitude], {
      radius: 9,
      color: "#ffffff",
      weight: 3,
      fillColor: "#125b8f",
      fillOpacity: 1,
    })
      .bindPopup("現在地")
      .addTo(map);

    const nearestSites = sites.slice(0, 5);
    const bounds = window.L.latLngBounds([
      [origin.latitude, origin.longitude],
      ...nearestSites.map((site) => [site.latitude, site.longitude]),
    ]);
    map.fitBounds(bounds, { padding: [34, 34], maxZoom: 13 });
    elements.mapCaption.textContent = "現在地と近い回収場所を表示しています。";
  } else {
    const bounds = window.L.latLngBounds(sites.map((site) => [site.latitude, site.longitude]));
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 11 });
    elements.mapCaption.textContent = "千葉市内の回収場所を表示しています。";
  }
}

async function loadSites(origin = null) {
  clearError();
  elements.siteList.setAttribute("aria-busy", "true");
  const query = origin
    ? `?lat=${encodeURIComponent(origin.latitude)}&lng=${encodeURIComponent(origin.longitude)}`
    : "";

  try {
    const response = await fetch(`/api/sites${query}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "回収場所を読み込めませんでした。");
    }

    latestOrigin = data.origin;
    latestSites = data.sites;
    elements.resultCount.textContent = `${data.count}か所`;
    renderSites(data.sites, Boolean(data.origin));
    renderMap(data.sites, data.origin);

    if (data.origin) {
      setStatus("現在地から近い順に表示しています。距離は直線距離の目安です。");
    } else {
      setStatus("現在地を使わず、千葉市の公式掲載順で全拠点を表示しています。");
    }
  } catch (error) {
    showError(error.message);
    setStatus("回収場所の読み込みに失敗しました。");
  }
}

function locateUser() {
  if (!navigator.geolocation) {
    setStatus("この端末では位置情報を利用できないため、全拠点を表示しています。");
    loadSites();
    return;
  }

  elements.locateButton.disabled = true;
  elements.locateButton.textContent = "現在地を確認しています…";
  setStatus("位置情報の許可を確認しています。");

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      await loadSites({ latitude: coords.latitude, longitude: coords.longitude });
      elements.locateButton.disabled = false;
      elements.locateButton.innerHTML = '<span aria-hidden="true">◎</span>現在地を更新する';
    },
    async () => {
      await loadSites();
      setStatus(
        "位置情報を取得できなかったため、全拠点を表示しています。端末の設定を確認すると再度試せます。",
      );
      elements.locateButton.disabled = false;
      elements.locateButton.innerHTML = '<span aria-hidden="true">◎</span>現在地から探す';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
  );
}

elements.locateButton.addEventListener("click", locateUser);
elements.retryButton.addEventListener("click", () => loadSites(latestOrigin));
elements.siteList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-focus-site]");
  if (!button) return;
  selectSite(Number(button.dataset.focusSite));
  document.querySelector(".map-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

initializeMap();
loadSites();
