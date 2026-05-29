"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { formatInr } from "@/lib/catalog";
import { getApiBase } from "@/lib/api";

type OrderItem = {
  productId: string;
  name: string;
  sizeKg: number;
  quantity: number;
  unitPriceInr: number;
  lineTotalInr: number;
};

type OrderLookup = {
  id: string;
  customerName: string;
  phone: string;
  cylinderSizeKg: number;
  quantity: number;
  paymentMethod: string;
  address: string;
  status: string;
  amountInr?: number | null;
  currency?: string | null;
  paymentStatus?: string | null;
  paymentGateway?: string | null;
  createdAt: string;
  items?: OrderItem[];
};

type SearchMode = "reference" | "phone";

const trackNavLinks = [
  { label: "Home", href: "/" },
  { label: "Order Now", href: "/order" },
  { label: "Contact Us", href: "/#contact" }
];

const helpNotes = [
  "Search by order reference when you have the booking ID from the success message.",
  "Search by phone number to see all bookings created with that number.",
  "Phone lookup ignores spaces, brackets, and punctuation so customers can type naturally."
];

const statusTone: Record<string, string> = {
  Pending: "status-pending",
  Delivered: "status-delivered",
  Cancelled: "status-cancelled",
  "In-Transit": "status-transit",
  "In Transit": "status-transit",
  Dispatched: "status-transit"
};

