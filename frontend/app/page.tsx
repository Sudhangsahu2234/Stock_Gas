"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { productCatalog, formatInr } from "@/lib/catalog";
import { getApiBase } from "@/lib/api";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "#about" },
  { label: "Products", href: "#products" },
  { label: "Terminal", href: "/terminal-information" },
  { label: "Track", href: "/track" },
  { label: "Contact", href: "#contact" }
];

const factoryHighlights = [
  {
    title: "Rotary filling plant",
    detail:
      "Cylinder filling operations are presented around precision weighing, safety checks, and dispatch readiness."
  },
  {
    title: "RFID lifecycle tracking",
    detail:
      "The digital roadmap connects plant, distributor, dealer, and customer events with clearer cylinder visibility."
  },
  {
    title: "Nationwide distribution",
    detail:
      "Dealer and customer workflows are designed for scalable LPG fulfilment across Nigeria."
  }
];

const serviceCards = [
  {
    title: "LPG cylinder supply",
    detail: "Domestic, commercial, and industrial cylinders supported through the StockGas order journey."
  },
  {
    title: "Digital ordering",
    detail: "Customers can build a cylinder cart, calculate the total, choose payment, and track the booking."
  },
  {
    title: "Corporate bulk supply",
    detail: "Bulk and contract-style ordering for hotels, hospitals, kitchens, plants, and dealer channels."
  },
  {
    title: "GPS and RFID tracking",
    detail: "A practical visibility layer for inventory, dispatch, delivery status, and audit-ready operations."
  },
  {
    title: "Payment operations",
    detail: "Offline payment preferences remain supported, while Razorpay receives the calculated cart total."
  },
  {
    title: "Safety and compliance",
    detail: "Safety education, support escalation, and regulatory messaging are built into the customer experience."
  }
];

