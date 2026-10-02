export const frontend = {
  id: 'frontend-development',
  title: 'Frontend Development',
  subtitle: 'Build Modern Web Experiences',
  category: 'Frontend',
  level: 'Beginner → Intermediate',
  hours: 36,
  price: 7999, // INR
  skills: ['HTML', 'CSS', 'JavaScript', 'React', 'Accessibility', 'Performance'],
  summary:
    'Build fast, accessible, responsive interfaces — from semantic HTML and modern CSS to React components you can ship.',
  description:
    'Frontend work is about what people actually touch. You learn how the browser parses, lays out and paints a page, then use that understanding to write responsive CSS, interactive JavaScript and component-based React that stays accessible and fast.',
  outcomes: [
    'Structure pages with semantic, accessible HTML.',
    'Build responsive layouts with Flexbox, Grid and fluid sizing.',
    'Manipulate the DOM and use browser APIs without a framework.',
    'Design React components with clear state and props.',
    'Measure and improve loading and interaction performance, then deploy.'
  ],
  audience: [
    'Beginners who want to build interfaces people enjoy using.',
    'Designers who want to implement their own work.',
    'Developers who use frameworks but want to understand the browser beneath them.'
  ],
  projects: [
    { title: 'Responsive landing page', description: 'Fluid type, CSS Grid and a mobile navigation that works with a keyboard.' },
    { title: 'Product filter interface', description: 'Search, filter and sort in vanilla JavaScript with accessible controls.' },
    { title: 'React dashboard', description: 'Componentised UI with data fetching, loading states and a Lighthouse audit.' }
  ],
  sandbox: {
    mode: 'web',
    prompt: 'Free practice space. Run your code and move the cursor through it to see what the browser does.',
    files: [
      { id: 'html', name: 'index.html', language: 'html', code: '<main class="stack">\n  <h1>Scratchpad</h1>\n</main>' },
      { id: 'css', name: 'style.css', language: 'css', code: '.stack {\n  display: grid;\n  gap: 1rem;\n  padding: 1.5rem;\n  font-family: system-ui, sans-serif;\n}' },
      { id: 'js', name: 'script.js', language: 'javascript', code: 'console.log("ready");' }
    ]
  },
  modules: [
    {
      id: 'fe-m1',
      title: 'HTML, CSS and responsive design',
      lessons: [
        {
          id: 'fe-01',
          title: 'Semantic HTML and accessibility basics',
          duration: '18 min',
          preview: true,
          summary: 'Pick elements for meaning so browsers, search engines and screen readers understand your page.',
          workspace: {
            mode: 'web',
            prompt: 'Add a <nav> inside the header with two links.',
            check: { file: 'html', pattern: /<nav[\s>][\s\S]*?<a[\s\S]*?<\/nav>/i, success: 'Assistive technology now exposes a navigation landmark for your links.' },
            files: [
              { id: 'html', name: 'index.html', language: 'html', code: '<header>\n  <a href="/">Studio</a>\n</header>\n<main>\n  <h1>Our work</h1>\n  <img src="" alt="Sketch of the homepage layout">\n  <button type="button">Show more</button>\n</main>' },
              { id: 'css', name: 'style.css', language: 'css', code: 'body {\n  font-family: system-ui, sans-serif;\n  padding: 1rem;\n}\nnav a {\n  margin-right: 1rem;\n}' },
              { id: 'js', name: 'script.js', language: 'javascript', code: '// Structure only in this lesson' }
            ]
          }
        },
        {
          id: 'fe-02',
          title: 'Layout with Flexbox and Grid',
          duration: '26 min',
          summary: 'One-dimensional and two-dimensional layout, and responsive grids without media queries.',
          workspace: {
            mode: 'web',
            prompt: 'Turn .cards into a responsive grid using repeat(auto-fit, minmax(...)).',
            check: { file: 'css', pattern: /grid-template-columns\s*:\s*repeat\(\s*auto-(fit|fill)/i, success: 'The grid now creates as many columns as fit and stretches them to fill the row.' },
            files: [
              { id: 'html', name: 'index.html', language: 'html', code: '<section class="cards">\n  <article>Speed</article>\n  <article>Clarity</article>\n  <article>Resilience</article>\n  <article>Access</article>\n</section>' },
              { id: 'css', name: 'style.css', language: 'css', code: '.cards {\n  display: grid;\n  grid-template-columns: 1fr;\n  gap: 1rem;\n  font-family: system-ui, sans-serif;\n}\n\n.cards article {\n  padding: 1.25rem;\n  border: 1px solid #ddd;\n  border-radius: 6px;\n}' },
              { id: 'js', name: 'script.js', language: 'javascript', code: '' }
            ]
          }
        },
        {
          id: 'fe-03',
          title: 'Responsive design and fluid typography',
          duration: '20 min',
          summary: 'Mobile-first CSS, clamp(), container queries and images that adapt to the screen.'
        }
      ]
    },
    {
      id: 'fe-m2',
      title: 'JavaScript in the browser',
      lessons: [
        {
          id: 'fe-04',
          title: 'The DOM and browser events',
          duration: '24 min',
          summary: 'Query, create and update elements, and use event delegation for dynamic lists.',
          workspace: {
            mode: 'web',
            prompt: 'Use one listener on the list to remove whichever item was clicked.',
            check: { file: 'js', pattern: /\.closest\s*\(/, success: 'One listener now handles every item, including ones added later — that is event delegation.' },
            files: [
              { id: 'html', name: 'index.html', language: 'html', code: '<ul id="list">\n  <li>Buy milk <button>×</button></li>\n  <li>Call Sam <button>×</button></li>\n  <li>Book flights <button>×</button></li>\n</ul>' },
              { id: 'css', name: 'style.css', language: 'css', code: 'body {\n  font-family: system-ui, sans-serif;\n  padding: 1rem;\n}\nli {\n  margin-bottom: 0.5rem;\n}' },
              { id: 'js', name: 'script.js', language: 'javascript', code: 'const list = document.querySelector("#list");\n\nlist.addEventListener("click", (event) => {\n  // Find the button that was clicked (hint: closest on event.target),\n  // ignore clicks elsewhere, then remove its parent <li>.\n  console.log("Clicked:", event.target.tagName);\n});' }
            ]
          }
        },
        {
          id: 'fe-05',
          title: 'Browser APIs: storage, fetch and observers',
          duration: '22 min',
          summary: 'Persist data locally, request data from servers and react to elements entering the viewport.'
        }
      ]
    },
    {
      id: 'fe-m3',
      title: 'Components, performance and shipping',
      lessons: [
        {
          id: 'fe-06',
          title: 'Component architecture with React',
          duration: '28 min',
          summary: 'Break interfaces into components and decide where each piece of state should live.'
        },
        {
          id: 'fe-07',
          title: 'Performance: what makes pages feel fast',
          duration: '20 min',
          summary: 'Core Web Vitals, critical rendering path, lazy loading and avoiding layout shifts.'
        },
        {
          id: 'fe-08',
          title: 'Building and deploying a frontend',
          duration: '16 min',
          summary: 'Bundling, environment configuration and publishing to a static host with a custom domain.'
        }
      ]
    }
  ]
};
