import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isSameGame, normalizeTeam } from "./index.ts";

const sides = ["new york yankees", "boston red sox"].map(normalizeTeam);

Deno.test("normalizeTeam strips punctuation, case and accents", () => {
  assertEquals(normalizeTeam("  N.Y. Yankees "), "n y yankees");
  assertEquals(normalizeTeam("Montréal"), "montreal");
  assertEquals(normalizeTeam(null), "");
});

Deno.test("pick on the home team is same game", () => {
  assertEquals(isSameGame({ team: "New York Yankees", opponent: null }, sides), true);
});

Deno.test("pick on the away team is same game", () => {
  assertEquals(isSameGame({ team: "Boston Red Sox", opponent: null }, sides), true);
});

Deno.test("pick whose opponent is a side is same game", () => {
  assertEquals(isSameGame({ team: "Some Other Club", opponent: "Boston Red Sox" }, sides), true);
});

Deno.test("pick on an unrelated team is excluded", () => {
  assertEquals(isSameGame({ team: "Chicago Cubs", opponent: "Milwaukee Brewers" }, sides), false);
});

Deno.test("pick with no team is excluded", () => {
  assertEquals(isSameGame({ team: null, opponent: null }, sides), false);
});

Deno.test("signal with no teams confirms nothing", () => {
  assertEquals(isSameGame({ team: "New York Yankees", opponent: null }, []), false);
});
