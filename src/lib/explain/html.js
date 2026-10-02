import { S, make, unknown, blank, truncate } from './shared';

const P = S.PATTERN;

const LANDMARK = 'Screen readers list it as a landmark, so people can jump straight to it.';

const TAGS = {
  '!doctype': ['Document type', 'Declare this file as modern HTML.', 'The parser sees <!DOCTYPE html> and renders in standards mode. Without it, browsers fall back to “quirks mode”, emulating 1990s layout bugs.', 'One line that makes CSS behave consistently across browsers.'],
  html: ['Root element', 'Start the root of the document.', 'The parser creates the HTMLHtmlElement — document.documentElement — which every other node descends from. The lang attribute tells browsers, translators and screen readers which language to use.', 'Everything on the page lives inside it.'],
  head: ['Document head', 'Begin the metadata section.', 'Content here is not rendered. The parser processes metadata, links and scripts; stylesheets found here block rendering until downloaded, so the first paint is styled.', 'It configures the page before anything is shown.'],
  body: ['Document body', 'Begin the visible content.', 'Nodes inside become part of the render tree once styles are computed. The browser can start painting before the whole body has arrived.', 'Everything the user sees goes here.'],
  title: ['Page title', 'Set the text shown in the browser tab and search results.', 'Stored as document.title. It is not part of the render tree but is read by the browser UI, bookmarks and assistive technology.', 'The first thing screen reader users hear when the page loads.'],
  meta: ['Metadata', 'Provide information about the page.', 'Meta elements configure the browser rather than rendering anything.', 'They control encoding, mobile scaling and how the page is described elsewhere.'],
  link: ['External resource', 'Link to another resource.', 'For rel="stylesheet" the browser downloads the CSS in parallel but delays the first paint until it arrives — stylesheets are render-blocking.', 'Keeps styles in a separate, cacheable file.'],
  script: ['Script', 'Load and run JavaScript.', 'A plain <script> pauses HTML parsing while it downloads and executes. defer runs it after parsing finishes, in order; async runs it as soon as it arrives; type="module" is deferred by default.', 'Where the page’s behaviour comes from.'],
  style: ['Embedded styles', 'Add CSS directly in the page.', 'The CSS is parsed into the CSSOM immediately; it applies to the whole document.', 'Handy for small pages; larger sites use linked files.'],
  header: ['Header', 'Introductory content for the page or a section.', `A top-level <header> maps to the “banner” landmark. ${LANDMARK}`, 'Gives the page a predictable top region.'],
  nav: ['Navigation', 'A group of navigation links.', `The browser exposes it as a “navigation” landmark. ${LANDMARK}`, 'Lets keyboard and screen reader users skip directly to (or past) the menu.'],
  main: ['Main content', 'The primary content of the page.', `Exposed as the “main” landmark. There should be one visible <main> per page. ${LANDMARK}`, 'Lets “skip to content” links and assistive tech find the heart of the page.'],
  section: ['Section', 'A thematic group of content, usually with a heading.', 'With an accessible name (for example from a heading via aria-labelledby) it becomes a “region” landmark.', 'Splits long content into meaningful parts.'],
  article: ['Article', 'Self-contained content that would make sense on its own.', 'Exposed to assistive technology as an article; feed readers and search engines can treat it as a standalone item.', 'Ideal for posts, cards, comments and products.'],
  aside: ['Aside', 'Content related to, but separate from, the main content.', 'Exposed as the “complementary” landmark.', 'Sidebars, call-outs and related links.'],
  footer: ['Footer', 'Closing information for the page or a section.', 'A page-level <footer> maps to the “contentinfo” landmark.', 'Where copyright, contact and secondary links go.'],
  h1: ['Main heading', 'The top-level heading of the page.', 'Headings build the document outline. Screen reader users navigate by heading level, and search engines weigh heading text.', 'One clear h1 tells everyone what the page is about.'],
  h2: ['Section heading', 'A second-level heading.', 'Adds an entry to the document outline under the h1.', 'Headings should describe structure, not just make text big.'],
  h3: ['Sub-heading', 'A third-level heading.', 'Nested under the nearest h2 in the outline.', 'Do not skip levels for styling — use CSS instead.'],
  p: ['Paragraph', 'A paragraph of text.', 'The parser creates an HTMLParagraphElement with a text node child. Browsers give it block display and vertical margins by default.', 'Marks text as prose so it is read and styled correctly.'],
  a: ['Link', 'A hyperlink.', 'With an href, the element is focusable, keyboard-activatable and announced as a link. Clicking makes the browser navigate (or scroll, for #fragments).', 'Use <a> for navigation and <button> for actions.'],
  img: ['Image', 'Embed an image.', 'The browser starts downloading the src as soon as the tag is parsed (unless loading="lazy"). alt text is what screen readers announce and what shows if the image fails. Without width and height the layout shifts when the image arrives.', 'Images need alt text that describes their purpose.'],
  button: ['Button', 'A clickable control.', 'Buttons are focusable and respond to Enter and Space without extra code. Inside a <form>, the default type is "submit"; use type="button" for other actions.', 'The accessible, keyboard-friendly way to trigger actions.'],
  form: ['Form', 'A group of inputs that is submitted together.', 'On submit, the browser validates required fields, collects named inputs and sends them to the action URL — unless JavaScript calls event.preventDefault().', 'Built-in validation and submission for free.'],
  input: ['Input', 'A form field.', 'The type attribute changes behaviour: email and url validate formats, number shows steppers, and mobile keyboards adapt. Its value is read through the name attribute on submit.', 'Every input needs a label so its purpose is announced.'],
  label: ['Label', 'Text that names a form control.', 'Linking it with for="id" (or wrapping the input) makes clicking the label focus the field and gives the input its accessible name.', 'Bigger click targets and screen reader names.'],
  textarea: ['Multi-line text field', 'A field for longer text.', 'Its initial text is its content; its live value is read through .value.', 'For comments, messages and notes.'],
  select: ['Dropdown', 'A list of options.', 'The browser renders a native control that works with keyboard and screen readers out of the box.', 'A familiar way to choose one of many.'],
  ul: ['Unordered list', 'A list where order does not matter.', 'Screen readers announce “list, N items”, so users know how much is coming.', 'Menus, features, tags.'],
  ol: ['Ordered list', 'A list where order matters.', 'Items are numbered automatically, and the count is announced.', 'Steps and rankings.'],
  li: ['List item', 'One item in a list.', 'Must be a direct child of ul or ol to be announced as part of the list.', 'Each item is a separate node in the tree.'],
  div: ['Generic container', 'A container with no meaning of its own.', 'The browser creates a block box. Assistive technology ignores it — it adds nothing to the page’s semantics.', 'Use it for layout and styling hooks when no semantic element fits.'],
  span: ['Inline container', 'A generic inline wrapper.', 'Creates an inline box with no semantics.', 'For styling a run of text.'],
  time: ['Time', 'A date or time.', 'The datetime attribute gives machines an unambiguous value while the text stays human-friendly.', 'Search engines and calendars can read it.'],
  figure: ['Figure', 'Self-contained media, optionally captioned.', 'Groups an image, chart or code sample with its <figcaption>.', 'Associates the caption with the media.'],
  table: ['Table', 'Tabular data.', 'Screen readers announce rows and columns and read header cells as context for each value.', 'Only for data, not for layout.'],
  video: ['Video', 'Embed a video.', 'With preload="metadata" the browser fetches only duration and dimensions until play is pressed.', 'Native controls are keyboard-accessible.'],
  strong: ['Strong importance', 'Mark text as important.', 'Rendered bold by default; some screen readers change emphasis.', 'Meaning, not just weight.'],
  em: ['Emphasis', 'Stress emphasis.', 'Rendered italic by default.', 'Changes the meaning of a sentence.']
};

