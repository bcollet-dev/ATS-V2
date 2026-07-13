"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";

export type GuideDoc = { slug: string; title: string; markdown: string };

const mdComponents = {
  h1: () => null, // le titre est déjà affiché dans l'en-tête
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mt-8 mb-3 text-lg font-semibold text-foreground first:mt-0" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mt-6 mb-2 text-base font-semibold text-foreground" {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="my-3 text-sm leading-relaxed text-muted-foreground" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="my-3 ml-5 list-disc space-y-1.5 text-sm text-muted-foreground" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="my-3 ml-5 list-decimal space-y-1.5 text-sm text-muted-foreground" {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => <li className="leading-relaxed" {...props} />,
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a className="text-[var(--color-eda-rh)] underline underline-offset-2" {...props} />
  ),
  hr: () => <hr className="my-6 border-border" />,
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code className="rounded bg-muted px-1.5 py-0.5 text-[0.8em] font-mono text-foreground" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="my-4 border-l-2 border-[var(--color-eda-rh)] bg-muted/40 px-4 py-2 text-sm text-muted-foreground" {...props} />
  ),
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-4 overflow-x-auto rounded-lg border">
      <table className="w-full text-sm" {...props} />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-muted/50" {...props} />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th className="border-b px-3 py-2 text-left text-xs font-semibold text-foreground" {...props} />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-b px-3 py-2 align-top text-xs text-muted-foreground" {...props} />
  ),
};

export function GuideViewer({ guides }: { guides: GuideDoc[] }) {
  const [active, setActive] = useState(0);

  if (guides.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Aucun guide disponible pour le moment.</div>
    );
  }

  const current = guides[Math.min(active, guides.length - 1)];

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-eda-rh)] text-white">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Guide de l&apos;application</h1>
          <p className="text-sm text-muted-foreground">
            Modes d&apos;emploi par workflow — ce que vous pouvez faire et ce que chaque action entraîne.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        {/* Navigation */}
        <nav className="flex flex-row flex-wrap gap-1.5 md:flex-col md:flex-nowrap">
          {guides.map((g, i) => (
            <button
              key={g.slug}
              onClick={() => setActive(i)}
              className={cn(
                "rounded-md px-3 py-2 text-left text-sm transition-colors",
                i === active
                  ? "bg-[var(--color-eda-rh)]/10 font-medium text-[var(--color-eda-rh)]"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {g.title}
            </button>
          ))}
        </nav>

        {/* Contenu */}
        <article className="min-w-0 rounded-xl border bg-card p-6">
          <h2 className="mb-4 text-xl font-bold text-foreground">{current.title}</h2>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {current.markdown}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
