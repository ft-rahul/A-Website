export const javascript = {
  id: 'javascript-in-depth',
  title: 'JavaScript in Depth',
  subtitle: 'How the Language Really Works',
  category: 'Languages',
  level: 'Beginner → Intermediate',
  hours: 24,
  price: 6499, // INR
  skills: ['JavaScript', 'Async', 'DOM'],
  summary:
    'Scope, closures, objects, the event loop and async code — explained by what the engine actually does.',
  description:
    'Most JavaScript confusion comes from not knowing what the engine is doing. This course explains execution contexts, scope, closures, prototypes and the event loop, then applies them to the asynchronous code you write every day.',
  outcomes: [
    'Predict how variables are scoped and when they exist.',
    'Use closures deliberately instead of by accident.',
    'Explain prototypes, classes and how this is bound.',
    'Describe the call stack, task queue and microtask queue.',
    'Write async code with Promises and async/await that handles failure.'
  ],
  audience: [
    'Developers who can write JavaScript but cannot always explain why it works.',
    'Learners preparing for technical interviews.',
    'Anyone moving on to React or Node.js who wants solid foundations.'
  ],
  projects: [
    { title: 'Event loop visualiser', description: 'Log and explain the order of sync code, timers and promises.' },
    { title: 'Search with debounce', description: 'Closures, timers and fetch combined into a responsive search box.' }
  ],
  sandbox: {
    mode: 'web',
    prompt: 'Free practice space for JavaScript. Output appears in the console.',
    files: [
      { id: 'html', name: 'index.html', language: 'html', code: '<p>Open the console below.</p>' },
      { id: 'css', name: 'style.css', language: 'css', code: 'body { font-family: system-ui, sans-serif; padding: 1rem; }' },
      { id: 'js', name: 'script.js', language: 'javascript', code: 'const greet = (name) => `Hello, ${name}`;\nconsole.log(greet("Monklogy"));' }
    ]
  },
  modules: [
    {
      id: 'js-m1',
      title: 'The engine and the event loop',
      lessons: [
        {
          id: 'js-01',
          title: 'Async/await: what actually pauses',
          duration: '18 min',
          preview: true,
          summary: 'Run code that waits for data and see why the rest of the page keeps working while it waits.',
          notes: '## What pauses\n\n- `await` pauses the async function it is in — nothing else.\n- The rest of that function resumes as a microtask once the Promise settles.',
          workspace: {
            mode: 'web',
            prompt: 'Run the code. Then put your cursor on each line, starting with the await, and compare the explanation with the console order.',
            check: { file: 'js', pattern: /await\s+fetchUser\s*\(/, success: 'Notice the console: "Still responsive" printed before the user — await paused only loadProfile.' },
            annotations: {
              'const user = await fetchUser();': {
                title: 'Pausing one function until a Promise settles',
                says: 'Call fetchUser(), wait for the Promise it returns, and store the resolved value in a constant named user.',
                runtime: 'fetchUser() starts immediately and hands back a pending Promise. await suspends loadProfile right here and returns control to the event loop — the call stack empties, so the console.log at the bottom runs and the page stays interactive. When the Promise resolves, the engine queues the rest of loadProfile as a microtask and resumes on the next line with user set to the resolved object.',
                why: 'Waiting on a network or timer would freeze the page if JavaScript blocked. await keeps the code readable top-to-bottom while letting everything else continue.',
                next: 'On success, user is { name: "Grace" } and the next line writes it to the page. On rejection, the error is thrown at this line and control jumps to catch.',
                analogy: 'Like putting a bookmark in a book while the kettle boils: you do other things, then reopen at exactly the same page.'
              }
            },
            files: [
              { id: 'html', name: 'index.html', language: 'html', code: '<h2 id="who">…</h2>' },
              { id: 'css', name: 'style.css', language: 'css', code: 'body {\n  font-family: system-ui, sans-serif;\n  padding: 1rem;\n}' },
              { id: 'js', name: 'script.js', language: 'javascript', code: 'function fetchUser() {\n  return new Promise((resolve) => {\n    setTimeout(() => resolve({ name: "Grace" }), 500);\n  });\n}\n\nasync function loadProfile() {\n  try {\n    const user = await fetchUser();\n    document.getElementById("who").textContent = user.name;\n    console.log("Loaded", user.name);\n  } catch (error) {\n    console.error(error);\n  }\n}\n\nloadProfile();\nconsole.log("Still responsive");' }
            ]
          }
        },
        {
          id: 'js-02',
          title: 'Scope, hoisting and closures',
          duration: '22 min',
          summary: 'Where variables live, when they exist, and how functions remember the scope they were created in.',
          workspace: {
            mode: 'web',
            prompt: 'Create a counter with a closure: makeCounter should return a function that increments a private variable.',
            check: { file: 'js', pattern: /return\s*\(\s*\)\s*=>|return\s+function/, success: 'The returned function keeps a reference to count even after makeCounter has finished — that is a closure.' },
            files: [
              { id: 'html', name: 'index.html', language: 'html', code: '<p>See the console.</p>' },
              { id: 'css', name: 'style.css', language: 'css', code: 'body { font-family: system-ui, sans-serif; padding: 1rem; }' },
              { id: 'js', name: 'script.js', language: 'javascript', code: 'function makeCounter() {\n  let count = 0;\n  // Return a function that adds one to count and returns it\n}\n\nconst next = makeCounter();\nconsole.log(typeof next);' }
            ]
          }
        },
        {
          id: 'js-03',
          title: 'The call stack, tasks and microtasks',
          duration: '20 min',
          summary: 'Why a resolved Promise runs before a zero-millisecond timer.'
        }
      ]
    },
    {
      id: 'js-m2',
      title: 'Objects and data',
      lessons: [
        {
          id: 'js-04',
          title: 'Objects, prototypes and classes',
          duration: '22 min',
          summary: 'What class syntax compiles to and how property lookup walks the prototype chain.'
        },
        {
          id: 'js-05',
          title: 'Working with arrays: map, filter and reduce',
          duration: '18 min',
          summary: 'Transform data without loops you have to trace by hand.',
          workspace: {
            mode: 'web',
            prompt: 'Compute the total price of items in stock using filter and reduce.',
            check: { file: 'js', pattern: /\.reduce\s*\(/, success: 'reduce walked the filtered array once and folded it into a single number.' },
            files: [
              { id: 'html', name: 'index.html', language: 'html', code: '<p id="total"></p>' },
              { id: 'css', name: 'style.css', language: 'css', code: 'body { font-family: system-ui, sans-serif; padding: 1rem; }' },
              { id: 'js', name: 'script.js', language: 'javascript', code: 'const items = [\n  { name: "Keyboard", price: 80, inStock: true },\n  { name: "Mouse", price: 30, inStock: false },\n  { name: "Monitor", price: 220, inStock: true }\n];\n\n// Keep only items in stock, then add up their prices\nconst inStock = items.filter((item) => item.inStock);\nconst total = 0;\n\ndocument.getElementById("total").textContent = `Total: $${total}`;\nconsole.log(total);' }
            ]
          }
        },
        {
          id: 'js-06',
          title: 'Errors and defensive code',
          duration: '16 min',
          summary: 'throw, try/catch, custom errors and failing loudly in the right place.'
        }
      ]
    }
  ]
};
