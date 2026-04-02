import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="legal-page">
      <div className="section-heading">
        <p className="eyebrow">Contact</p>
        <h1>Talk to kfoodradar</h1>
        <p>
          For product access, partnerships, or API and data questions, reach us
          directly.
        </p>
      </div>

      <div className="legal-card">
        <p>
          Email:
          {" "}
          <Link href="mailto:hello@kfoodradar.com">hello@kfoodradar.com</Link>
        </p>
        <p>
          Best for requests related to early product access, data partnerships,
          store analysis, and platform integrations.
        </p>
      </div>
    </div>
  );
}
