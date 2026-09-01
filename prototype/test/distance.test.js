import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDistanceKm,
  isValidCoordinatePair,
  roundDistance,
} from "../src/distance.js";

test("同じ座標の距離は0kmになる", () => {
  const point = { latitude: 35.607302, longitude: 140.106375 };
  assert.equal(calculateDistanceKm(point, point), 0);
});

test("千葉市役所から中央区役所までのおおよその直線距離を計算する", () => {
  const distance = calculateDistanceKm(
    { latitude: 35.607302, longitude: 140.106375 },
    { latitude: 35.607378, longitude: 140.122617 },
  );

  assert.ok(distance > 1.4 && distance < 1.6);
  assert.equal(roundDistance(distance), 1.47);
});

test("緯度・経度の範囲を検証する", () => {
  assert.equal(isValidCoordinatePair(35.6, 140.1), true);
  assert.equal(isValidCoordinatePair(91, 140.1), false);
  assert.equal(isValidCoordinatePair(35.6, 181), false);
  assert.equal(isValidCoordinatePair(Number.NaN, 140.1), false);
});
