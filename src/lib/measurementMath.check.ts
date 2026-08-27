import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  angleDegrees,
  arcFrom3Points,
  areaUnitLabel,
  bezierLengthPx,
  circleAreaPx2,
  circleFrom3Points,
  circleFromCenterRadius,
  netAreaAfterDeductions,
  polygonAreaPx2,
  polygonPerimeterPx,
  polylineLengthPx,
  segmentLengthPx,
  toRealArea,
  toRealLength,
} from "./measurementMath.ts";
import { previewTakeoffMeasurement } from "./measurementPreview.ts";
import { nextSequentialLabel } from "./takeoffLabels.ts";
import { parentNetM2, type MeasureAreaParent } from "./measureAreaParents.ts";

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

describe("polygonPerimeterPx", () => {
  it("returns 0 for fewer than 3 points", () => {
    assert.equal(polygonPerimeterPx([{ x: 0, y: 0 }, { x: 1, y: 0 }]), 0);
  });

  it("sums closed edges (same cycle as shoelace)", () => {
    assert.equal(
      polygonPerimeterPx([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 20 },
        { x: 0, y: 20 },
      ]),
      60
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

  it("previews AREA with scale² conversion and perimeter", () => {
    assert.deepEqual(previewTakeoffMeasurement("AREA", square, 0.5, "ft"), {
      value: 25,
      unit: "ft²",
      perimeter: { value: 20, unit: "ft" },
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

describe("circle / arc / angle (hand-checks)", () => {
  it("circle area πr² for r=2 (center + rim)", () => {
    const solved = circleFromCenterRadius({ x: 0, y: 0 }, { x: 2, y: 0 });
    assert.ok(solved);
    assert.equal(solved.radiusPx, 2);
    assert.ok(Math.abs(circleAreaPx2(solved.radiusPx) - 4 * Math.PI) < 1e-9);
  });

  it("circle from 3 circumference points (unit circle)", () => {
    const a = { x: 1, y: 0 };
    const b = { x: 0, y: 1 };
    const c = { x: -1, y: 0 };
    const solved = circleFrom3Points(a, b, c);
    assert.ok(solved);
    assert.ok(Math.abs(solved.center.x) < 1e-9);
    assert.ok(Math.abs(solved.center.y) < 1e-9);
    assert.ok(Math.abs(solved.radiusPx - 1) < 1e-9);
    assert.ok(Math.abs(circleAreaPx2(solved.radiusPx) - Math.PI) < 1e-9);
  });

  it("arc length rθ for r=2, 90° (π/2 rad) → π", () => {
    // Center (0,0), r=2: start east, through NE, end north → 90° CCW
    const start = { x: 2, y: 0 };
    const through = { x: Math.SQRT2, y: Math.SQRT2 };
    const end = { x: 0, y: 2 };
    const arc = arcFrom3Points(start, through, end);
    assert.ok(arc);
    assert.ok(Math.abs(arc.radiusPx - 2) < 1e-9);
    assert.ok(Math.abs(arc.sweepRad - Math.PI / 2) < 1e-9);
    assert.ok(Math.abs(arc.lengthPx - Math.PI) < 1e-9);
  });

  it("angle 90° via atan2 (V origin, A east, B north)", () => {
    const deg = angleDegrees({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 });
    assert.ok(deg != null);
    assert.ok(Math.abs(deg - 90) < 1e-9);
  });

  it("angle 45° (V origin, A east, B northeast)", () => {
    const deg = angleDegrees({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 });
    assert.ok(deg != null);
    assert.ok(Math.abs(deg - 45) < 1e-9);
  });
});

describe("curved path / deductions (hand-checks)", () => {
  it("Bézier with 2 control points equals the chord length", () => {
    // Degree-1 Bézier is the line segment — sampling must recover exact length.
    const len = bezierLengthPx(
      [
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ],
      64
    );
    assert.ok(Math.abs(len - 5) < 1e-9);
  });

  it("parent area 10 − deductions 2 and 1.5 → net 6.5", () => {
    assert.equal(netAreaAfterDeductions(10, [2, 1.5]), 6.5);
    const parent: MeasureAreaParent = {
      id: "a1",
      label: "Area 1",
      grossM2: 10,
      deductions: [
        { id: "d1", label: "Deduction 1", areaM2: 2 },
        { id: "d2", label: "Deduction 2", areaM2: 1.5 },
      ],
    };
    assert.equal(parentNetM2(parent), 6.5);
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
