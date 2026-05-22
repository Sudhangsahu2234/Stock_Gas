"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
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

export default function SuccessPage() {
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const razorpayPaymentId = urlParams.get('razorpay_payment_id');
        const razorpayOrderId = urlParams.get('razorpay_order_id');
        const razorpaySignature = urlParams.get('razorpay_signature');

        if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
          throw new Error("Payment details are missing from the URL.");
        }

        const bookingData = sessionStorage.getItem('pendingBooking');
        if (!bookingData) {
          throw new Error("Booking data not found. Please try placing the order again.");
        }

        const booking = JSON.parse(bookingData);

        const verifyRes = await fetch(`${getApiBase()}/api/payments/razorpay/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            booking
          })
        });

        const verifiedData = (await verifyRes.json().catch(() => ({}))) as Partial<OrderReceipt> & {
          error?: string;
        };

        if (!verifyRes.ok) {
          throw new Error(
            typeof verifiedData.error === "string"
              ? verifiedData.error
              : "Payment verification failed."
          );
        }

        setReceipt(verifiedData as OrderReceipt);
        setMessage({
          type: "ok",
          text: `Payment received and booking submitted successfully. Reference: ${(verifiedData as OrderReceipt).id}.`
        });

        // Clear the stored booking data only on success
        sessionStorage.removeItem('pendingBooking');
      } catch (error) {
        setMessage({
          type: "err",
          text: error instanceof Error ? error.message : "Something went wrong during payment verification."
        });
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, []);

  if (loading) {
    return (
      <main className="success-page">
        <div className="shell">
          <div className="loading">
            <p>Verifying payment...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="success-page">
      <section className="section">
        <div className="shell">
          <div className="success-content">
            <Link href="/" className="logo-link" aria-label="Stockgap Fuels home">
              <Image
                src="/stockgas-logo.jpeg"
                alt="STOCKGAS logo"
                width={220}
                height={170}
                className="logo-image"
                priority
              />
            </Link>
            <Link href="/" className="crumb-link">
              ← Back to homepage
            </Link>

            {message && (
              <div className={`feedback-banner ${message.type === "ok" ? "feedback-ok" : "feedback-err"}`}>
                {message.text}
              </div>
            )}

            {receipt && (
              <div className="receipt-card">
                <h2>Booking Confirmed</h2>
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
                {receipt.amountInr && (
                  <div className="receipt-row">
                    <span>Amount</span>
                    <strong>
                      {receipt.currency ?? "INR"} {receipt.amountInr}
                    </strong>
                  </div>
                )}
                {receipt.paymentStatus && (
                  <div className="receipt-row">
                    <span>Payment status</span>
                    <strong>{receipt.paymentStatus}</strong>
                  </div>
                )}
                <div className="receipt-row">
                  <span>Created</span>
                  <strong>{new Date(receipt.createdAt).toLocaleString()}</strong>
                </div>
                <Link className="btn btn-primary" href={`/track?reference=${encodeURIComponent(receipt.id)}`}>
                  Track This Order
                </Link>
              </div>
            )}

            <Link href="/order" className="btn btn-secondary">
              Place Another Order
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}