const ATTRS = [
  [/\sid=/, 'id', 'Unique per page; lets CSS and getElementById target it, and lets links jump to it.'],
  [/\sclass=/, 'class', 'A hook for CSS rules and JavaScript selectors. Can be shared by many elements.'],
  [/\shref=/, 'href', 'Where the link goes.'],
  [/\ssrc=/, 'src', 'The resource the browser downloads.'],
  [/\salt=/, 'alt', 'Read aloud by screen readers and shown if the image fails to load.'],
  [/\stype=/, 'type', 'Changes the element’s behaviour (button vs submit, input formats).'],
  [/\sfor=/, 'for', 'Connects a label to the input with that id.'],
  [/\saria-[\w-]+=/, 'aria-*', 'Adds accessibility information the element cannot express itself.'],
  [/\sdata-[\w-]+=/, 'data-*', 'Custom data readable from JavaScript via element.dataset.'],
  [/\slang=/, 'lang', 'Sets the language for pronunciation, hyphenation and translation.'],
  [/\sdatetime=/, 'datetime', 'A machine-readable date.'],
  [/\sloading=["']?lazy/, 'loading="lazy"', 'Defers downloading until the element is near the viewport.'],
  [/\s(defer|async)\b/, 'defer / async', 'Stops the script from blocking HTML parsing.'],
  [/\son\w+=/, 'inline handler', 'Works, but mixes behaviour into markup. addEventListener keeps them separate.'],
  [/\srequired\b/, 'required', 'The browser blocks form submission until it has a value.']
];

const metaKind = (line) => {
  if (/charset/i.test(line)) return { title: 'Character encoding', says: 'Tell the browser the bytes of this file are UTF-8.', runtime: 'The parser must know the encoding to turn bytes into characters. It should appear in the first 1024 bytes, before any text, or the browser may guess and re-parse.' };
  if (/viewport/i.test(line)) return { title: 'Viewport settings', says: 'Make the layout width match the device width.', runtime: 'Without this, mobile browsers lay the page out at about 980px wide and shrink it to fit, so text is tiny and media queries never trigger.' };
  if (/description/i.test(line)) return { title: 'Page description', says: 'Provide a summary for search results and link previews.', runtime: 'Not rendered. Search engines may show it under the title in results.' };
  return null;
};

export const explainHtml = (line) => {
  if (!line) return blank();
  if (/^<!--/.test(line)) {
    return make(S.STRUCTURE, {
      title: 'HTML comment',
      says: `A note in the markup: “${truncate(line.replace(/<!--|-->/g, '').trim(), 80)}”`,
      runtime: 'The parser creates a Comment node in the DOM, but it is never rendered.',
      why: 'Labels sections of markup for other developers.',
      next: 'Parsing continues.'
    });
  }

  const m = line.match(/^<\s*(\/)?\s*(!doctype|[a-zA-Z][\w-]*)/i);
  if (!m) {
    return make(P, {
      title: 'Text content',
      says: `The text “${truncate(line, 60)}”.`,
      runtime: 'The parser creates a text node and appends it to the element currently open. Runs of whitespace are collapsed to a single space when rendered.',
      why: 'The actual words the user reads.',
      next: 'Parsing continues with the next token.'
    });
  }

  const closing = Boolean(m[1]);
  const tag = m[2].toLowerCase();
  const info = TAGS[tag] || (/^h[4-6]$/.test(tag) ? TAGS.h3 : null);

  if (closing) {
    return make(S.STRUCTURE, {
      title: `Closing </${tag}>`,
      says: `End the <${tag}> element.`,
      runtime: `The parser pops <${tag}> off its stack of open elements. Anything that follows becomes a sibling instead of a child.`,
      why: 'Closing tags define where an element’s content ends.',
      next: 'Parsing continues with the parent element.'
    });
  }

  if (!info) {
    if (tag.includes('-')) {
      return make(P, {
        title: `Custom element <${tag}>`,
        says: `Use the custom element ${tag}.`,
        runtime: 'Names with a hyphen are reserved for custom elements. Until JavaScript defines it with customElements.define, the browser treats it as an unknown inline element.',
        why: 'Web components package markup and behaviour together.',
        next: 'Once defined, the browser upgrades every instance.'
      });
    }
    return unknown('HTML');
  }

  const meta = tag === 'meta' ? metaKind(line) : null;
  const sameLineClose = new RegExp(`</${tag}>\\s*$`, 'i').test(line);
  const text = sameLineClose ? line.replace(/<[^>]+>/g, '').trim() : '';
  const tags = ATTRS.filter(([re]) => re.test(line)).map(([, label, note]) => ({ label, note }));

  const missingAlt = tag === 'img' && !/\salt=/.test(line);

  return make(P, {
    title: meta?.title || `<${tag}> — ${info[0]}`,
    says: meta?.says || `${info[1]}${text ? ` Text: “${truncate(text, 50)}”.` : ''}`,
    runtime: meta?.runtime || `${tag === '!doctype' ? '' : `The parser creates a <${tag}> element node and attaches it to the DOM under the element currently open. `}${info[2]}`,
    why: info[3],
    next: sameLineClose ? 'The element opens and closes on this line; the next line is a sibling.' : /\/>\s*$|^<(img|input|meta|link|br|hr)\b/i.test(line) ? 'This is a void element — it has no closing tag or children.' : 'The lines that follow become its children until the matching closing tag.',
    warning: missingAlt
      ? 'This image has no alt attribute. Screen readers will announce the file name instead. Use alt="" if it is purely decorative.'
      : null,
    tags
  });
};
