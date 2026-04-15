import { useMemo } from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { OnShouldStartLoadWithRequest } from "react-native-webview/lib/WebViewTypes";

type Coordinates = {
  lat: number;
  lng: number;
};

type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  tone: "live" | "queued";
};

type OpenStreetMapViewProps = {
  center: Coordinates;
  currentLocation?: Coordinates | null;
  markers?: MapMarker[];
  mode?: "browse" | "pick";
  onCenterChange?: (coordinates: Coordinates) => void;
  onMarkerPress?: (markerId: string) => void;
  reloadKey?: string;
  style?: StyleProp<ViewStyle>;
};

type WebMessage =
  | {
      type: "center-change";
      lat: number;
      lng: number;
    }
  | {
      type: "marker-press";
      id: string;
    };

const LEAFLET_SCRIPT_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_STYLESHEET_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

export function OpenStreetMapView({
  center,
  currentLocation = null,
  markers = [],
  mode = "browse",
  onCenterChange,
  onMarkerPress,
  reloadKey,
  style,
}: OpenStreetMapViewProps) {
  const centerDependency =
    mode === "pick"
      ? reloadKey ?? "default"
      : `${center.lat.toFixed(5)}:${center.lng.toFixed(5)}`;

  const html = useMemo(
    () =>
      buildMapHtml({
        center,
        currentLocation,
        markers,
        mode,
      }),
    [centerDependency, currentLocation, markers, mode],
  );
  const source = useMemo(() => ({ html }), [html]);

  const webViewKey = useMemo(() => {
    const markerKey = markers
      .map((marker) => `${marker.id}:${marker.lat.toFixed(5)}:${marker.lng.toFixed(5)}:${marker.tone}`)
      .join("|");
    const currentLocationKey = currentLocation
      ? `${currentLocation.lat.toFixed(5)}:${currentLocation.lng.toFixed(5)}`
      : "none";

    return [
      reloadKey ?? "default",
      mode,
      centerDependency,
      currentLocationKey,
      markerKey,
    ].join("::");
  }, [centerDependency, currentLocation, markers, mode, reloadKey]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as WebMessage;

      if (message.type === "center-change") {
        onCenterChange?.({ lat: message.lat, lng: message.lng });
        return;
      }

      if (message.type === "marker-press") {
        onMarkerPress?.(message.id);
      }
    } catch {
      // Ignore malformed bridge messages from the embedded page.
    }
  }

  const handleShouldStartLoad: OnShouldStartLoadWithRequest = (request) => {
    return request.url === "about:blank" || request.url.startsWith("data:text/html");
  };

  return (
    <WebView
      javaScriptEnabled
      domStorageEnabled
      key={webViewKey}
      onMessage={handleMessage}
      onShouldStartLoadWithRequest={handleShouldStartLoad}
      originWhitelist={["about:blank", "data:*"]}
      scrollEnabled={false}
      setSupportMultipleWindows={false}
      source={source}
      style={[styles.webView, style]}
    />
  );
}

