"use client";

import { FormCheck } from "./FormCheck";
import { PULLDOWN_VARIATIONS, analyzePulldownSet } from "./analyze";

export function FormCheckScreen() {
  return <FormCheck variations={PULLDOWN_VARIATIONS} analyze={analyzePulldownSet} />;
}
