export const roadmapStages = [
  {
    number: "01",
    status: "In progress",
    title: "Core payments",
    description:
      "Create, contribute, track, and settle paths are implemented, but remain gated until Base Sepolia setup is complete.",
    items: [
      "Onchain create and USDC flows",
      "Chain-verified public pot and dashboard state",
      "Organizer payout and contributor refunds",
      "Deployment, attribution, and two-wallet testing remain",
    ],
    current: true,
  },
  {
    number: "02",
    status: "Planned",
    title: "Social experience",
    description: "Make shared progress more visible, celebratory, and easy to pass along.",
    items: ["Activity feeds", "Reactions and milestones", "Shareable cards", "Public pot discovery"],
    current: false,
  },
  {
    number: "03",
    status: "Planned",
    title: "Organizers and businesses",
    description: "More useful tools for the people bringing groups together.",
    items: ["Creator collections", "Organizer analytics", "Branded pot pages", "Premium management tools"],
    current: false,
  },
  {
    number: "04",
    status: "Future vision",
    title: "POT infrastructure",
    description: "Make group payments useful in more products and experiences.",
    items: ["Developer API", "Embedded collections", "Merchant integrations", "Additional network support"],
    current: false,
  },
] as const;
