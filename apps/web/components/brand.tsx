import Link from "next/link";

export function Brand({
  className = "brand",
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link className={className} href={href} aria-label="POT home">
      <svg
        className="pot-wordmark"
        viewBox="0 0 120 40"
        fill="none"
        aria-hidden="true"
      >
        <g fill="currentColor">
          <circle cx="12" cy="10" r="3" />
          <circle cx="20" cy="6" r="3" />
          <circle cx="28" cy="10" r="3" />
        </g>
        <path
          d="M6 19h28l-2 9a12.3 12.3 0 0 1-24 0l-2-9Z"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M49 31V9h9a7 7 0 0 1 0 14h-9M99 9h18m-9 0v22"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="74"
          y="9"
          width="15"
          height="22"
          rx="7.5"
          stroke="currentColor"
          strokeWidth="5.5"
        />
      </svg>
    </Link>
  );
}
