"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import "highlight.js/styles/github-dark.css";

interface NoteViewerProps {
  content: string;
}

const components: Components = {
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
};

export function NoteViewer({ content }: NoteViewerProps) {
  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-a:text-[var(--accent)] prose-strong:text-[var(--text-primary)] prose-code:text-[var(--accent-teal)] prose-pre:bg-[var(--surface)] prose-pre:border prose-pre:border-[var(--border)] prose-th:text-[var(--text-secondary)] prose-td:text-[var(--text-secondary)] prose-blockquote:border-[var(--accent)] prose-blockquote:text-[var(--text-secondary)] prose-hr:border-[var(--border)]"
      data-testid="note-viewer"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
