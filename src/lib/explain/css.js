import { S, make, unknown, blank, findOpener, truncate } from './shared';

const P = S.PATTERN;

// phase: which part of the rendering pipeline a change to this property triggers.
const LAYOUT = 'layout';
const PAINT = 'paint';
const COMPOSITE = 'composite';

const PROPS = {
  display: ['Choose how the element generates boxes and lays out its children.', LAYOUT],
  position: ['Choose the positioning scheme: static, relative, absolute, fixed or sticky.', LAYOUT],
  top: ['Offset a positioned element from the top of its containing block.', LAYOUT],
  left: ['Offset a positioned element from the left of its containing block.', LAYOUT],
  right: ['Offset a positioned element from the right.', LAYOUT],
  bottom: ['Offset a positioned element from the bottom.', LAYOUT],
  'z-index': ['Set stacking order among positioned elements in the same stacking context.', COMPOSITE],
  width: ['Set the width of the content box (or border box with box-sizing: border-box).', LAYOUT],
  height: ['Set the height of the box.', LAYOUT],
  'max-width': ['Cap how wide the box can grow.', LAYOUT],
  'min-height': ['Guarantee a minimum height.', LAYOUT],
  margin: ['Add space outside the border. Vertical margins between blocks can collapse into one.', LAYOUT],
  'margin-bottom': ['Add space below the element.', LAYOUT],
  'margin-left': ['Add space to the left of the element.', LAYOUT],
  'margin-right': ['Add space to the right of the element.', LAYOUT],
  'margin-top': ['Add space above the element.', LAYOUT],
  padding: ['Add space between the border and the content.', LAYOUT],
  border: ['Draw a border around the padding box.', LAYOUT],
  'border-bottom': ['Draw a border along the bottom edge.', LAYOUT],
  'border-radius': ['Round the corners of the border box.', PAINT],
  'box-sizing': ['Choose whether width includes padding and border.', LAYOUT],
  gap: ['Space between flex or grid items, without margins on the items themselves.', LAYOUT],
  'flex-direction': ['Set the main axis of a flex container: row or column.', LAYOUT],
  'flex-wrap': ['Allow flex items to wrap onto new lines.', LAYOUT],
  flex: ['Set how a flex item grows, shrinks and its base size.', LAYOUT],
  'justify-content': ['Distribute free space along the main axis.', LAYOUT],
  'align-items': ['Align items along the cross axis.', LAYOUT],
  'grid-template-columns': ['Define the column tracks of a grid.', LAYOUT],
  'grid-template-rows': ['Define the row tracks of a grid.', LAYOUT],
  'grid-column': ['Place an item across grid columns.', LAYOUT],
  'font-family': ['Choose the typeface, with fallbacks in order.', LAYOUT],
  'font-size': ['Set the size of text.', LAYOUT],
  'font-weight': ['Set the thickness of text.', LAYOUT],
  'line-height': ['Set the height of each line box.', LAYOUT],
  'text-align': ['Align inline content within the box.', LAYOUT],
  'letter-spacing': ['Adjust space between characters.', LAYOUT],
  color: ['Set the text colour (and the default for currentColor).', PAINT],
  background: ['Paint the background colour or image behind the content.', PAINT],
  'background-color': ['Paint a solid background colour.', PAINT],
  'box-shadow': ['Paint a shadow around the box without affecting layout.', PAINT],
  opacity: ['Make the element and its children translucent.', COMPOSITE],
  transform: ['Move, scale or rotate the element visually without affecting layout.', COMPOSITE],
  transition: ['Animate changes to other properties over time.', null],
  animation: ['Run a @keyframes animation.', null],
  cursor: ['Set the mouse pointer shown over the element.', null],
  overflow: ['Decide what happens to content that does not fit.', LAYOUT],
  'text-decoration': ['Underline, overline or strike through text.', PAINT],
  'list-style': ['Set the marker style of list items.', LAYOUT],
  'object-fit': ['Choose how an image or video fills its box.', PAINT],
  'aspect-ratio': ['Keep a preferred width-to-height ratio.', LAYOUT],
  outline: ['Draw a line outside the border that does not take up space.', PAINT]
};

const PHASE_TEXT = {
  [LAYOUT]: 'Changing it later forces the browser to recalculate layout (geometry) for this element and possibly its neighbours, then repaint — the most expensive kind of update.',
  [PAINT]: 'Changing it later skips layout but requires repainting the affected pixels.',
  [COMPOSITE]: 'Changing it later can be handled by the compositor (often on the GPU) without layout or paint — ideal for animation.'
};

