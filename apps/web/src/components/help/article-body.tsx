/** Renders the Help Center's tiny markup: "## " headings, "- " list items, blank lines between paragraphs. */
export function ArticleBody({ body, className = "" }: { body: string; className?: string }) {
  const blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={`grid gap-4 leading-relaxed ${className}`} dir="auto">
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h2 key={i} className="pt-2 text-lg font-semibold">{b.slice(3)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="grid list-disc gap-1.5 ps-5">
              {lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}
            </ul>
          );
        }
        return <p key={i}>{lines.join(" ")}</p>;
      })}
    </div>
  );
}