export default function TrackOrderPage() {
  const [mode, setMode] = useState<SearchMode>("reference");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OrderLookup[]>([]);
  const [feedback, setFeedback] = useState<{ type: "info" | "err"; text: string } | null>(null);
  const [searchedValue, setSearchedValue] = useState("");

  const runLookup = async (nextMode: SearchMode, rawValue: string) => {
    const trimmed = rawValue.trim();

    if (!trimmed) {
      setFeedback({
        type: "err",
        text: nextMode === "reference" ? "Enter an order reference to search." : "Enter a phone number to search."
      });
      setResults([]);
      setSearchedValue("");
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const params = new URLSearchParams();
      if (nextMode === "reference") {
        params.set("reference", trimmed);
      } else {
        params.set("phone", trimmed);
      }

      const res = await fetch(`${getApiBase()}/api/orders/lookup?${params.toString()}`);
      const data = (await res.json().catch(() => ({}))) as { orders?: OrderLookup[]; error?: string };

      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not complete the order lookup.");
      }

      const foundOrders = Array.isArray(data.orders) ? data.orders : [];
      setResults(foundOrders);
      setSearchedValue(trimmed);

      if (foundOrders.length === 0) {
        setFeedback({
          type: "info",
          text:
            nextMode === "reference"
              ? "No order matched that reference."
              : "No orders matched that phone number."
        });
      } else {
        setFeedback(null);
      }

      if (typeof window !== "undefined") {
        const nextUrl =
          nextMode === "reference"
            ? `/track?reference=${encodeURIComponent(trimmed)}`
            : `/track?phone=${encodeURIComponent(trimmed)}`;
        window.history.replaceState(null, "", nextUrl);
      }
    } catch (error) {
      setResults([]);
      setSearchedValue(trimmed);
      setFeedback({
        type: "err",
        text: error instanceof Error ? error.message : "Unable to look up orders right now."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    const phone = params.get("phone");

    if (reference) {
      setMode("reference");
      setQuery(reference);
      void runLookup("reference", reference);
      return;
    }

    if (phone) {
      setMode("phone");
      setQuery(phone);
      void runLookup("phone", phone);
    }
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runLookup(mode, query);
  };

  return (
    <main className="track-page">
      <header className="site-header">
        <div className="shell site-header-inner">
          <Link href="/" className="brand-lockup" aria-label="Stockgap Fuels home">
            <Image
              src="/stockgas-logo.png"
              alt="STOCKGAS logo"
              width={220}
              height={170}
              className="brand-logo-image"
              priority
            />
            <span className="brand-copy">
              <span className="brand-name">Stockgap Fuels</span>
              <span className="brand-tag">Track customer orders and delivery status</span>
            </span>
          </Link>

          <nav className="site-nav" aria-label="Track page navigation">
            {trackNavLinks.map((link) => (
              <Link key={link.href} className="nav-link" href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            <Link className="btn btn-secondary" href="/#contact">
              Contact Us
            </Link>
            <Link className="btn btn-primary" href="/order">
              New Order
            </Link>
          </div>
        </div>
      </header>

      <section className="track-hero">
        <div className="shell track-hero-grid">
          <div className="track-copy">
            <span className="eyebrow">My Orders / Track Order</span>
            <h1>Search your orders by phone number or booking reference.</h1>
            <p className="section-lead">
              This page is built for customers who want a cleaner way to find past bookings without opening raw API
              data. Search by order reference for one specific booking, or use your phone number to list matching
              orders.
            </p>

            <div className="track-help-list">
              {helpNotes.map((note) => (
                <div className="promise-item" key={note}>
                  <span className="promise-dot" />
                  <p>{note}</p>
                </div>
              ))}
            </div>
          </div>

          <section className="contact-form-panel track-form-panel">
            <div className="form-heading">
              <span className="eyebrow">Search orders</span>
              <h3>Find your booking</h3>
            </div>

            <div className="track-mode-toggle" role="tablist" aria-label="Search mode">
              <button
                type="button"
                className={`track-mode-btn ${mode === "reference" ? "track-mode-btn-active" : ""}`}
                onClick={() => {
                  setMode("reference");
                  setFeedback(null);
                }}
              >
                Order reference
              </button>
              <button
                type="button"
                className={`track-mode-btn ${mode === "phone" ? "track-mode-btn-active" : ""}`}
                onClick={() => {
                  setMode("phone");
                  setFeedback(null);
                }}
              >
                Phone number
              </button>
            </div>

            {feedback && (
              <div className={`feedback-banner ${feedback.type === "err" ? "feedback-err" : "feedback-ok"}`}>
                {feedback.text}
              </div>
            )}

            <form onSubmit={onSubmit}>
              <label className="field">
                <span>{mode === "reference" ? "Order reference" : "Phone number"}</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={mode === "reference" ? "SG-1775901717876" : "+234 800 123 4567"}
                  autoComplete={mode === "reference" ? "off" : "tel"}
                />
              </label>

              <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
                {loading ? "Searching..." : mode === "reference" ? "Search by reference" : "Search by phone"}
              </button>
            </form>

            <p className="track-helper-text">
              {mode === "reference"
                ? "Use the booking reference shown after a successful order submission."
                : "Use the same phone number you entered while placing the order."}
            </p>
          </section>
        </div>
      </section>

      <section className="section track-results-section">
        <div className="shell track-results-layout">
          <div className="section-heading">
            <span className="eyebrow">Results</span>
            <h2>{results.length > 0 ? `${results.length} order${results.length > 1 ? "s" : ""} found` : "Track your latest booking status"}</h2>
            <p className="section-lead">
              {searchedValue
                ? `Showing results for ${mode === "reference" ? "reference" : "phone number"}: ${searchedValue}`
                : "Run a search above to see matching orders, references, addresses, and current statuses."}
            </p>
          </div>

          <div className="track-results-stack">
            {results.length === 0 ? (
              <section className="panel">
                <div className="panel-heading">
                  <span className="eyebrow">No results yet</span>
                  <h2>Nothing to display</h2>
                </div>
                <p className="muted-text">
                  Search by order reference or the phone number used when booking. If you recently placed an order,
                  you can also return to the booking page to copy the latest submission reference.
                </p>
                <div className="track-empty-actions">
                  <Link className="btn btn-secondary" href="/order">
                    Go To Booking Page
                  </Link>
                  <Link className="btn btn-secondary" href="/#contact">
                    Contact Support
                  </Link>
                </div>
              </section>
            ) : (
              results.map((order) => (
                <article className="panel track-result-card" key={order.id}>
                  <div className="track-result-head">
                    <div>
                      <span className="card-kicker">Order reference</span>
                      <h2>{order.id}</h2>
                    </div>
                    <span className={`track-status-pill ${statusTone[order.status] ?? "status-pending"}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="track-result-grid">
                    <div className="track-result-item">
                      <span>Customer</span>
                      <strong>{order.customerName}</strong>
                    </div>
                    <div className="track-result-item">
                      <span>Phone</span>
                      <strong>{order.phone}</strong>
                    </div>
                    <div className="track-result-item">
                      <span>Cylinders</span>
                      <strong>
                        {order.items && order.items.length > 0
                          ? `${order.items.reduce((sum, item) => sum + item.quantity, 0)} item(s)`
                          : `${order.quantity} x ${order.cylinderSizeKg}kg`}
                      </strong>
                    </div>
                    <div className="track-result-item">
                      <span>Payment</span>
                      <strong>{order.paymentMethod}</strong>
                    </div>
                    {order.amountInr ? (
                      <div className="track-result-item">
                        <span>Amount</span>
                        <strong>{formatInr(order.amountInr)}</strong>
                      </div>
                    ) : null}
                    {order.paymentStatus ? (
                      <div className="track-result-item">
                        <span>Payment status</span>
                        <strong>{order.paymentStatus}</strong>
                      </div>
                    ) : null}
                    <div className="track-result-item track-result-item-wide">
                      <span>Delivery address</span>
                      <strong>{order.address}</strong>
                    </div>
                    <div className="track-result-item">
                      <span>Created</span>
                      <strong>{new Date(order.createdAt).toLocaleString()}</strong>
                    </div>
                  </div>
                  {order.items && order.items.length > 0 ? (
                    <div className="receipt-items track-items">
                      {order.items.map((item) => (
                        <div className="receipt-item" key={`${order.id}-${item.productId}`}>
                          <span>
                            {item.quantity} x {item.name}
                          </span>
                          <strong>{formatInr(item.lineTotalInr)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
