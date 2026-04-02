import Link from "next/link";

const pillars = [
  {
    title: "Reddit",
    label: "Cause",
    body: "See why a menu is pulling attention through public discussion, votes, and debate intensity.",
  },
  {
    title: "YouTube",
    label: "Spread",
    body: "Track how far a menu idea is traveling through uploads, views, and channel diversity.",
  },
  {
    title: "Naver Blog",
    label: "Conversion",
    body: "Measure whether trend heat is moving toward real-world visit intent and local demand.",
  },
  {
    title: "AI Channels",
    label: "Visibility",
    body: "Understand whether a menu is entering recommendation flows across AI response systems.",
  },
];

const workflow = [
  {
    step: "Collect",
    body: "Pull public-channel signals and AI evidence around K-food menu terms.",
  },
  {
    step: "Normalize",
    body: "Merge alias variations such as kongguksu, soybean noodles, and 콩국수 into one menu entity.",
  },
  {
    step: "Score",
    body: "Turn growth, spread, debate, conversion, and AI visibility into decision-ready signals.",
  },
  {
    step: "Act",
    body: "Translate trend movement into menu, signage, and content actions for operators.",
  },
];

const highlights = [
  {
    title: "Trend rankings",
    body: "A daily view of rising K-food signals across public and AI-driven channels.",
  },
  {
    title: "Channel breakdowns",
    body: "Separate cause, spread, conversion, and AI visibility instead of blending them into one opaque score.",
  },
  {
    title: "Store actions",
    body: "Move from signal to action with menu framing, content direction, and store analysis paths.",
  },
];

export default function HomePage() {
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">K-food Trend Intelligence</p>
          <h1>See which Korean food trends are rising before they become obvious.</h1>
          <p className="hero-text">
            kfoodradar combines Reddit, YouTube, Naver Blog, and AI-channel
            signals to show what menu interest is forming, how it spreads, and
            where it may turn into real demand.
          </p>

          <div className="hero-actions">
            <Link className="button button--solid" href="/api/trends/top">
              View Today&apos;s Trends
            </Link>
            <Link
              className="button button--ghost"
              href="mailto:hello@kfoodradar.com?subject=Store%20Analysis%20Request"
            >
              Request Store Analysis
            </Link>
          </div>

          <p className="trust-line">
            Built on public-channel signals, normalized menu data, and
            decision-ready analytics.
          </p>
        </div>

        <div className="hero-card">
          <p className="hero-card__label">Signal model</p>
          <div className="hero-card__score">Cause + Spread + Conversion + Visibility</div>
          <ul className="hero-card__list">
            <li>Reddit explains why a menu starts moving.</li>
            <li>YouTube shows how far the topic spreads.</li>
            <li>Naver Blog reveals local visit intent.</li>
            <li>AI channels show recommendation visibility.</li>
          </ul>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <p className="eyebrow">One Decision System</p>
          <h2>Cause, spread, conversion, and AI visibility in one loop.</h2>
          <p>
            Instead of treating each channel as a separate dashboard,
            kfoodradar turns them into one menu intelligence system.
          </p>
        </div>

        <div className="pillar-grid">
          {pillars.map((pillar) => (
            <article className="signal-card" key={pillar.title}>
              <p className="signal-card__tag">{pillar.label}</p>
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block section-block--warm">
        <div className="section-heading">
          <p className="eyebrow">From Raw Signals To Action</p>
          <h2>Built for operators, marketers, and researchers who need early movement.</h2>
        </div>

        <div className="workflow-grid">
          {workflow.map((item, index) => (
            <article className="workflow-card" key={item.step}>
              <p className="workflow-card__step">{`0${index + 1}`}</p>
              <h3>{item.step}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <p className="eyebrow">What You Get</p>
          <h2>More than charts.</h2>
        </div>

        <div className="highlight-grid">
          {highlights.map((item) => (
            <article className="highlight-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
