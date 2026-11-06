import { roadmapStages } from "@/lib/roadmap";
import Link from "next/link";

type RoadmapSectionProps = {
  standalone?: boolean;
};

export function RoadmapSection({ standalone = false }: RoadmapSectionProps) {
  return (
    <section
      className="roadmap-section"
      id={standalone ? "main-content" : "roadmap"}
      tabIndex={-1}
    >
      <div className="section-wrap">
        <div className="roadmap-heading">
          <div>
            <p className="eyebrow">Current status and future ideas</p>
            {standalone ? (
              <h1>What works now—and what doesn’t.</h1>
            ) : (
              <h2>What works now—and what doesn’t.</h2>
            )}
          </div>
          <p>
            Stages 2 and 3 are live on Base Sepolia. Creating pots and collecting
            money are not available yet.
          </p>
        </div>
        <div className="roadmap-grid">
          {roadmapStages.map((stage) => (
            <article
              className={`roadmap-card${stage.current ? " roadmap-current" : ""}`}
              key={stage.number}
            >
              <div className="roadmap-card-top">
                <span>{stage.number}</span>
                <span className="roadmap-status">{stage.status}</span>
              </div>
              <h3>{stage.title}</h3>
              <p>{stage.description}</p>
              <ul>
                {stage.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {"href" in stage && (
                <Link className="roadmap-card-action" href={stage.href}>
                  {stage.action} <span aria-hidden="true">→</span>
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
