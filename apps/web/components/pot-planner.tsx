"use client";

import { useSearchParams } from "next/navigation";
import { PotCreationDraft } from "@/components/pot-creation-draft";
import { getPlanTemplate } from "@/lib/plan-templates";

export function PotPlanner() {
  const params = useSearchParams();
  const template = getPlanTemplate(params.get("template"));
  return (
    <PotCreationDraft
      key={params.get("template") ?? "blank"}
      template={template}
    />
  );
}
