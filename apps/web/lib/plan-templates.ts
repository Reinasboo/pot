export const planTemplates = {
  trip: {
    label: "A trip",
    name: "The weekend away",
    purpose:
      "A little escape with our favourite people. Let’s agree on the budget before we book.",
    target: "1200",
    minimum: "25",
    headline: "Out of the chat.\nInto the weekend.",
    kind: "A shared adventure",
  },
  gift: {
    label: "A gift",
    name: "The birthday surprise",
    purpose:
      "One thoughtful gift from all of us. Let’s make their day together.",
    target: "180",
    minimum: "10",
    headline: "One thoughtful gift.\nFrom all of us.",
    kind: "A little more thoughtful",
  },
  community: {
    label: "A good cause",
    name: "Our community project",
    purpose:
      "A shared fund for something that makes our community better. Every contribution helps.",
    target: "600",
    minimum: "5",
    headline: "A good idea.\nA little from everyone.",
    kind: "Something bigger than us",
  },
} as const;

export type PlanTemplateKey = keyof typeof planTemplates;
export function getPlanTemplate(key: string | null) {
  return key && Object.hasOwn(planTemplates, key)
    ? planTemplates[key as PlanTemplateKey]
    : undefined;
}
