import React from 'react';

export const characterFields = [
  ['affiliation', '所屬'], ['species', '種族'], ['rank', '袍級'],
  ['abilities', '能力'], ['equipment', '裝備'], ['appearance', '首次登場'],
  ['reveal', '揭露條件'],
];

export function keywordTags(value) {
  const tags = Array.isArray(value) ? value : (value || '').split(/[,，、\n]+|\s+(?=#)/);
  return [...new Set(tags.map(tag => tag.trim().replace(/^#+/, '').trim()).filter(Boolean))];
}

export function enabledCharacterFields(work) {
  const enabled = work?.characterFields;
  return characterFields.filter(([key]) => Array.isArray(enabled)
    ? enabled.includes(key)
    : work?.items?.some(item => item.category === '角色資料' && item.profile?.[key]?.trim()));
}

export function itemMatches(item, query) {
  const text = [item.title, item.content, ...keywordTags(item.keywords).flatMap(tag=>[tag, '#'+tag]), item.group, ...Object.values(item.profile || {})]
    .filter(value => typeof value === 'string').join(' ').normalize('NFKC').toLowerCase();
  return query.normalize('NFKC').trim().toLowerCase().split(/\s+/).every(word => text.includes(word));
}

function inlineText(text) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part,
  );
}

export function LibraryContent({ content }) {
  const blocks = [];
  for (const line of content.split(/\r?\n/)) {
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const previous = blocks.at(-1);
    if (heading) {
      blocks.push({ type: 'heading', level: Math.min(6, heading[1].length + 2), text: heading[2] });
    } else if (bullet) {
      if (previous?.type === 'list') previous.items.push(bullet[1]);
      else blocks.push({ type: 'list', items: [bullet[1]] });
    } else if (line.trim()) {
      blocks.push({ type: 'text', text: line });
    } else if (previous?.type === 'list') {
      blocks.push({ type: 'break' });
    }
  }

  return <div className="library-content">{blocks.map((block, index) => {
    if (block.type === 'heading') {
      const Heading = 'h' + block.level;
      return <Heading key={index}>{inlineText(block.text)}</Heading>;
    }
    if (block.type === 'list') {
      return <ul key={index}>{block.items.map((item, i) => <li key={i}>{inlineText(item)}</li>)}</ul>;
    }
    if (block.type === 'text') return <p key={index}>{inlineText(block.text)}</p>;
    return null;
  })}</div>;
}

export function groupCharacters(items, ungrouped) {
  const groups = new Map();
  for (const item of items) {
    const name = item.group?.trim() || item.profile?.affiliation?.trim() || ungrouped;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(item);
  }
  return [...groups];
}

export function sortChapters(items) {
  return [...items].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
}
