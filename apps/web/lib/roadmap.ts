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
    status: "Live now",
    title: "Make sharing easier",
    description:
      "Discover public pots, follow confirmed activity, react, and share. Organizers can publish wallet-signed updates.",
    items: ["Public pot discovery", "Activity feeds and reactions", "Confirmed funding milestones", "Shareable pot pages"],
    href: "/discover",
    action: "Explore public pots",
    current: false,
  },
  {
    number: "03",
    status: "Live now",
    title: "Tools for organizers",
    description:
      "Connect your wallet to review pot analytics, export reports, manage public collections, and customize your organizer page. These tools are free.",
    items: ["Organizer analytics and CSV reports", "Public pot collections", "Branded organizer pages", "Free organizer tools"],
    href: "/dashboard",
    action: "Open organizer tools",
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
