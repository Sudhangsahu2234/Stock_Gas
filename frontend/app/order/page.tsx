"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { formatInr, productCatalog, type CatalogProduct } from "@/lib/catalog";
import { getApiBase } from "@/lib/api";

type OrderItem = {
  productId: string;
  name: string;
  sizeKg: number;
  quantity: number;
  unitPriceInr: number;
  lineTotalInr: number;
};

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
  items?: OrderItem[];
};

const emptyForm = {
  customerName: "",
  phone: "",
  paymentMethod: "Cash on delivery",
  address: ""
};

const initialCart: Record<string, number> = {
  "cyl-12-5kg": 1
};

type RazorpayOrderResponse = {
  checkoutUrl: string;
};

function buildCartItems(cart: Record<string, number>) {
  return productCatalog
    .map((product) => {
      const quantity = cart[product.id] || 0;
      return {
        product,
        quantity,
        lineTotalInr: product.priceInr * quantity
      };
    })
    .filter((item) => item.quantity > 0);
}

function ProductCartCard({
  product,
  quantity,
  onIncrease,
  onDecrease,
  onSetQuantity
}: {
  product: CatalogProduct;
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onSetQuantity: (quantity: number) => void;
}) {
  return (
    <article className={`cart-product-card ${quantity > 0 ? "cart-product-card-active" : ""}`}>
      <div className="cart-product-image">
        <Image src={product.image} alt={product.name} fill className="product-image" />
        <span className="product-badge">{product.badge}</span>
      </div>
      <div className="cart-product-body">
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <div className="product-price-row">
          <strong>{formatInr(product.priceInr)}</strong>
          <span>{product.availability}</span>
        </div>
        <div className="quantity-control" aria-label={`${product.name} quantity`}>
          <button type="button" onClick={onDecrease} disabled={quantity === 0}>
            -
          </button>
          <input
            aria-label={`${product.name} quantity value`}
            min={0}
            type="number"
            value={quantity}
            onChange={(event) => onSetQuantity(Number(event.target.value))}
          />
          <button type="button" onClick={onIncrease}>
            +
          </button>
        </div>
      </div>
    </article>
  );
}

