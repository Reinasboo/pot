import Link from "next/link";
import { Brand } from "@/components/brand";

type ActiveSection = "discover" | "dashboard" | "roadmap" | "plan";

const navigation = [
  { href: "/discover", label: "Discover", section: "discover" },
  { href: "/dashboard", label: "My pots", section: "dashboard" },
  { href: "/roadmap", label: "Roadmap", section: "roadmap" },
] as const;

export function SiteHeader({
  activeSection,
}: {
  activeSection?: ActiveSection;
}) {
  return (
    <header className="site-header app-site-header">
      <Brand className="brand" href="/" />
      <nav className="desktop-nav" aria-label="Primary navigation">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={activeSection === item.section ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="site-header-actions app-site-header-actions">
        <span
          className="network-context"
          role="note"
          aria-label="Network environment: Base Sepolia testnet"
        >
          <i aria-hidden="true" />
          <span>Base Sepolia</span>
          <span className="network-context-environment">Testnet</span>
        </span>
        <Link
          className="button button-primary app-plan-link"
          href="/create"
          aria-current={activeSection === "plan" ? "page" : undefined}
        >
          Plan a pot <span aria-hidden="true">↗</span>
        </Link>
        <details className="app-mobile-menu">
          <summary aria-label="Open site navigation">
            <span>Menu</span>
            <span aria-hidden="true">+</span>
          </summary>
          <nav aria-label="Mobile navigation">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={
                  activeSection === item.section ? "page" : undefined
                }
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/create"
              aria-current={activeSection === "plan" ? "page" : undefined}
            >
              Plan a pot
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
