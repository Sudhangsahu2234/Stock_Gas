"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { getApiBase } from "@/lib/api";

const navLinks = [
  { label: "About Us", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Booking", href: "#booking" },
  { label: "Track Order", href: "/track" },
  { label: "Contact Us", href: "#contact" }
];

const metrics = [
  { value: "10K+", label: "dealer network capacity planned for national scale" },
  { value: "99.9%", label: "customer application availability target" },
  { value: "24/7", label: "visibility across booking, support, and operations" },
  { value: "6-8", label: "month rollout roadmap noted in the RFQ" }
];

const aboutPoints = [
  {
    title: "Nationwide LPG digitisation",
    description:
      "Stockgap Fuels Ltd. is pursuing a digital operating model for LPG cylinder distribution across Nigeria, connecting customers, dealers, distributors, and administrators."
  },
  {
    title: "End-to-end traceability",
    description:
      "The target operating chain covers plant to distributor to dealer to customer, with RFID and GPS visibility designed to reduce losses and improve billing accuracy."
  },
  {
    title: "Operational control",
    description:
      "ERP-linked workflows, reporting, and audit-ready records are intended to give management real-time insight into sales, inventory, dispatch, and compliance."
  }
];

const services = [
  {
    title: "Customer Ordering & Payments",
    description:
      "Enable customers to book cylinder sizes, choose quantities, pay securely, and receive invoices and fulfilment updates through web and app experiences."
  },
  {
    title: "Dealer & Distributor Operations",
    description:
      "Provide role-based portals for order acceptance, inventory control, dispatch planning, and delivery coordination across dealer territories."
  },
  {
    title: "Admin Dashboard & Reporting",
    description:
      "Centralise sales monitoring, inventory views, complaint reporting, pricing oversight, and region-level decision support."
  },
  {
    title: "RFID + GPS Tracking",
    description:
      "Track cylinder lifecycle events from filling plant to delivery, combining RFID updates with vehicle location data for clearer ETA visibility."
  },
  {
    title: "Notifications & Customer Support",
    description:
      "Support SMS, WhatsApp, call-centre, and live chat journeys for order confirmations, issue handling, and operational escalations."
  },
  {
    title: "Safety Education & Compliance",
    description:
      "Embed safety guides, how-to content, and compliance-focused education so customers and dealers can use LPG more safely and confidently."
  }
];

const ecosystemCards = [
  {
    title: "Customer Experience",
    kicker: "Booking and fulfilment",
    description:
      "A customer-facing web and app journey for registration, booking, payment, order tracking, invoices, and post-delivery feedback."
  },
  {
    title: "Dealer & Distributor Portal",
    kicker: "Inventory and logistics",
    description:
      "A backend workspace for territory-specific order handling, stock visibility, dispatch scheduling, and exception management."
  },
  {
    title: "Admin Command Centre",
    kicker: "Oversight and analytics",
    description:
      "An operations dashboard for CRM, reporting, pricing controls, commissions, compliance alerts, and system-wide performance monitoring."
  }
];

const bookingSteps = [
  {
    title: "Create your profile",
    description:
      "Customers register with delivery details and operating preferences so future orders and support interactions are easier to manage."
  },
  {
    title: "Select cylinder size and quantity",
    description:
      "Choose the cylinder sizes needed for home, retail, or commercial use, then confirm the order quantity and delivery location."
  },
  {
    title: "Pay and receive confirmation",
    description:
      "Submit a payment preference and receive order acknowledgement with a receipt-ready workflow and service updates."
  },
  {
    title: "Track dispatch and ETA",
    description:
      "RFID and GPS-connected operations are intended to provide status changes, delivery progress, and expected arrival guidance."
  },
  {
    title: "Confirm delivery and share feedback",
    description:
      "After fulfilment, customers can confirm service completion, rate the experience, and report any issue that needs follow-up."
  }
];

const supportChannels = [
  {
    title: "Port Harcourt Operations Base",
    detail: "Port Harcourt, Nigeria",
    description:
      "Company communications and rollout messaging should anchor around Stockgap Fuels' Port Harcourt base while supporting nationwide operations."
  },
  {
    title: "National Helpline",
    detail: "24/7 customer support model",
    description:
      "The RFQ calls for a toll-free or IVR-based support channel so customers can reach a live desk for booking and delivery issues."
  },
  {
    title: "Dealer Helpdesk",
    detail: "Priority issue handling",
    description:
      "Dedicated support for dealers and distributors should include troubleshooting, workflow support, and operational escalation."
  },
  {
    title: "In-App Live Chat",
    detail: "FAQ plus escalation path",
    description:
      "An AI-assisted chat experience can resolve simple questions and hand over unresolved requests to the support team."
  }
];

type ContactForm = {
  name: string;
  email: string;
  type: string;
  message: string;
};

const emptyContactForm: ContactForm = {
  name: "",
  email: "",
  type: "General inquiry",
  message: ""
};

export default function HomePage() {
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContactForm);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactFeedback, setContactFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (revealNodes.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const target = entry.target as HTMLElement;
          target.style.opacity = "1";
          target.style.transform = "translateY(0)";
          observer.unobserve(target);
        });
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -48px 0px"
      }
    );

    revealNodes.forEach((node, index) => {
      node.style.opacity = "0";
      node.style.transform = "translateY(24px)";
      node.style.transition = `opacity .55s ease ${Math.min(index * 0.03, 0.18)}s, transform .55s ease ${Math.min(
        index * 0.03,
        0.18
      )}s`;
      observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  const onContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactSubmitting(true);
    setContactFeedback(null);

    try {
      const payload = {
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        type: contactForm.type,
        message: contactForm.message.trim()
      };

      const res = await fetch(`${getApiBase()}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Your message could not be sent.");
      }

      setContactForm(emptyContactForm);
      setContactFeedback({
        type: "ok",
        text: "Your message has been sent to Stockgap Fuels. A team member can follow up from the contact details you supplied."
      });
    } catch (error) {
      setContactFeedback({
        type: "err",
        text: error instanceof Error ? error.message : "Unable to submit your message right now."
      });
    } finally {
      setContactSubmitting(false);
    }
  };

  return (
    <main className="home-page">
      <div className="utility-bar">
        <div className="shell utility-bar-inner">
          <span>Port Harcourt, Nigeria</span>
          <span>Digital LPG cylinder distribution platform</span>
          <span>Booking, tracking, operations, and support in one ecosystem</span>
        </div>
      </div>

      <header className="site-header">
        <div className="shell site-header-inner">
          <Link href="/" className="brand-lockup" aria-label="Stockgap Fuels home">
            <Image
              src="/stockgas-logo.jpeg"
              alt="STOCKGAS logo"
              width={220}
              height={170}
              className="brand-logo-image"
              priority
            />
            <span className="brand-copy">
              <span className="brand-name">Stockgap Fuels</span>
              <span className="brand-tag">Official digital LPG distribution platform</span>
            </span>
          </Link>

          <nav className="site-nav" aria-label="Primary">
            {navLinks.map((item) => (
              <a key={item.href} className="nav-link" href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="header-actions">
            <Link className="btn btn-secondary" href="/track">
              Track Order
            </Link>
            <Link className="btn btn-primary" href="/order">
              Order Now
            </Link>
          </div>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-backdrop" />
        <div className="shell hero-grid">
          <div className="hero-copy" data-reveal>
            <span className="eyebrow">Stockgap Fuels Ltd.</span>
            <h1>Digitising LPG cylinder distribution from plant to customer across Nigeria.</h1>
            <p className="hero-text">
              Stockgap Fuels is building a connected customer, dealer, and admin ecosystem for LPG cylinder booking,
              payment support, delivery coordination, RFID and GPS tracking, reporting, and safety education.
            </p>
            <div className="hero-actions-row">
              <Link className="btn btn-primary btn-large" href="/order">
                Book Cylinder Delivery
              </Link>
              <Link className="btn btn-ghost btn-large" href="/track">
                Track Existing Order
              </Link>
            </div>
            <div className="hero-tags">
              <span>ERP-ready workflows</span>
              <span>RFID and GPS visibility</span>
              <span>Customer and dealer support</span>
            </div>
          </div>

          <div className="hero-card-stack" data-reveal>
            <article className="hero-spotlight">
              <div className="hero-spotlight-head">
                <span className="eyebrow eyebrow-light">Operational Focus</span>
                <strong>One LPG distribution command layer</strong>
              </div>
              <div className="hero-spotlight-grid">
                <div className="hero-spotlight-item">
                  <span>Customer</span>
                  <strong>Booking, payment, feedback</strong>
                </div>
                <div className="hero-spotlight-item">
                  <span>Dealer</span>
                  <strong>Inventory, dispatch, support</strong>
                </div>
                <div className="hero-spotlight-item">
                  <span>Admin</span>
                  <strong>Oversight, reports, compliance</strong>
                </div>
                <div className="hero-spotlight-item">
                  <span>Tracking</span>
                  <strong>RFID scans and GPS updates</strong>
                </div>
              </div>
            </article>

            <article className="hero-process-card">
              <div className="process-line">
                <span>Plant</span>
                <span>Distributor</span>
                <span>Dealer</span>
                <span>Customer</span>
              </div>
              <p>
                The RFQ defines a platform that improves transparency, service delivery, and operational planning
                across the full LPG value chain.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="metrics-strip">
        <div className="shell metrics-grid">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label} data-reveal>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="about">
        <div className="shell section-grid">
          <div className="section-copy" data-reveal>
            <span className="eyebrow">About Us</span>
            <h2>Stockgap Fuels is rethinking LPG distribution as a connected service platform.</h2>
            <p className="section-lead">
              The company documents describe a nationwide digital transformation effort for LPG cylinder distribution,
              with a Port Harcourt operating base and a strong emphasis on transparency, delivery confidence, safety,
              and better operational decision-making.
            </p>
            <div className="about-note">
              <strong>What that means in practice</strong>
              <p>
                Customers should be able to order more easily, dealers should manage inventory and fulfilment with
                clearer visibility, and administrators should gain real-time reporting across the network.
              </p>
            </div>
          </div>

          <div className="about-points-grid">
            {aboutPoints.map((point) => (
              <article className="info-card" key={point.title} data-reveal>
                <h3>{point.title}</h3>
                <p>{point.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt" id="services">
        <div className="shell">
          <div className="section-heading" data-reveal>
            <span className="eyebrow">Services</span>
            <h2>Services designed around booking, fulfilment, visibility, and support.</h2>
            <p className="section-lead">
              The refreshed homepage now explains the platform in business terms instead of generic placeholder copy,
              aligning the UI with the requirements captured in the DOCX and RFQ.
            </p>
          </div>

          <div className="services-grid">
            {services.map((service) => (
              <article className="service-card" key={service.title} data-reveal>
                <span className="service-index">{service.title.slice(0, 1)}</span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="section-heading" data-reveal>
            <span className="eyebrow">Platform Ecosystem</span>
            <h2>One operating model for customers, dealers, and administrators.</h2>
          </div>

          <div className="ecosystem-grid">
            {ecosystemCards.map((card) => (
              <article className="ecosystem-card" key={card.title} data-reveal>
                <span className="card-kicker">{card.kicker}</span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-dark" id="booking">
        <div className="shell booking-layout">
          <div className="section-copy" data-reveal>
            <span className="eyebrow eyebrow-light">Booking</span>
            <h2>Order flow designed to move from request to delivery with fewer blind spots.</h2>
            <p className="section-lead section-lead-light">
              The booking journey described in the documents connects registration, cylinder selection, payment,
              notifications, tracking, and post-delivery feedback. The current project now presents that flow clearly
              and routes customers into the dedicated booking page.
            </p>
            <div className="booking-cta-block">
              <Link className="btn btn-primary btn-large" href="/order">
                Go To Booking Page
              </Link>
              <span className="booking-note">Supported sizes in the current form: 3kg, 5kg, 6kg, 12.5kg, and 50kg.</span>
            </div>
          </div>

          <div className="steps-grid">
            {bookingSteps.map((step, index) => (
              <article className="step-card" key={step.title} data-reveal>
                <span className="step-number">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="contact">
        <div className="shell contact-layout">
          <div className="contact-column">
            <div className="section-heading" data-reveal>
              <span className="eyebrow">Contact Us</span>
              <h2>Reach Stockgap Fuels for customer support, dealer issues, and partnership conversations.</h2>
              <p className="section-lead">
                The support experience described in the RFQ includes a national helpline, a dealer helpdesk, and live
                chat escalation. The form here now submits directly into the existing backend contact workflow.
              </p>
            </div>

            <div className="support-grid">
              {supportChannels.map((channel) => (
                <article className="support-card" key={channel.title} data-reveal>
                  <span className="card-kicker">{channel.detail}</span>
                  <h3>{channel.title}</h3>
                  <p>{channel.description}</p>
                </article>
              ))}
            </div>
          </div>

          <section className="contact-form-panel" data-reveal>
            <div className="form-heading">
              <span className="eyebrow">Send a message</span>
              <h3>Tell us what you need</h3>
            </div>

            {contactFeedback && (
              <div className={`feedback-banner ${contactFeedback.type === "ok" ? "feedback-ok" : "feedback-err"}`}>
                {contactFeedback.text}
              </div>
            )}

            <form className="contact-form" onSubmit={onContactSubmit}>
              <label className="field">
                <span>Name</span>
                <input
                  required
                  value={contactForm.name}
                  onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Full name"
                  autoComplete="name"
                />
              </label>

              <label className="field">
                <span>Email</span>
                <input
                  required
                  type="email"
                  value={contactForm.email}
                  onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </label>

              <label className="field">
                <span>Request type</span>
                <select
                  value={contactForm.type}
                  onChange={(event) => setContactForm((current) => ({ ...current, type: event.target.value }))}
                >
                  <option>General inquiry</option>
                  <option>Customer support</option>
                  <option>Dealer support</option>
                  <option>Partnership / corporate sales</option>
                </select>
              </label>

              <label className="field">
                <span>Message</span>
                <textarea
                  required
                  rows={6}
                  value={contactForm.message}
                  onChange={(event) => setContactForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder="Tell Stockgap Fuels how we can help."
                />
              </label>

              <button className="btn btn-primary btn-block" type="submit" disabled={contactSubmitting}>
                {contactSubmitting ? "Sending message..." : "Submit Contact Request"}
              </button>
            </form>
          </section>
        </div>
      </section>

      <footer className="site-footer">
        <div className="shell site-footer-inner">
          <div>
            <strong>Stockgap Fuels</strong>
            <p>Digital LPG cylinder distribution platform for booking, operations, tracking, and support.</p>
          </div>
          <div className="footer-links">
            {navLinks.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
