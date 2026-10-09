import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseCoachingTable, parseTier2Rules } from "@optimass/diagnostics";
import { SetSession } from "./SetSession";

export const metadata = { title: "Set session · OptiMass" };

// content/ lives at the repo root; Next runs with apps/web as the working directory.
const contentDir = path.resolve(process.cwd(), "../../content/rules");

export default async function SetSessionPage() {
  const [coachingText, tier2Text] = await Promise.all([
    readFile(path.join(contentDir, "coaching/lat_pulldown.yaml"), "utf8"),
    readFile(path.join(contentDir, "tier2/lat_pulldown.yaml"), "utf8"),
  ]);
  const coaching = parseCoachingTable(coachingText, "content/rules/coaching/lat_pulldown.yaml");
  const tier2 = parseTier2Rules([{ path: "content/rules/tier2/lat_pulldown.yaml", text: tier2Text }]);
  return <SetSession exerciseLabel="Lat pulldown" coaching={coaching} tier2={tier2} totalSets={3} />;
}
