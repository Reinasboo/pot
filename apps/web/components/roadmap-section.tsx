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
            <p className="eyebrow">Built in stages, with purpose</p>
            {standalone ? <h1>Where POT is headed.</h1> : <h2>Where POT is headed.</h2>}
          </div>
          <p>
            Today’s focus is core group payments. The rest is a roadmap—not a promise that these
            features are live.
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