export default function OrderPage() {
  const [form, setForm] = useState(emptyForm);
  const [cart, setCart] = useState<Record<string, number>>(initialCart);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);

  const cartItems = useMemo(() => buildCartItems(cart), [cart]);
  const subtotal = cartItems.reduce((sum, item) => sum + item.lineTotalInr, 0);
  const deliveryFee = 0;
  const total = subtotal + deliveryFee;
  const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const setProductQuantity = (productId: string, nextQuantity: number) => {
    const safeQuantity = Number.isFinite(nextQuantity) ? Math.max(0, Math.floor(nextQuantity)) : 0;
    setCart((current) => ({ ...current, [productId]: safeQuantity }));
  };

  const buildPayload = () => ({
    customerName: form.customerName.trim(),
    phone: form.phone.trim(),
    paymentMethod: form.paymentMethod,
    address: form.address.trim(),
    items: cartItems.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity
    }))
  });

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      if (cartItems.length === 0 || total <= 0) {
        throw new Error("Add at least one LPG cylinder to the cart before placing an order.");
      }

      const payload = buildPayload();

      if (payload.paymentMethod === "Razorpay") {
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

        sessionStorage.setItem("pendingBooking", JSON.stringify(payload));
        window.location.href = (paymentOrderData as RazorpayOrderResponse).checkoutUrl;
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

      const nextReceipt = data as OrderReceipt;
      setReceipt(nextReceipt);
      setMessage({
        type: "ok",
        text: `Booking submitted successfully. Reference: ${nextReceipt.id ?? "pending"}.`
      });
      setForm(emptyForm);
      setCart(initialCart);
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
          <nav className="site-nav" aria-label="Order navigation">
            <Link className="nav-link" href="/">
              Home
            </Link>
            <Link className="nav-link" href="/track">
              Track
            </Link>
            <Link className="nav-link" href="/terminal-information">
              Terminal
            </Link>
          </nav>
        </div>
      </header>

      <section className="order-hero">
        <div className="shell order-hero-grid">
          <div className="order-hero-copy">
            <span className="section-tag red">Order Cylinder</span>
            <h1>Build your StockGas LPG cart.</h1>
            <p>
              Add multiple cylinder sizes, review the calculated INR total, then submit for operational follow-up or
              pay through the existing Razorpay checkout.
            </p>
            <div className="order-hero-actions">
              <Link href="/" className="btn btn-outline">
                Back to Homepage
              </Link>
              <Link href="/track" className="btn btn-outline">
                Track Existing Order
              </Link>
            </div>
          </div>
          <div className="order-hero-photo">
            <Image src="/stockgas-plant-line.jpeg" alt="StockGas LPG cylinders in filling plant" fill className="terminal-photo" priority />
          </div>
        </div>
      </section>

      <section className="section order-content">
        <div className="shell order-content-grid">
          <section className="cart-builder-panel">
            <div className="section-heading">
              <span className="section-tag">Cylinder Cart</span>
              <h2>Select cylinder sizes and quantities.</h2>
              <p>Demo prices power the calculation until final StockGas prices are supplied.</p>
            </div>

            <div className="cart-products-grid">
              {productCatalog.map((product) => (
                <ProductCartCard
                  key={product.id}
                  product={product}
                  quantity={cart[product.id] || 0}
                  onIncrease={() => setProductQuantity(product.id, (cart[product.id] || 0) + 1)}
                  onDecrease={() => setProductQuantity(product.id, (cart[product.id] || 0) - 1)}
                  onSetQuantity={(quantity) => setProductQuantity(product.id, quantity)}
                />
              ))}
            </div>
          </section>

          <aside className="order-sidebar">
            <section className="panel cart-summary-panel">
              <div className="panel-heading">
                <span className="section-tag red">Cart Summary</span>
                <h2>{totalQuantity} cylinder{totalQuantity === 1 ? "" : "s"} selected</h2>
              </div>

              {cartItems.length === 0 ? (
                <p className="muted-text">Your cart is empty. Add at least one cylinder to calculate the total.</p>
              ) : (
                <div className="cart-lines">
                  {cartItems.map((item) => (
                    <div className="cart-line" key={item.product.id}>
                      <div>
                        <strong>{item.product.name}</strong>
                        <span>
                          {item.quantity} x {formatInr(item.product.priceInr)}
                        </span>
                      </div>
                      <strong>{formatInr(item.lineTotalInr)}</strong>
                    </div>
                  ))}
                </div>
              )}

              <div className="summary-totals">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatInr(subtotal)}</strong>
                </div>
                <div>
                  <span>Delivery fee</span>
                  <strong>{deliveryFee === 0 ? "Free" : formatInr(deliveryFee)}</strong>
                </div>
                <div className="grand-total">
                  <span>Total</span>
                  <strong>{formatInr(total)}</strong>
                </div>
              </div>
            </section>

            <section className="panel order-form-panel">
              <div className="panel-heading">
                <span className="section-tag">Customer Details</span>
                <h2>Complete booking</h2>
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
                  {form.paymentMethod === "Razorpay" ? (
                    <small className="field-help">Razorpay will receive the server-calculated cart total.</small>
                  ) : null}
                </label>
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

                <button className="btn btn-primary btn-block" type="submit" disabled={submitting || cartItems.length === 0}>
                  {submitting ? "Processing..." : form.paymentMethod === "Razorpay" ? `Pay ${formatInr(total)}` : "Place Order"}
                </button>
              </form>
            </section>

            {receipt ? (
              <section className="panel">
                <div className="panel-heading">
                  <span className="section-tag red">Latest Submission</span>
                  <h2>Booking confirmed</h2>
                </div>
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
                    <span>Total</span>
                    <strong>{formatInr(receipt.amountInr ?? total)}</strong>
                  </div>
                  <div className="receipt-items">
                    {(receipt.items ?? []).map((item) => (
                      <div className="receipt-item" key={`${receipt.id}-${item.productId}`}>
                        <span>
                          {item.quantity} x {item.name}
                        </span>
                        <strong>{formatInr(item.lineTotalInr)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <Link className="btn btn-outline btn-block receipt-action" href={`/track?reference=${encodeURIComponent(receipt.id)}`}>
                  Track This Order
                </Link>
              </section>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
