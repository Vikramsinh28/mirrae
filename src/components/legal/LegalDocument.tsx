import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { siteConfig } from '@/app/siteConfig';

export const LEGAL_LAST_UPDATED = '22 November 2026';

type LegalDocumentProps = {
  title: string;
  path: string;
  markdown: string;
};

type AnchorProps = ComponentProps<'a'>;
type WithChildren = { children?: ReactNode };

const markdownComponents: Components = {
  a: MarkdownLink,
  h1: ({ children }: WithChildren) => (
    <h1 className="mb-3 text-3xl font-bold text-white sm:text-4xl md:text-5xl">{children}</h1>
  ),
  h2: ({ children }: WithChildren) => (
    <h2 className="mb-3 mt-10 text-xl font-semibold text-text sm:text-2xl">{children}</h2>
  ),
  h3: ({ children }: WithChildren) => (
    <h3 className="mb-2 mt-6 text-lg font-medium text-text sm:text-xl">{children}</h3>
  ),
  p: ({ children }: WithChildren) => <p className="my-3 text-sm text-text-muted sm:text-base">{children}</p>,
  ul: ({ children }: WithChildren) => (
    <ul className="my-3 list-disc space-y-2 pl-5 text-sm text-text-muted sm:pl-6 sm:text-base">{children}</ul>
  ),
  ol: ({ children }: WithChildren) => (
    <ol className="my-3 list-decimal space-y-2 pl-5 text-sm text-text-muted sm:pl-6 sm:text-base">{children}</ol>
  ),
  strong: ({ children }: WithChildren) => <strong className="font-semibold text-text">{children}</strong>,
  table: ({ children }: WithChildren) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm sm:text-base">{children}</table>
    </div>
  ),
  th: ({ children }: WithChildren) => (
    <th className="border-b border-white/20 px-3 py-2 font-semibold text-text">{children}</th>
  ),
  td: ({ children }: WithChildren) => (
    <td className="border-b border-white/10 px-3 py-2 align-top text-text-muted">{children}</td>
  ),
};

const LINK_CLASS = 'text-blue-300 underline underline-offset-2 hover:text-blue-200';

function MarkdownLink({ href = '', children }: AnchorProps) {
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={LINK_CLASS}>
        {children}
      </Link>
    );
  }
  const isMail = href.startsWith('mailto:');
  return (
    <a href={href} className={LINK_CLASS} {...(isMail ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>
      {children}
    </a>
  );
}

/** Renders a legal text (markdown kept in src/data/legal) inside the dark marketing layout. */
export function LegalDocument({ title, path, markdown }: LegalDocumentProps) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    url: `${siteConfig.url}${path}`,
    dateModified: LEGAL_LAST_UPDATED,
    isPartOf: { '@type': 'WebSite', name: 'Mirrae', url: siteConfig.url },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="container relative mx-auto px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <div
            role="note"
            className="mb-8 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          >
            <strong>Draft v0.1.</strong> This text is being reviewed by a lawyer and may change. If you have a question
            about it, write to{' '}
            <a className="underline" href="mailto:connect@mirrae.org">
              connect@mirrae.org
            </a>
            .
          </div>
          <article>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {markdown}
            </ReactMarkdown>
          </article>
        </div>
      </div>
    </>
  );
}
