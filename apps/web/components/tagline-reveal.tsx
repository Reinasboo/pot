"use client";

import { useEffect, useRef } from "react";

export function TaglineReveal() {
  const element = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 1, rootMargin: "0px 0px -12% 0px" },
    );
    element.current
      ?.querySelectorAll("span")
      .forEach((word) => observer.observe(word));
    return () => observer.disconnect();
  }, []);
  return (
    <p
      className="home-tagline"
      ref={element}
      aria-label="Good things happen when everyone chips in."
    >
      {["Good", "things", "happen", "when", "everyone", "chips", "in."].map(
        (word, i) => (
          <span
            key={word}
            aria-hidden="true"
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            {word}{" "}
          </span>
        ),
      )}
    </p>
  );
}
