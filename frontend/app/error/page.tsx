"use client";

import Image from "next/image";
import Link from "next/link";

export default function ErrorPage() {
  return (
    <main className="error-page">
      <section className="section">
        <div className="shell">
          <div className="error-content">
            <Link href="/" className="logo-link" aria-label="Stockgap Fuels home">
              <Image
                src="/stockgas-logo.png"
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

            <div className="feedback-banner feedback-err">
              Payment was cancelled or failed. Please try again.
            </div>

            <p>
              If you encountered an issue during payment, please contact support or try placing the order again.
            </p>

            <Link href="/order" className="btn btn-primary">
              Try Again
            </Link>
            <Link href="/" className="btn btn-secondary">
              Back to Homepage
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
