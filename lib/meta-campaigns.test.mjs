import assert from "node:assert/strict";
import test from "node:test";
import { suggestCampaigns } from "./meta-campaigns.ts";

const campaigns = [
  { id: "1", name: "ACME_MAIN_CBO_0916" },
  { id: "2", name: "Acme" },
  { id: "3", name: "Test 1" },
  { id: "4", name: "Volt-ix retargeting" },
  { id: "5", name: "Sneakers spring" },
];

test("campaign names that contain the product name are suggested, ignoring case and punctuation", () => {
  assert.deepEqual(suggestCampaigns(campaigns, "Acme"), ["1", "2", "4"]);
  assert.deepEqual(suggestCampaigns(campaigns, "  acme "), ["1", "2", "4"]);
  assert.deepEqual(suggestCampaigns(campaigns, "Sneakers"), ["5"]);
});

test("a name too short to mean anything suggests nothing", () => {
  assert.deepEqual(suggestCampaigns(campaigns, "V"), []);
  assert.deepEqual(suggestCampaigns(campaigns, "  "), []);
  assert.deepEqual(suggestCampaigns([], "Acme"), []);
});