const valueCards = [
  { value: "17,000 MT", label: "LPG terminal capacity from the memorandum" },
  { value: "128,000 MT", label: "white product storage capacity" },
  { value: "2,000 T/day", label: "LPG truck load-out capacity" },
  { value: "$150M", label: "current terminal valuation" }
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
  const [contactFeedback, setContactFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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
      { threshold: 0.14, rootMargin: "0px 0px -48px 0px" }
    );

    revealNodes.forEach((node, index) => {
      const delay = Math.min(index * 0.03, 0.18);
      node.style.opacity = "0";
      node.style.transform = "translateY(24px)";
      node.style.transition = `opacity .55s ease ${delay}s, transform .55s ease ${delay}s`;
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
        text: "Your message has been sent to StockGas. A team member can follow up from the contact details supplied."
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

          <nav className="site-nav" aria-label="Primary">
            {navLinks.map((item) =>
              item.href.startsWith("#") ? (
                <a key={item.href} className="nav-link" href={item.href}>
                  {item.label}
                </a>
              ) : (
                <Link key={item.href} className="nav-link" href={item.href}>
                  {item.label}
                </Link>
              )
            )}
          </nav>

          <Link className="btn btn-primary nav-cta" href="/order">
            Order Now
          </Link>
        </div>
      </header>

      <section className="home-hero">
        <div className="shell hero-grid">
          <div className="hero-copy" data-reveal>
            <span className="section-tag">Nigeria's LPG Leader</span>
            <h1>
              <span>Fuelling</span>
              <span>Nigeria's</span>
              <span>Future</span>
            </h1>
            <p>
              Stockgap Fuels delivers safe, reliable LPG cylinders across Nigeria from Port Harcourt operations to
              homes, dealers, and businesses, now supported by a digital cart, payment, and tracking journey.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-large" href="/order">
                Build Cylinder Cart
              </Link>
              <Link className="btn btn-outline btn-large" href="/terminal-information">
                View Terminal Information
              </Link>
            </div>
            <div className="hero-stats">
              <div>
                <strong>10K+</strong>
                <span>dealer network target</span>
              </div>
              <div>
                <strong>98%</strong>
                <span>payment success target</span>
              </div>
              <div>
                <strong>6-8</strong>
                <span>month rollout roadmap</span>
              </div>
            </div>
          </div>

          <div className="hero-visual" data-reveal>
            <Image
              src="/stockgas-plant-carousel.jpeg"
              alt="StockGas LPG cylinder filling carousel"
              fill
              className="hero-visual-image"
              priority
            />
            <div className="hero-badge hero-badge-top">
              <strong>Live operations</strong>
              <span>Filling, dispatch, and delivery visibility</span>
            </div>
            <div className="hero-badge hero-badge-bottom">
              <strong>Cart total</strong>
              <span>Calculated before payment</span>
            </div>
          </div>
        </div>
      </section>

      <section className="factory-strip" aria-label="StockGas operations highlights">
        {factoryHighlights.map((item) => (
          <article className="factory-tile" key={item.title} data-reveal>
            <span className="tile-icon" />
            <h2>{item.title}</h2>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="section" id="about">
        <div className="shell split-layout">
          <div className="section-copy" data-reveal>
            <span className="section-tag red">About StockGas</span>
            <h2>Powering homes, dealers, and businesses through safer LPG distribution.</h2>
            <p>
              The refreshed website combines customer ordering with terminal credibility: visible infrastructure,
              operational capacity, support workflows, and a cleaner digital checkout experience.
            </p>
            <Link className="btn btn-outline" href="/terminal-information">
              Read Terminal Memorandum
            </Link>
          </div>

          <div className="image-card" data-reveal>
            <Image src="/stockgas-plant-line.jpeg" alt="StockGas LPG cylinders in plant line" fill className="image-card-photo" />
          </div>
        </div>
      </section>

      <section className="section section-green">
        <div className="shell values-grid">
          {valueCards.map((card) => (
            <article className="value-card" key={card.label} data-reveal>
              <strong>{card.value}</strong>
              <span>{card.label}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="products">
        <div className="shell">
          <div className="section-heading" data-reveal>
            <span className="section-tag">Products</span>
            <h2>LPG cylinder options for households, commercial kitchens, and industrial users.</h2>
            <p>Demo prices are shown for checkout calculation and can be updated when final StockGas pricing is supplied.</p>
          </div>

          <div className="product-grid">
            {productCatalog.map((product) => (
              <article className="product-card" key={product.id} data-reveal>
                <div className="product-image-wrap">
                  <Image src={product.image} alt={product.name} fill className="product-image" />
                  <span className="product-badge">{product.badge}</span>
                </div>
                <div className="product-card-body">
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="spec-row">
                    {product.specs.map((spec) => (
                      <span key={spec}>{spec}</span>
                    ))}
                  </div>
                  <div className="product-price-row">
                    <strong>{formatInr(product.priceInr)}</strong>
                    <Link className="mini-link" href="/order">
                      Add to cart
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt" id="services">
        <div className="shell">
          <div className="section-heading" data-reveal>
            <span className="section-tag red">Services</span>
            <h2>End-to-end LPG distribution services with digital ordering at the centre.</h2>
          </div>
          <div className="services-grid">
            {serviceCards.map((service) => (
              <article className="service-card" key={service.title} data-reveal>
                <h3>{service.title}</h3>
                <p>{service.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section payment-band">
        <div className="shell payment-layout">
          <div data-reveal>
            <span className="section-tag light">Order Today</span>
            <h2>Build a multi-cylinder cart and pay the calculated total.</h2>
            <p>
              The booking page now supports multiple cylinder types in one order. Offline methods create an order
              immediately, while Razorpay uses the server-calculated INR amount.
            </p>
          </div>
          <div className="payment-methods" data-reveal>
            {["Cash on delivery", "Bank transfer", "Card / POS", "Wallet", "Razorpay"].map((method) => (
              <span key={method}>{method}</span>
            ))}
          </div>
          <Link className="btn btn-primary btn-large" href="/order">
            Start Order
          </Link>
        </div>
      </section>

      <section className="section" id="contact">
        <div className="shell contact-layout">
          <div className="contact-copy" data-reveal>
            <span className="section-tag">Get In Touch</span>
            <h2>Talk to StockGas about LPG orders, dealer onboarding, or corporate supply.</h2>
            <div className="contact-quick-cards">
              <div>
                <strong>Head office</strong>
                <span>Port Harcourt, Rivers State, Nigeria</span>
              </div>
              <div>
                <strong>Email</strong>
                <a href="mailto:info@stockgasfuels.com">info@stockgasfuels.com</a>
              </div>
              <div>
                <strong>Support</strong>
                <span>24/7 helpline model planned</span>
              </div>
            </div>
          </div>

          <section className="contact-form-panel" data-reveal>
            <div className="form-heading">
              <span className="section-tag red">Contact</span>
              <h3>Send a message</h3>
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
                  <option>Order LPG cylinders</option>
                  <option>Become a dealer</option>
                  <option>Corporate bulk supply</option>
                  <option>Terminal information</option>
                </select>
              </label>
              <label className="field">
                <span>Message</span>
                <textarea
                  required
                  rows={6}
                  value={contactForm.message}
                  onChange={(event) => setContactForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder="Tell StockGas how we can help."
                />
              </label>
              <button className="btn btn-primary btn-block" type="submit" disabled={contactSubmitting}>
                {contactSubmitting ? "Sending..." : "Submit Contact Request"}
              </button>
            </form>
          </section>
        </div>
      </section>

      <footer className="site-footer">
        <div className="shell site-footer-inner">
          <div>
            <div className="wordmark footer-wordmark">
              <span>STOCK</span>
              <strong>GAS</strong>
            </div>
            <p>Stockgap Fuels Ltd - safe, digital, and reliable LPG distribution.</p>
          </div>
          <div className="footer-links">
            {navLinks.map((item) =>
              item.href.startsWith("#") ? (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ) : (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              )
            )}
          </div>
        </div>
      </footer>
    </main>
  );
}
