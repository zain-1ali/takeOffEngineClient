import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areaUnitLabel,
  polygonAreaPx2,
  polylineLengthPx,
  segmentLengthPx,
  toRealArea,
  toRealLength,
} from "./measurementMath.ts";
import { previewTakeoffMeasurement } from "./measurementPreview.ts";
import { nextSequentialLabel } from "./takeoffLabels.ts";

describe("segmentLengthPx", () => {
  it("returns 0 for identical points", () => {
    assert.equal(segmentLengthPx({ x: 3, y: 4 }, { x: 3, y: 4 }), 0);
  });

  it("returns Euclidean distance", () => {
    assert.equal(segmentLengthPx({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  });
});

describe("polylineLengthPx", () => {
  it("returns 0 for fewer than 2 points", () => {
    assert.equal(polylineLengthPx([]), 0);
    assert.equal(polylineLengthPx([{ x: 1, y: 1 }]), 0);
  });

  it("sums segment lengths", () => {
    assert.equal(
      polylineLengthPx([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4 },
      ]),
      7
    );
  });
});

describe("polygonAreaPx2 (shoelace)", () => {
  it("returns 0 for fewer than 3 points", () => {
    assert.equal(polygonAreaPx2([{ x: 0, y: 0 }, { x: 1, y: 0 }]), 0);
  });

  it("computes axis-aligned rectangle area", () => {
    assert.equal(
      polygonAreaPx2([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 20 },
        { x: 0, y: 20 },
      ]),
      200
    );
  });

  it("computes triangle area", () => {
    assert.equal(
      polygonAreaPx2([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 3 },
      ]),
      6
    );
  });

  it("is orientation-independent (CW vs CCW)", () => {
    const ccw = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const cw = [...ccw].reverse();
    assert.equal(polygonAreaPx2(ccw), 100);
    assert.equal(polygonAreaPx2(cw), 100);
  });

  it("handles irregular polygons", () => {
    assert.equal(
      polygonAreaPx2([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
      ]),
      3
    );
  });
});

describe("toRealLength / toRealArea", () => {
  it("scales length linearly by calibrationScale", () => {
    assert.equal(toRealLength(100, 0.5), 50);
  });

  it("scales area by scale² (not scale)", () => {
    assert.equal(toRealArea(200, 0.5), 50);
  });

  it("does not mistakenly use linear scale for area", () => {
    const areaPx2 = 100;
    const scale = 2;
    assert.equal(toRealArea(areaPx2, scale), 400);
    assert.notEqual(toRealArea(areaPx2, scale), areaPx2 * scale);
  });
});

describe("areaUnitLabel", () => {
  it("appends ² to the linear unit", () => {
    assert.equal(areaUnitLabel("ft"), "ft²");
    assert.equal(areaUnitLabel("m"), "m²");
  });
});

describe("previewTakeoffMeasurement", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("previews COUNT as ea", () => {
    assert.deepEqual(
      previewTakeoffMeasurement("COUNT", [{ x: 1, y: 2 }], null, null),
      { value: 1, unit: "ea" }
    );
  });

  it("returns null for LINEAR/AREA without calibration", () => {
    assert.equal(previewTakeoffMeasurement("AREA", square, null, "ft"), null);
    assert.equal(previewTakeoffMeasurement("LINEAR", square, 0.5, null), null);
  });

  it("previews AREA with scale² conversion", () => {
    assert.deepEqual(previewTakeoffMeasurement("AREA", square, 0.5, "ft"), {
      value: 25,
      unit: "ft²",
    });
  });

  it("previews LINEAR with linear scale", () => {
    assert.deepEqual(
      previewTakeoffMeasurement(
        "LINEAR",
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        0.5,
        "ft"
      ),
      { value: 5, unit: "ft" }
    );
  });
});

describe("nextSequentialLabel", () => {
  it("starts at 1 when none exist", () => {
    assert.equal(nextSequentialLabel("Area", [], "AREA"), "Area 1");
  });

  it("increments past existing Area N labels", () => {
    assert.equal(
      nextSequentialLabel(
        "Area",
        [
          { type: "AREA", label: "Area 1" },
          { type: "AREA", label: "Kitchen" },
          { type: "AREA", label: "Area 2" },
          { type: "LINEAR", label: "Area 3" },
        ],
        "AREA"
      ),
      "Area 3"
    );
  });

  it("fills gaps in the sequence", () => {
    assert.equal(
      nextSequentialLabel(
        "Linear",
        [
          { type: "LINEAR", label: "Linear 1" },
          { type: "LINEAR", label: "Linear 3" },
        ],
        "LINEAR"
      ),
      "Linear 2"
    );
  });
});

console.log("measurementMath.check.ts: all assertions passed");
