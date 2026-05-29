import Image from "next/image";
import Link from "next/link";

const terminalFacts = [
  { label: "Owner", value: "Stockgap Fuels Limited" },
  { label: "Location", value: "Along Eagle Cement Road, Rumuolumeni, Obio Akpor, Rivers State" },
  { label: "Current valuation", value: "$150 Million" },
  { label: "Document status", value: "Private and confidential terminal information memorandum, Revision 1" }
];

const technicalSections = [
  {
    title: "Storage capacity",
    body:
      "Total white product capacity is 128,000 metric tons across PMS, AGO, DPK, bitumen, and fuel oil. Total LPG capacity is 17,000 metric tons, including butane and propane storage."
  },
  {
    title: "Truck load-out capacity",
    body:
      "White product load-out includes PMS, AGO, DPK, bitumen, and fuel oil loading arms. LPG load-out includes 6 loading arms and 6 weigh bridges at 40 tons per hour, delivering about 2,000 tons per day, with additional arms under construction."
  },
  {
    title: "LPG blender",
    body:
      "The propane and butane blender has a stated capacity of 600 cbm per hour and is listed as Sensia (JISKOOT) equipment."
  },
  {
    title: "Mooring facility",
    body:
      "Jetty facilities include a combined wall, a 360 metre long private jetty, and two berths."
  },
  {
    title: "Channel draft",
    body:
      "Actual channel draft is 7.3 metres, with planned draft stated as 8.5 metres in the memorandum."
  },
  {
    title: "Fire fighting",
    body:
      "Fire protection includes three 1,000 cbm per hour centrifugal horizontal diesel engine pumps and one centrifugal jockey pump from Gruppo Aturia S.p.a."
  },
  {
    title: "Water tank",
    body:
      "The terminal includes one 8 million litre fire water tank with internal coating for fresh water, plus 100 hp, 50 hp, and 25 hp submersible pumps."
  },
  {
    title: "Terminal automation",
    body:
      "The memorandum describes a fully automated terminal with Honeywell Terminal Manager software, custody transfer metering, and remote CCTV monitoring."
  },
  {
    title: "Other facilities",
    body:
      "Additional facilities include a self-propelled bunker barge, 200-truck tanker holding bay, inter-tank transfer capabilities, and back loading and unloading bays for white products and LPG."
  }
];

const capacityRows = [
  ["PMS", "4 x 16,000 metric tons"],
  ["AGO", "1 x 16,000 metric tons"],
  ["DPK", "1 x 16,000 metric tons"],
  ["Bitumen", "2 x 5,000 metric tons"],
  ["Fuel oil", "2 x 5,000 metric tons"],
  ["Butane", "3 x 4,300 metric tons = 12,900 metric tons in use"],
  ["Propane", "1 x 4,300 metric tons"]
];

export default function TerminalInformationPage() {
  return (
    <main className="terminal-page">
      <header className="site-header">
        <div className="brand-stripe" />
        <div className="shell site-header-inner">
          <Link href="/" className="brand-lockup" aria-label="StockGas home">
            <Image src="/stockgas-logo.png" alt="STOCKGAS logo" width={170} height={132} className="brand-logo-image" priority />
            <span className="wordmark" aria-hidden="true">
              <span>STOCK</span>
              <strong>GAS</strong>
            </span>
          </Link>
          <nav className="site-nav" aria-label="Terminal navigation">
            <Link className="nav-link" href="/">
              Home
            </Link>
            <Link className="nav-link" href="/order">
              Order
            </Link>
            <Link className="nav-link" href="/track">
              Track
            </Link>
          </nav>
        </div>
      </header>

      <section className="terminal-hero">
        <div className="shell terminal-hero-grid">
          <div>
            <span className="section-tag light">Terminal Information Memorandum</span>
            <h1>Stockgap Fuels terminal capacity and infrastructure summary.</h1>
            <p>
              This page converts the supplied memorandum into a readable public-facing terminal information page,
              preserving the key technical and commercial facts.
            </p>
            <Link className="btn btn-primary btn-large" href="/order">
              Order LPG Cylinders
            </Link>
          </div>
          <div className="terminal-photo-card">
            <Image src="/stockgas-plant-carousel.jpeg" alt="StockGas terminal filling equipment" fill className="terminal-photo" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell facts-grid">
          {terminalFacts.map((fact) => (
            <article className="fact-card" key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-alt">
        <div className="shell terminal-content-grid">
          <div className="terminal-table-card">
            <span className="section-tag red">Capacity</span>
            <h2>Product storage summary</h2>
            <div className="capacity-table">
              {capacityRows.map(([product, capacity]) => (
                <div className="capacity-row" key={product}>
                  <span>{product}</span>
                  <strong>{capacity}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="terminal-section-list">
            {technicalSections.map((section) => (
              <article className="terminal-info-card" key={section.title}>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section payment-band">
        <div className="shell terminal-cta">
          <div>
            <span className="section-tag light">Operations Ready</span>
            <h2>Connect terminal credibility to customer ordering.</h2>
            <p>Customers can review StockGas infrastructure and move directly into a calculated LPG cylinder cart.</p>
          </div>
          <Link className="btn btn-primary btn-large" href="/order">
            Build Order Cart
          </Link>
        </div>
      </section>
    </main>
  );
}
