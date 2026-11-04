export const roadmapStages = [
  {
    number: "01",
    status: "Not available yet",
    title: "Create and fund a pot",
    description:
      "You can preview a plan today. Creating a pot and collecting real money are not available yet.",
    items: [
      "Create and share a pot",
      "Collect contributions",
      "Goal-based refunds or crowdfunding withdrawals",
      "Name the wallet that receives crowdfunding funds",
      "Test the full experience before launch",
    ],
    current: true,
  },
  {
    number: "02",
    status: "Built; not live yet",
    title: "Make sharing easier",
    description:
      "Public discovery, signed organizer updates, community reactions, verified milestones, and share cards are built. They need the database migration and deployment before launch.",
    items: ["Activity feeds", "Reactions and milestones", "Shareable cards", "Public pot discovery"],
    current: false,
  },
  {
    number: "03",
    status: "Built; not live yet",
    title: "Tools for organizers",
    description:
      "Organizer analytics, CSV reports, public collections, and branded organizer pages are built. They need the database migration and deployment before launch; all tools are free.",
    items: ["Creator collections", "Organizer analytics", "Branded pot pages", "Premium management tools"],
    current: false,
  },
  {
    number: "04",
    status: "Future vision",
    title: "Group funds in other apps",
    description:
      "A shared API could let other products create and track group funds without sending people elsewhere. It is an idea for the future, not an available feature.",
    items: [
      "A shared API for other apps",
      "Create and track group funds in one place",
      "Tools for organizers and merchants",
      "Planned only; no API is available today",
    ],
    current: false,
  },
] as const;