function buildMapHtml(options: {
  center: Coordinates;
  currentLocation: Coordinates | null;
  markers: MapMarker[];
  mode: "browse" | "pick";
}) {
  const payload = JSON.stringify(options);
  const zoomLevel =
    options.mode === "pick"
      ? 17
      : options.markers.length > 0 || options.currentLocation
        ? 16
        : 14;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    />
    <link rel="stylesheet" href="${LEAFLET_STYLESHEET_URL}" />
    <style>
      html, body, #map {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #161719;
        overflow: hidden;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .leaflet-container {
        background: #161719;
      }

      .leaflet-tile {
        image-rendering: auto;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        transform: translateZ(0);
      }

      .leaflet-control-attribution {
        background: rgba(28, 29, 31, 0.82);
        color: #f5f5f5;
        border-radius: 10px 0 0 0;
        padding: 2px 8px;
        pointer-events: none;
      }

      .leaflet-control-attribution a {
        color: #f5f5f5;
        pointer-events: none;
        text-decoration: none;
      }

      .marker-shell {
        width: 24px;
        height: 24px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      }

      .marker-shell.live {
        background: rgba(233, 107, 57, 0.2);
        border: 1px solid rgba(233, 107, 57, 0.45);
      }

      .marker-shell.queued {
        background: rgba(199, 193, 181, 0.2);
        border: 1px solid rgba(199, 193, 181, 0.45);
      }

      .marker-dot {
        width: 8px;
        height: 8px;
        border-radius: 4px;
        background: #e96b39;
      }

      .marker-shell.queued .marker-dot {
        background: #c7c1b5;
      }

      .user-dot {
        width: 14px;
        height: 14px;
        border-radius: 7px;
        background: #1f8fff;
        border: 2px solid #ffffff;
        box-shadow: 0 0 0 6px rgba(31, 143, 255, 0.18);
        box-sizing: border-box;
      }

      .leaflet-control-zoom {
        margin: 16px 16px 0 0;
        border: none;
        box-shadow: none;
      }

      .leaflet-control-zoom a {
        width: 36px;
        height: 36px;
        line-height: 34px;
        border: none;
        color: #ffffff;
        background: rgba(28, 29, 31, 0.9);
      }

      .leaflet-control-zoom a:first-child {
        border-radius: 12px 12px 0 0;
      }

      .leaflet-control-zoom a:last-child {
        border-radius: 0 0 12px 12px;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="${LEAFLET_SCRIPT_URL}"></script>
    <script>
      const payload = ${payload};

      const bridge = {
        post(message) {
          if (!window.ReactNativeWebView) {
            return;
          }

          window.ReactNativeWebView.postMessage(JSON.stringify(message));
        },
      };

      const map = L.map("map", {
        attributionControl: true,
        fadeAnimation: false,
        markerZoomAnimation: true,
        preferCanvas: false,
        zoomAnimation: true,
        zoomControl: true,
        zoomDelta: 0.5,
        zoomSnap: 0.5,
      });

      L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "&copy; Esri and contributors",
          keepBuffer: 4,
          maxNativeZoom: 19,
          maxZoom: 20,
          tileSize: 256,
          updateWhenZooming: false,
        },
      ).addTo(map);

      map.setView([payload.center.lat, payload.center.lng], ${zoomLevel});

      function buildMarkerIcon(tone) {
        return L.divIcon({
          className: "",
          html: '<div class="marker-shell ' + tone + '"><div class="marker-dot"></div></div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
      }

      function buildUserIcon() {
        return L.divIcon({
          className: "",
          html: '<div class="user-dot"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
      }

      payload.markers.forEach((marker) => {
        const leafletMarker = L.marker([marker.lat, marker.lng], {
          icon: buildMarkerIcon(marker.tone),
        }).addTo(map);

        leafletMarker.on("click", () => {
          bridge.post({
            type: "marker-press",
            id: marker.id,
          });
        });
      });

      if (payload.currentLocation) {
        L.marker([payload.currentLocation.lat, payload.currentLocation.lng], {
          icon: buildUserIcon(),
        }).addTo(map);
      }

      if (payload.mode === "pick") {
        let previousCenter = null;

        const postCenter = () => {
          const center = map.getCenter();
          const nextCenter = {
            lat: Number(center.lat.toFixed(6)),
            lng: Number(center.lng.toFixed(6)),
          };

          if (
            previousCenter &&
            previousCenter.lat === nextCenter.lat &&
            previousCenter.lng === nextCenter.lng
          ) {
            return;
          }

          previousCenter = nextCenter;
          bridge.post({
            type: "center-change",
            lat: nextCenter.lat,
            lng: nextCenter.lng,
          });
        };

        map.on("moveend", postCenter);
        postCenter();
      }
    </script>
  </body>
</html>`;
}

const styles = StyleSheet.create({
  webView: {
    backgroundColor: "#161719",
  },
});
