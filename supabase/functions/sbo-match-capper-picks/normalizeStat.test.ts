import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeStat } from "./index.ts";

Deno.test("canonical prop_type values pass through unchanged", () => {
  for (const s of ["strikeouts_p", "pts_reb_ast", "pts_reb", "pts_ast", "reb_ast", "total_bases", "home_runs", "threes"]) {
    assertEquals(normalizeStat(s), s);
  }
});

Deno.test("capper vocabulary maps onto prop vocabulary", () => {
  assertEquals(normalizeStat("strikeouts_pitched"), "strikeouts_p");
  assertEquals(normalizeStat("pitcher strikeouts"), "strikeouts_p");
  assertEquals(normalizeStat("pts+reb+ast"), "pts_reb_ast");
  assertEquals(normalizeStat("PRA"), "pts_reb_ast");
  assertEquals(normalizeStat("hr"), "home_runs");
  assertEquals(normalizeStat("rbi"), "rbis");
  assertEquals(normalizeStat("3PM"), "threes");
});

Deno.test("unknown stats are lowercased and underscored, not mangled", () => {
  assertEquals(normalizeStat("Method of Victory"), "method_of_victory");
  assertEquals(normalizeStat("NRFI"), "nrfi");
});
