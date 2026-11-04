import { roadmapStages } from "@/lib/roadmap";

type RoadmapSectionProps = {
  standalone?: boolean;
};

export function RoadmapSection({ standalone = false }: RoadmapSectionProps) {
  return (
    <section className="roadmap-section" id={standalone ? undefined : "roadmap"}>
      <div className="section-wrap">
        <div className="roadmap-heading">
          <div>
            <p className="eyebrow">Current status and future ideas</p>
            {standalone ? <h1>What works now—and what doesn’t.</h1> : <h2>What works now—and what doesn’t.</h2>}
          </div>
          <p>
            Stages 2 and 3 are implemented in the codebase, but need the database migration and
            deployment before they’re available. Creating pots and collecting money are still off.
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
                {stage.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
