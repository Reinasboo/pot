"use client";

import Link from "next/link";
import { useState } from "react";
import { planTemplates, type PlanTemplateKey } from "@/lib/plan-templates";

export function HomeProductPreview() {
  const [selected, setSelected] = useState<PlanTemplateKey>("trip");
  const plan = planTemplates[selected];
  return (
    <div className="product-preview-stage">
      <div
        className="preview-selector"
        role="group"
        aria-label="Choose an example plan"
      >
        {(Object.keys(planTemplates) as PlanTemplateKey[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={selected === key}
            onClick={() => setSelected(key)}
          >
            {planTemplates[key].label}
          </button>
        ))}
      </div>
      <article
        className={`product-preview-card preview-theme-${selected}`}
        aria-label="Example pot plan"
      >
        <div className="product-preview-cover" aria-hidden="true">
          <svg className="preview-landscape" viewBox="0 0 500 225" fill="none">
            {selected === "trip" ? (
              <>
                <circle
                  cx="383"
                  cy="55"
                  r="29"
                  fill="currentColor"
                  opacity=".32"
                />
                <path
                  d="M0 225 148 61 297 225H0Z"
                  fill="currentColor"
                  opacity=".18"
                />
                <path
                  d="m166 225 189-177 145 151v26H166Z"
                  fill="currentColor"
                  opacity=".26"
                />
                <path
                  d="m355 48-49 46 49-13 28 1-28-34Z"
                  fill="white"
                  opacity=".5"
                />
                <path
                  d="M275 225c-50-45 43-53-2-84"
                  stroke="white"
                  strokeWidth="9"
                  opacity=".55"
                />
              </>
            ) : selected === "gift" ? (
              <>
                <circle
                  cx="365"
                  cy="130"
                  r="100"
                  fill="currentColor"
                  opacity=".08"
                />
                <path
                  d="M299 118h132v94H299z"
                  fill="currentColor"
                  opacity=".2"
                />
                <path
                  d="M288 102h154v29H288z"
                  fill="currentColor"
                  opacity=".25"
                />
                <path
                  d="M363 102v110M365 101c-61 1-74-57-43-57 27 0 43 57 43 57Zm0 0c61 1 74-57 43-57-27 0-43 57-43 57Z"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d="m245 70 9-9m-5 49-11-4m207-48 8 9"
                  stroke="currentColor"
                  strokeWidth="3"
                  opacity=".4"
                />
              </>
            ) : (
              <>
                <circle
                  cx="380"
                  cy="100"
                  r="69"
                  fill="currentColor"
                  opacity=".16"
                />
                <path
                  d="M266 225c0-73 41-120 107-123-2 67-37 108-107 123Z"
                  fill="currentColor"
                  opacity=".25"
                />
                <path
                  d="M277 197c1-52-26-90-78-103-8 52 18 91 78 103Z"
                  fill="currentColor"
                  opacity=".18"
                />
                <path
                  d="M277 225v-63m0 50 56-59m-56 32-43-43"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>
          <span className="preview-cover-brand">
            POT<span aria-hidden="true">↗</span>
          </span>
          <span className="preview-example-badge">Example plan</span>
          <p>{plan.kind}</p>
        </div>
        <div className="product-preview-content" aria-live="polite">
          <h2>
            {plan.headline.split("\n").map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
          <div className="preview-goal">
            <div>
              <span>Planned goal</span>
              <strong>
                {Number(plan.target).toLocaleString("en-US")}{" "}
                <small>USDC</small>
              </strong>
            </div>
            <span className="preview-rule-badge">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m9 12 2 2 4-4M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
              </svg>
              Goal + refunds
            </span>
          </div>
          <div className="preview-plan-rail">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="preview-rail-caption">
            A goal to plan around. No money collected.
          </p>
          <div className="preview-money-rule">
            <span aria-hidden="true">↳</span>
            <p>
              <strong>Everyone knows the deal.</strong>If the goal is missed by
              the deadline, contributors can claim their money back.
            </p>
          </div>
          <Link
            className="preview-plan-link"
            href={`/create?template=${selected}`}
          >
            Plan{" "}
            {selected === "trip"
              ? "a trip"
              : selected === "gift"
                ? "a group gift"
                : "a good cause"}{" "}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </article>
      <div className="preview-stage-note">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 8v5m0 3v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        Explore a plan. Nothing here moves money.
      </div>
    </div>
  );
}
