import { matchNames } from "../src/utils/fuzzyMatch.js";

describe("Fuzzy Name Matching", () => {
  // ── Exact Matches ─────────────────────────────────
  describe("Exact matches", () => {
    test("identical names score 100 and STRONG", () => {
      const result = matchNames("John Mensah", "John Mensah");
      expect(result.score).toBe(100);
      expect(result.status).toBe("STRONG");
    });

    test("case difference scores STRONG", () => {
      const result = matchNames("john mensah", "JOHN MENSAH");
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.status).toBe("STRONG");
    });
  });

  // ── Flipped Names ─────────────────────────────────
  describe("Flipped names", () => {
    test("Mensah John vs John Mensah scores STRONG", () => {
      const result = matchNames("John Mensah", "Mensah John");
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.status).toBe("STRONG");
    });

    test("Owusu Ama vs Ama Owusu scores STRONG", () => {
      const result = matchNames("Ama Owusu", "Owusu Ama");
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.status).toBe("STRONG");
    });

    test("Asante Kwame vs Kwame Asante scores STRONG", () => {
      const result = matchNames("Kwame Asante", "Asante Kwame");
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.status).toBe("STRONG");
    });
  });

  // ── Spelling Variations ───────────────────────────
  describe("Spelling variations", () => {
    test("Kofi vs Koffy scores LIKELY or above", () => {
      const result = matchNames("Kofi Mensah", "Koffy Mensah");
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(["STRONG", "LIKELY"]).toContain(result.status);
    });

    test("Abena vs Abina scores LIKELY or above", () => {
      const result = matchNames("Abena Owusu", "Abina Owusu");
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(["STRONG", "LIKELY"]).toContain(result.status);
    });

    test("Mensa vs Mensah scores LIKELY or above", () => {
      const result = matchNames("Kofi Mensa", "Kofi Mensah");
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(["STRONG", "LIKELY"]).toContain(result.status);
    });

    test("Emmanuel vs Emmanuel K scores LIKELY or above", () => {
      const result = matchNames("Emmanuel Boateng", "Emmanuel K Boateng");
      expect(result.score).toBeGreaterThanOrEqual(70);
    });
  });

  // ── Weak Matches ──────────────────────────────────
  describe("Weak matches", () => {
    test("different first name same surname scores WEAK", () => {
      const result = matchNames("Kweku Asante", "Kwame Asante");
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThan(90);
    });
  });

  // ── No Match ──────────────────────────────────────
  describe("No match", () => {
    test("completely different names score NO_MATCH", () => {
      const result = matchNames("John Mensah", "Akosua Frimpong");
      expect(result.status).toBe("NO_MATCH");
    });

    test("empty input name returns NO_MATCH", () => {
      const result = matchNames("", "John Mensah");
      expect(result.score).toBe(0);
      expect(result.status).toBe("NO_MATCH");
    });

    test("empty MTN name returns NO_MATCH", () => {
      const result = matchNames("John Mensah", "");
      expect(result.score).toBe(0);
      expect(result.status).toBe("NO_MATCH");
    });
  });
});
