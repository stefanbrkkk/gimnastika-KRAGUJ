interface SourceLinkProps {
  href: string;
  /** What the source proves, for the accessible name: "izvor: <context>". */
  context: string;
  className?: string;
  label?: string;
}

const hostOf = (href: string) => {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
};

/** Small "izvor ↗" link to a primary source (GSS bulletin, press). Opens in a new tab. */
export function SourceLink({ href, context, className, label = "izvor" }: SourceLinkProps) {
  const pdf = /\.pdf($|\?)/i.test(href);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={["source-link", className].filter(Boolean).join(" ")}
      data-source-url=""
    >
      <span aria-hidden="true">{label} ↗</span>
      <span className="sr-only">
        {`Izvor za „${context}“: ${hostOf(href)}${pdf ? ", PDF" : ""} (otvara se u novom prozoru)`}
      </span>
    </a>
  );
}