/** Specificity as (ids, classes/attributes/pseudo-classes, elements/pseudo-elements). */
export const specificity = (selector) => {
  const s = selector.replace(/:not\(([^)]*)\)/g, ' $1 ').replace(/::?(where)\([^)]*\)/g, '');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+(\([^)]*\))?/g) || []).length;
  const elements = (s.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+(\([^)]*\))?/g, ' ').match(/(^|[\s>+~])([a-zA-Z][\w-]*)|::[\w-]+/g) || []).length;
  return [ids, classes, elements];
};

const describeSelector = (sel) => {
  const parts = [];
  if (/\s+(?![>+~])/.test(sel.trim()) && !/,/.test(sel)) parts.push('a descendant combinator (space) matches elements nested at any depth');
  if (/>/.test(sel)) parts.push('> matches direct children only');
  if (/:hover|:focus|:active/.test(sel)) parts.push('a state pseudo-class re-evaluated as the user interacts');
  if (/::(before|after)/.test(sel)) parts.push('a pseudo-element that generates a box not present in the HTML');
  if (/,/.test(sel)) parts.push('commas list several selectors that share the same declarations');
  return parts;
};

export const explainCss = (line, ctx) => {
  if (!line) return blank();
  if (/^\/\*/.test(line) || /^\*/.test(line)) {
    return make(S.STRUCTURE, {
      title: 'CSS comment',
      says: `A note: “${truncate(line.replace(/\/\*|\*\//g, '').trim(), 80)}”`,
      runtime: 'Ignored by the CSS parser.',
      why: 'Explains intent for other developers.',
      next: 'Parsing continues.'
    });
  }
  if (/^\}/.test(line)) {
    const opener = findOpener(ctx.lines, ctx.lineIndex);
    return make(S.STRUCTURE, {
      title: 'End of rule',
      says: opener ? `Closes the rule for ${truncate(opener.text.replace(/\{\s*$/, '').trim(), 40)} (line ${opener.index + 1}).` : 'Closes a rule.',
      runtime: 'The parser adds the completed rule to the CSSOM. Rules are matched against elements during style calculation.',
      why: 'Braces group declarations under one selector.',
      next: 'The next rule starts.'
    });
  }

  const at = line.match(/^@([\w-]+)\s*(.*?)\s*\{?$/);
  if (at) {
    const name = at[1];
    const map = {
      media: ['Media query', `Apply the rules inside only when ${at[2] || 'the condition'} matches.`, 'The browser re-evaluates media queries when the viewport changes and enables or disables the rules inside without reloading.', 'Adapting layouts to different screen sizes and user preferences.'],
      container: ['Container query', `Apply the rules inside when the nearest container matches ${at[2]}.`, 'Unlike media queries, the condition is checked against an ancestor’s size, so a component adapts to wherever it is placed.', 'Truly reusable components.'],
      keyframes: ['Keyframes', `Define an animation called ${at[2]}.`, 'Stores named keyframes; nothing animates until an animation property references it.', 'Multi-step animations.'],
      import: ['Import', 'Pull in another stylesheet.', '@import is fetched only after this sheet is parsed, so it creates a request chain and delays rendering.', 'Prefer <link> tags or a bundler.'],
      'font-face': ['Web font', 'Define a downloadable font.', 'The font file is fetched only when an element actually uses it.', 'Custom typography.'],
      supports: ['Feature query', `Apply rules only if the browser supports ${at[2]}.`, 'Checked once by the CSS engine.', 'Progressive enhancement.']
    };
    const info = map[name];
    if (info) return make(P, { title: info[0], says: info[1], runtime: info[2], why: info[3], next: 'The rules inside follow until the closing brace.' });
  }

  // One-line rule: selector { a: b; c: d; }
  const oneLine = line.match(/^([^{]+)\{(.+)\}\s*$/);
  if (oneLine) {
    const sel = oneLine[1].trim();
    const props = oneLine[2].split(';').map((d) => d.split(':')[0].trim()).filter(Boolean);
    const [a, b, c] = specificity(sel.split(',')[0]);
    return make(P, {
      title: `Rule for ${truncate(sel, 30)}`,
      says: `Apply ${props.length} declaration${props.length === 1 ? '' : 's'} (${props.join(', ')}) to elements matching ${sel}.`,
      runtime: `The rule is added to the CSSOM. During style calculation the browser matches ${sel} (specificity ${a},${b},${c}) and computes each property. ${props.some((p) => PROPS[p]?.[1] === LAYOUT) ? 'Some of these properties affect geometry, so they take part in layout.' : 'None of these affect geometry.'}`,
      why: 'A compact way to write a short rule.',
      next: 'Split it across lines to see each declaration explained on its own.'
    });
  }

  // Selector line
  if (/\{\s*$/.test(line)) {
    const sel = line.replace(/\{\s*$/, '').trim();
    const [a, b, c] = specificity(sel.split(',')[0]);
    const notes = describeSelector(sel);
    return make(P, {
      title: `Selector: ${truncate(sel, 40)}`,
      says: `Apply the following declarations to elements matching ${sel}.`,
      runtime: `Browsers match selectors right to left — they find candidates for the rightmost part first, then check ancestors. Specificity of ${sel.split(',')[0].trim()} is (${a}, ${b}, ${c}): ids, then classes/attributes/pseudo-classes, then elements. When two rules set the same property, higher specificity wins; on a tie, the later rule wins.${notes.length ? ` Here, ${notes.join('; ')}.` : ''}`,
      why: 'Selectors connect styles to the HTML without changing the HTML.',
      next: 'Each declaration inside is applied to every matching element.'
    });
  }

  // Declaration
  const d = line.match(/^(--[\w-]+|[a-z-]+)\s*:\s*(.+?);?$/i);
  if (d) {
    const [, prop, value] = d;
    if (prop.startsWith('--')) {
      return make(P, {
        title: `Custom property ${prop}`,
        says: `Define a variable ${prop} with the value ${truncate(value, 40)}.`,
        runtime: 'Custom properties inherit like normal properties. Wherever var(' + prop + ') is used, the browser substitutes the value at computed-value time — so changing it (for example in a dark theme) updates every use.',
        why: 'One source of truth for colours, spacing and other design tokens.',
        next: `Use it with var(${prop}).`
      });
    }
    const info = PROPS[prop.toLowerCase()];
    const tags = [];
    if (/var\(/.test(value)) tags.push({ label: 'var()', note: 'Substitutes the value of a custom property, inherited from the nearest ancestor that defines it.' });
    if (/clamp\(/.test(value)) tags.push({ label: 'clamp()', note: 'clamp(min, preferred, max) — fluid between two limits.' });
    if (/calc\(/.test(value)) tags.push({ label: 'calc()', note: 'Mixes units, resolved by the browser at layout time.' });
    if (/\d+(\.\d+)?rem\b/.test(value)) tags.push({ label: 'rem', note: 'Relative to the root font size, so it respects the user’s browser text settings.' });
    if (/\d+(\.\d+)?fr\b/.test(value)) tags.push({ label: 'fr', note: 'A fraction of the free space in a grid container.' });
    if (/auto-(fit|fill)/.test(value)) tags.push({ label: value.match(/auto-(fit|fill)/)[0], note: 'Creates as many tracks as fit; auto-fit collapses empty ones so items stretch.' });
    if (/minmax\(/.test(value)) tags.push({ label: 'minmax()', note: 'A track is never smaller than the first value or larger than the second.' });
    if (/!important/.test(value)) tags.push({ label: '!important', note: 'Overrides normal specificity. Use sparingly — it makes later overrides hard.' });

    const special = {
      'display:flex': 'Turns the element into a flex container. Its direct children become flex items laid out along one axis (a row by default).',
      'display:grid': 'Turns the element into a grid container. Its direct children are placed into rows and columns you define.',
      'display:none': 'Removes the element from the render tree entirely: it takes no space and is hidden from screen readers.',
      'position:sticky': 'The element scrolls normally until it reaches its offset, then sticks within its parent.',
      'position:absolute': 'Removes the element from normal flow and positions it relative to the nearest positioned ancestor.'
    }[`${prop}:${value.trim().split(/\s/)[0]}`];

    if (!info) return unknown('CSS');
    return make(P, {
      title: `${prop}: ${truncate(value, 30)}`,
      says: `${info[0]} Value: ${value}.`,
      runtime: `${special ? `${special} ` : ''}The value is cascaded with other matching rules, then computed (relative units resolved to pixels where possible).${info[1] ? ` ${PHASE_TEXT[info[1]]}` : prop === 'transition' ? ' Transitions animate between the old and new computed values whenever they change.' : ''}`,
      why: info[1] === COMPOSITE ? 'Cheap to change, which is why it is the preferred property for animation.' : 'Part of how this element is sized, positioned or painted.',
      next: 'The next declaration in the rule is applied after this one; if the same property appears twice, the later one wins.',
      tags
    });
  }

  return unknown('CSS');
};
