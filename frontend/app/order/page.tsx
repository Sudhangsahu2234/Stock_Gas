"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { getApiBase } from "@/lib/api";

type OrderReceipt = {
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
};

const emptyForm = {
  customerName: "",
  phone: "",
  cylinderSizeKg: "12.5",
  quantity: "1",
  paymentMethod: "Cash on delivery",
  amountInr: "",
  address: ""
};

const bookingPromises = [
  "Customer-facing booking form for cylinder size, quantity, payment method, and delivery address.",
  "A cleaner order journey without publicly exposing all saved orders on the page.",
  "Faster handoff into operations, support, and follow-up once a booking is submitted."
];

const followUpSteps = [
  "Cash and offline payment methods create the booking immediately for operational follow-up.",
  "Razorpay payments are verified first, and the LPG order is saved only after the payment succeeds.",
  "If you need help after booking, use the Contact Us section on the homepage for support escalation."
];

type RazorpayOrderResponse = {
  checkoutUrl: string;
};



export default function OrderPage() {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        customerName: form.customerName.trim(),
        phone: form.phone.trim(),
        cylinderSizeKg: Number(form.cylinderSizeKg),
        quantity: Number(form.quantity),
        paymentMethod: form.paymentMethod,
        amountInr: form.amountInr ? Number(form.amountInr) : undefined,
        address: form.address.trim()
      };

      if (payload.paymentMethod === "Razorpay") {
        if (!payload.amountInr || payload.amountInr <= 0) {
          throw new Error("Enter a valid amount in INR before opening Razorpay.");
        }

        const createPaymentRes = await fetch(`${getApiBase()}/api/payments/razorpay/order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const paymentOrderData = (await createPaymentRes.json().catch(() => ({}))) as
          | RazorpayOrderResponse
          | { error?: string };

        if (!createPaymentRes.ok) {
          const paymentOrderError = paymentOrderData as { error?: string };
          throw new Error(
            typeof paymentOrderError.error === "string"
              ? paymentOrderError.error
              : "Razorpay payment order could not be created."
          );
        }

        const paymentOrder = paymentOrderData as RazorpayOrderResponse;

        // Store booking data for verification after redirect
        sessionStorage.setItem('pendingBooking', JSON.stringify(payload));

        // Redirect to Razorpay checkout
        window.location.href = paymentOrder.checkoutUrl;
        return;
      }

      const res = await fetch(`${getApiBase()}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = (await res.json().catch(() => ({}))) as Partial<OrderReceipt> & { error?: string };

      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Order could not be saved.");
      }

      setReceipt({
        id: data.id ?? "Pending confirmation",
        customerName: data.customerName ?? payload.customerName,
        phone: data.phone ?? payload.phone,
        cylinderSizeKg: data.cylinderSizeKg ?? payload.cylinderSizeKg,
        quantity: data.quantity ?? payload.quantity,
        paymentMethod: data.paymentMethod ?? payload.paymentMethod,
        address: data.address ?? payload.address,
        amountInr: data.amountInr ?? null,
        currency: data.currency ?? null,
        paymentStatus: data.paymentStatus ?? "Pending",
        paymentGateway: data.paymentGateway ?? null,
        status: data.status ?? "Pending",
        createdAt: data.createdAt ?? new Date().toISOString()
      });

      setMessage({
        type: "ok",
        text: `Booking submitted successfully. Reference: ${data.id ?? "pending"}.`
      });
      setForm(emptyForm);
    } catch (error) {
      setMessage({
        type: "err",
        text: error instanceof Error ? error.message : "Something went wrong while placing the order."
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="order-page">
      <section className="order-hero">
        <div className="shell order-hero-grid">
          <div className="order-hero-copy">
            <Link href="/" className="order-logo-link" aria-label="Stockgap Fuels home">
              <Image
                src="/stockgas-logo.jpeg"
                alt="STOCKGAS logo"
                width={220}
                height={170}
                className="order-logo-image"
                priority
              />
            </Link>
            <Link href="/" className="crumb-link">
              ← Back to homepage
            </Link>
            <span className="eyebrow">Order Now / Booking</span>
            <h1>Book LPG cylinder delivery with Stockgap Fuels.</h1>
            <p className="section-lead">
              Use the dedicated booking page to submit a cylinder request, choose your preferred payment method, and
              give the operations team the delivery details they need to fulfil the order.
            </p>

            <div className="promise-list">
              {bookingPromises.map((promise) => (
                <div className="promise-item" key={promise}>
                  <span className="promise-dot" />
                  <p>{promise}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="order-hero-panel">
            <span className="card-kicker">Booking scope</span>
            <h2>Customer-friendly request flow</h2>
            <ul className="hero-side-list">
              <li>Supported cylinder sizes: 3kg, 5kg, 6kg, 12.5kg, and 50kg.</li>
              <li>Payment preferences include cash on delivery, transfer, card/POS, wallet, and Razorpay.</li>
              <li>Use the new Track Order page to search by phone number or order reference.</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="section order-content">
        <div className="shell order-content-grid">
          <section className="panel order-form-panel">
            <div className="panel-heading">
              <span className="eyebrow">Booking Form</span>
              <h2>Submit a new LPG order</h2>
            </div>

            {message && (
              <div className={`feedback-banner ${message.type === "ok" ? "feedback-ok" : "feedback-err"}`}>
                {message.text}
              </div>
            )}

            <form className="order-form" onSubmit={onSubmit}>
              <label className="field">
                <span>Full name</span>
                <input
                  required
                  value={form.customerName}
                  onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
                  placeholder="Customer name"
                  autoComplete="name"
                />
              </label>

              <label className="field">
                <span>Phone</span>
                <input
                  required
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+234 ..."
                  autoComplete="tel"
                />
              </label>

              <div className="form-row">
                <label className="field">
                  <span>Cylinder size</span>
                  <select
                    required
                    value={form.cylinderSizeKg}
                    onChange={(event) => setForm((current) => ({ ...current, cylinderSizeKg: event.target.value }))}
                  >
                    {["3", "5", "6", "12.5", "50"].map((size) => (
                      <option key={size} value={size}>
                        {size} kg
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Quantity</span>
                  <input
                    required
                    min={1}
                    type="number"
                    value={form.quantity}
                    onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                  />
                </label>
              </div>

              <label className="field">
                <span>Payment method</span>
                <select
                  required
                  value={form.paymentMethod}
                  onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                >
                  <option>Cash on delivery</option>
                  <option>Bank transfer</option>
                  <option>Card / POS</option>
                  <option>Wallet</option>
                  <option>Razorpay</option>
                </select>
              </label>

              {form.paymentMethod === "Razorpay" && (
                <label className="field">
                  <span>Amount to pay (INR)</span>
                  <input
                    required
                    min="1"
                    step="0.01"
                    type="number"
                    value={form.amountInr}
                    onChange={(event) => setForm((current) => ({ ...current, amountInr: event.target.value }))}
                    placeholder="Enter payable amount in INR"
                    inputMode="decimal"
                  />
                  <small className="field-help">
                    Razorpay will open a secure payment window. The order will be saved after payment verification.
                  </small>
                </label>
              )}

              <label className="field">
                <span>Delivery address</span>
                <textarea
                  required
                  rows={4}
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  placeholder="Street, area, city"
                />
              </label>

              <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
                {submitting ? "Processing..." : form.paymentMethod === "Razorpay" ? "Pay With Razorpay" : "Place Order"}
              </button>
            </form>
          </section>

          <aside className="order-sidebar">
            <section className="panel">
              <div className="panel-heading">
                <span className="eyebrow">What Happens Next</span>
                <h2>After you submit</h2>
              </div>
              <div className="follow-up-list">
                {followUpSteps.map((step) => (
                  <div className="follow-up-item" key={step}>
                    <span className="follow-up-index">•</span>
                    <p>{step}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <span className="eyebrow">Booking Status</span>
                <h2>Latest submission</h2>
              </div>

              {receipt ? (
                <>
                  <div className="receipt-card">
                    <div className="receipt-row">
                      <span>Reference</span>
                      <strong>{receipt.id}</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Status</span>
                      <strong>{receipt.status}</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Customer</span>
                      <strong>{receipt.customerName}</strong>
                    </div>
                    <div className="receipt-row">
                      <span>Order</span>
                      <strong>
                        {receipt.quantity} x {receipt.cylinderSizeKg}kg
                      </strong>
                    </div>
                    <div className="receipt-row">
                      <span>Payment</span>
                      <strong>{receipt.paymentMethod}</strong>
                    </div>
                    {receipt.amountInr ? (
                      <div className="receipt-row">
                        <span>Amount</span>
                        <strong>
                          {receipt.currency ?? "INR"} {receipt.amountInr}
                        </strong>
                      </div>
                    ) : null}
                    {receipt.paymentStatus ? (
                      <div className="receipt-row">
                        <span>Payment status</span>
                        <strong>{receipt.paymentStatus}</strong>
                      </div>
                    ) : null}
                    <div className="receipt-row">
                      <span>Created</span>
                      <strong>{new Date(receipt.createdAt).toLocaleString()}</strong>
                    </div>
                  </div>
                  <Link className="btn btn-secondary btn-block receipt-action" href={`/track?reference=${encodeURIComponent(receipt.id)}`}>
                    Track This Order
                  </Link>
                </>
              ) : (
                <p className="muted-text">
                  Your latest confirmed booking will appear here after submission, giving customers a simple reference
                  without exposing a public order list.
                </p>
              )}
            </section>

            <section className="panel panel-accent">
              <span className="card-kicker">Need help?</span>
              <h2>Talk to the support team</h2>
              <p>
                For customer assistance, dealer helpdesk questions, or partnership enquiries, use the homepage contact
                form. If you already placed an order, you can also search it by phone number or reference.
              </p>
              <Link className="btn btn-secondary btn-block" href="/track">
                Open Track Order Page
              </Link>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
