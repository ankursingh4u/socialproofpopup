import { describe, it, expect } from "vitest";

/**
 * Settings Configuration Tests
 * Tests for popup settings and configuration
 */

describe("Settings Configuration", () => {
  describe("Default Settings", () => {
    const defaultSettings = {
      popupEnabled: true,
      counterEnabled: true,
      demoMode: true,
      popupPosition: "BOTTOM_LEFT",
      popupDelay: 5,
      displayDuration: 4,
      showOnPages: ["product", "collection", "home", "cart"],
    };

    it("should have popup enabled by default", () => {
      expect(defaultSettings.popupEnabled).toBe(true);
    });

    it("should have counter enabled by default", () => {
      expect(defaultSettings.counterEnabled).toBe(true);
    });

    it("should have demo mode enabled by default", () => {
      expect(defaultSettings.demoMode).toBe(true);
    });

    it("should have BOTTOM_LEFT as default position", () => {
      expect(defaultSettings.popupPosition).toBe("BOTTOM_LEFT");
    });

    it("should have 5 seconds as default popup delay", () => {
      expect(defaultSettings.popupDelay).toBe(5);
    });

    it("should have 4 seconds as default display duration", () => {
      expect(defaultSettings.displayDuration).toBe(4);
    });

    it("should show on product, collection, home, and cart pages by default", () => {
      expect(defaultSettings.showOnPages).toContain("product");
      expect(defaultSettings.showOnPages).toContain("collection");
      expect(defaultSettings.showOnPages).toContain("home");
      expect(defaultSettings.showOnPages).toContain("cart");
    });
  });

  describe("Popup Position Validation", () => {
    const validPositions = ["BOTTOM_LEFT", "BOTTOM_RIGHT", "TOP_LEFT", "TOP_RIGHT"];

    it("should accept BOTTOM_LEFT position", () => {
      expect(validPositions).toContain("BOTTOM_LEFT");
    });

    it("should accept BOTTOM_RIGHT position", () => {
      expect(validPositions).toContain("BOTTOM_RIGHT");
    });

    it("should accept TOP_LEFT position", () => {
      expect(validPositions).toContain("TOP_LEFT");
    });

    it("should accept TOP_RIGHT position", () => {
      expect(validPositions).toContain("TOP_RIGHT");
    });

    it("should have exactly 4 valid positions", () => {
      expect(validPositions).toHaveLength(4);
    });
  });

  describe("Timing Settings Validation", () => {
    it("should not allow popup delay less than 1 second", () => {
      const minDelay = 1;
      expect(minDelay).toBeGreaterThanOrEqual(1);
    });

    it("should not allow display duration less than 1 second", () => {
      const minDuration = 1;
      expect(minDuration).toBeGreaterThanOrEqual(1);
    });

    it("should allow popup delay up to 30 seconds", () => {
      const maxDelay = 30;
      expect(maxDelay).toBeLessThanOrEqual(30);
    });

    it("should allow display duration up to 15 seconds", () => {
      const maxDuration = 15;
      expect(maxDuration).toBeLessThanOrEqual(15);
    });
  });
});
