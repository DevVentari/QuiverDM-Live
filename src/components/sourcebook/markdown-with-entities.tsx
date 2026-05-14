'use client';

import { cloneElement, isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { EntityLink, type EntityRef } from './EntityLink';

interface Props {
  markdown: string;
  entityById: Map<string, EntityRef>;
  campaignSlug: string;
}

const ENTITY_RE = /\[\[entity:([^|\]]+)\|([^\]]+)\]\]/g;

function renderWithEntityTokens(
  text: string,
  entityById: Map<string, EntityRef>,
  campaignSlug: string,
): ReactNode[] {
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  ENTITY_RE.lastIndex = 0;
  let key = 0;

  while ((match = ENTITY_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(text.slice(lastIndex, match.index));
    }

    const entity = entityById.get(match[1]);
    if (entity) {
      out.push(<EntityLink key={key++} entity={entity} displayText={match[2]} campaignSlug={campaignSlug} />);
    } else {
      out.push(match[2]);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    out.push(text.slice(lastIndex));
  }

  return out;
}

function transformNode(node: ReactNode, entityById: Map<string, EntityRef>, campaignSlug: string): ReactNode {
  if (typeof node === 'string') {
    return node.includes('[[entity:') ? renderWithEntityTokens(node, entityById, campaignSlug) : node;
  }

  if (Array.isArray(node)) {
    return node.map((child, index) => (
      <span key={index}>{transformNode(child, entityById, campaignSlug)}</span>
    ));
  }

  if (isValidElement(node) && 'children' in node.props) {
    return cloneElement(node, {
      children: transformNode(node.props.children, entityById, campaignSlug),
    });
  }

  return node;
}

function renderChildren(children: ReactNode, entityById: Map<string, EntityRef>, campaignSlug: string): ReactNode {
  return transformNode(children, entityById, campaignSlug);
}

export function MarkdownWithEntities({ markdown, entityById, campaignSlug }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p>{renderChildren(children, entityById, campaignSlug)}</p>,
        li: ({ children }) => <li>{renderChildren(children, entityById, campaignSlug)}</li>,
        td: ({ children }) => <td>{renderChildren(children, entityById, campaignSlug)}</td>,
        th: ({ children }) => <th>{renderChildren(children, entityById, campaignSlug)}</th>,
        em: ({ children }) => <em>{renderChildren(children, entityById, campaignSlug)}</em>,
        strong: ({ children }) => <strong>{renderChildren(children, entityById, campaignSlug)}</strong>,
        blockquote: ({ children }) => <blockquote>{renderChildren(children, entityById, campaignSlug)}</blockquote>,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
