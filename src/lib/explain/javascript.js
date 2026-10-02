import { S, make, findOpener, enclosingBlocks, truncate, unknown, blank } from './shared';

const P = S.PATTERN;

const KEYWORD_NOTES = {
  const: 'const creates a block-scoped binding that cannot be reassigned. The value it points to can still change if it is an object or array.',
  let: 'let creates a block-scoped binding that can be reassigned. It exists from the start of the block but cannot be read before this line (the temporal dead zone).',
  var: 'var creates a function-scoped binding that is hoisted and initialised to undefined. Prefer const or let; var ignores block boundaries.'
};

// Secondary constructs shown as small chips under the main explanation.
const TAG_DETECTORS = [
  [/`[^`]*\$\{/, 'Template literal', 'Backtick strings evaluate each ${…} expression and join the results into one string.'],
  [/=>/, 'Arrow function', 'Arrow functions do not get their own this; they use the this of the surrounding code.'],
  [/\?\./, 'Optional chaining', '?. stops and returns undefined instead of throwing when the value on its left is null or undefined.'],
  [/\?\?/, 'Nullish coalescing', '?? uses the right side only when the left side is null or undefined — not for 0 or "".'],
  [/\.\.\.[\w$[{(]/, 'Spread / rest', '... copies items out of an array or object, or gathers remaining arguments into one.'],
  [/[!=]==/, 'Strict equality', '=== and !== compare without type conversion, so "1" === 1 is false.'],
  [/\s\?\s[^:]+\s:\s/, 'Ternary', 'condition ? a : b evaluates to a when the condition is truthy, otherwise b.'],
  [/\.json\(\)/, '.json()', 'Reads the response body stream to the end and parses it as JSON. It returns a Promise.'],
  [/process\.env/, 'process.env', 'Environment variables are read from the operating system when Node starts — keep secrets there, not in code.'],
  [/\breq\.(body|params|query)/, 'Request data', 'req.params comes from the URL path, req.query from ?key=value, req.body from the parsed request body.']
];

const tagsFor = (line) =>
  TAG_DETECTORS.filter(([re]) => re.test(line)).map(([, label, note]) => ({ label, note }));

const insideAsync = (lines, idx) => {
  const blocks = enclosingBlocks(lines, idx);
  const fn = blocks.find((b) => /function\b|=>/.test(b.text));
  return fn ? /\basync\b/.test(fn.text) : null; // null = top level
};

const calleeOf = (expr) => {
  const m = expr.match(/^([\w$.]+)\s*\(/);
  return m ? m[1] : null;
};


/** Split "(cond) rest" respecting nested parentheses. */
const splitCondition = (text) => {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) return { condition: text.slice(1, i).trim(), rest: text.slice(i + 1).trim() };
    }
  }
  return { condition: text.slice(1).trim(), rest: '' };
};

const describeOpener = (text) => {
  if (/\bclass\s+([\w$]+)/.test(text)) return `class ${text.match(/\bclass\s+([\w$]+)/)[1]}`;
  if (/\basync\s+function\s+([\w$]+)/.test(text)) return `async function ${text.match(/function\s+([\w$]+)/)[1]}()`;
  if (/\bfunction\s+([\w$]+)/.test(text)) return `function ${text.match(/function\s+([\w$]+)/)[1]}()`;
  if (/addEventListener/.test(text)) return 'the event listener callback';
  if (/^\s*(app|router)\.\w+\(/.test(text)) return 'the route handler';
  if (/^\s*(if|else)/.test(text)) return 'the if/else block';
  if (/^\s*(for|while)\b/.test(text)) return 'the loop body';
  if (/^\s*try\b/.test(text)) return 'the try block';
  if (/catch\s*\(/.test(text)) return 'the catch block';
  if (/new Promise/.test(text)) return 'the Promise executor';
  if (/useEffect/.test(text)) return 'the effect';
  if (/=>\s*\{$/.test(text)) return 'the arrow function body';
  if (/[=:(,]\s*\{$/.test(text) || /^\{$/.test(text)) return 'the object literal';
  if (/\[$/.test(text)) return 'the array literal';
  if (/\($/.test(text)) return 'the parenthesised expression';
  return 'the block';
};

const rules = [
  // ── Comments ───────────────────────────────────────────────
  {
    test: /^(\/\/|\/\*|\*)/,
    build: (line) =>
      make(S.STRUCTURE, {
        title: 'Comment',
        says: `A note for people reading the code: “${truncate(line.replace(/^(\/\/+|\/\*+|\*+\/?)\s?/, '').replace(/\*\/$/, ''), 80)}”`,
        runtime: 'The tokenizer drops comments before parsing. They never become bytecode and cost nothing when the program runs.',
        why: 'Comments record intent — why the code is the way it is — which the code itself cannot say.',
        next: 'Execution continues with the next statement.'
      })
  },

  // ── Conditionals (first, so guard clauses describe the whole line) ──
  {
    test: /^if\s*\(/,
    build: (line) => {
      const { condition, rest } = splitCondition(line.slice(line.indexOf('(')));
      const body = rest.replace(/^\{\s*$/, '').replace(/;$/, '').trim();
      const guard = /^return\b/.test(body);
      return make(P, {
        title: guard ? 'Guard clause' : 'Conditional',
        says: guard
          ? `If ${truncate(condition, 40)} is truthy, ${truncate(body, 60)} immediately.`
          : body
          ? `If ${truncate(condition, 40)} is truthy, run ${truncate(body, 50)}.`
          : `Run the following block only if ${truncate(condition, 50)} is truthy.`,
        runtime: 'The condition is evaluated and converted to a boolean. false, 0, "", null, undefined and NaN are falsy; everything else — including empty arrays and objects — is truthy.' + (guard ? ' When it is truthy, return ends the function right here.' : ''),
        why: guard ? 'Exiting early keeps the main path of the function flat and easy to follow.' : 'To choose between different paths at runtime.',
        next: guard ? 'If the condition is falsy, execution continues on the next line.' : 'If falsy, the block is skipped (or the else branch runs).'
      });
    }
  },
  // ── Modules ────────────────────────────────────────────────
  {
    test: /^import\s+(.+?)\s+from\s+['"](.+?)['"]/,
    build: (line, m) =>
      make(P, {
        title: `Importing from "${m[2]}"`,
        says: `Bring ${m[1]} into this file from the module "${m[2]}".`,
        runtime: 'Imports are resolved before any code in this file runs. The module loader locates the file (or package), evaluates it once, caches it, and binds the imported names as live, read-only references to its exports.',
        why: 'Modules keep code in separate files with explicit dependencies, so each file only sees what it asks for.',
        next: 'The imported names are available everywhere in this file, even on lines above this one.'
      })
  },
  {
    test: /^(?:const|let|var)\s+(.+?)\s*=\s*require\(\s*['"](.+?)['"]\s*\)/,
    build: (line, m) =>
      make(P, {
        title: `Loading the "${m[2]}" module (CommonJS)`,
        says: `Load the module "${m[2]}" and store what it exports in ${m[1]}.`,
        runtime: `Node resolves "${m[2]}" — first as a built-in module, then by searching node_modules folders upward — runs that file once, caches the result, and returns its module.exports object. Later require calls get the cached copy.`,
        why: 'require is how Node.js code loads libraries and other files in the CommonJS module system.',
        next: `${m[1]} now holds the module's exports for the rest of the file.`
      })
  },
  {
    test: /^module\.exports\s*=\s*(.+)/,
    build: (line, m) =>
      make(P, {
        title: 'Exporting from a CommonJS module',
        says: `Make ${truncate(m[1].replace(/;$/, ''), 40)} the value other files receive when they require this file.`,
        runtime: 'Node wraps each file in a function with a module object. Whatever module.exports points to when the file finishes running is what require() returns — and it is cached.',
        why: 'It defines this file’s public interface; everything else stays private to the file.',
        next: 'Nothing runs yet — the export is used when another file requires this one.'
      })
  },
  {
    test: /^export\s+(default\s+)?(?!function|async|class|const|let|var)(.*)/,
    build: (line, m) =>
      make(P, {
        title: m[1] ? 'Default export' : 'Named export',
        says: m[1] ? 'Make the following value this module’s default export.' : 'Make the following declaration available to other modules by name.',
        runtime: 'Exports are wired up when the module is linked, before it runs. Importers receive a live binding: if the value changes here, they see the change.',
        why: 'Exports define what other files are allowed to use from this module.',
        next: m[2] ? 'The declaration that follows is created as usual and also exported.' : 'Execution continues.'
      })
  },

  // ── React hooks and JSX ───────────────────────────────────
  {
    test: /^const\s+\[\s*([\w$]+)\s*,\s*([\w$]+)\s*\]\s*=\s*useState\((.*)\)/,
    build: (line, m) =>
      make(P, {
        title: `State with useState: ${m[1]}`,
        says: `Create a piece of state called ${m[1]} with the initial value ${m[3] || 'undefined'}, and a function ${m[2]} to change it.`,
        runtime: `React stores state outside your function, in a list attached to this component instance. On the first render it uses the initial value; on every later render this line returns the latest stored value instead. Calling ${m[2]} schedules a re-render — ${m[1]} does not change in the current render.`,
        why: 'Local variables are recreated on every render. State survives between renders and tells React when the screen must update.',
        next: `${m[1]} is a snapshot for this render. Use ${m[2]} to request a new value; React will call the component again with it.`,
        analogy: 'A whiteboard outside the room: each time you walk in (render) you read what is written, and to change it you leave a request at the door.'
      })
  },
  {
    test: /useEffect\(\s*\(\s*\)\s*=>/,
    build: () =>
      make(P, {
        title: 'Running an effect after render',
        says: 'Register a function that React runs after the component has been painted to the screen.',
        runtime: 'React does not call this function during rendering. After the DOM is updated and the browser paints, it runs the effect. If the dependency array changes on a later render, React first runs the previous cleanup, then the effect again. An empty array [] means once after mount, with cleanup on unmount.',
        why: 'Effects synchronise a component with something outside React — subscriptions, timers, the DOM, network connections.',
        next: 'Rendering continues; the effect body runs later, after the commit.'
      })
  },
  {
    test: /^const\s+([\w$]+)\s*=\s*(useRef|useMemo|useCallback|useContext)\((.*)/,
    build: (line, m) => {
      const map = {
        useRef: 'Returns the same mutable object on every render. Changing .current does not trigger a re-render.',
        useMemo: 'Runs the calculation on the first render and again only when a dependency changes; otherwise returns the cached result.',
        useCallback: 'Returns the same function object between renders until a dependency changes, so child components see a stable reference.',
        useContext: 'Reads the value from the nearest matching Provider above this component, and re-renders when that value changes.'
      };
      return make(P, {
        title: `${m[2]}: ${m[1]}`,
        says: `Create ${m[1]} using the ${m[2]} hook.`,
        runtime: map[m[2]],
        why: 'Hooks give function components memory and access to React features between renders.',
        next: `${m[1]} is available for the rest of this render.`
      });
    }
  },
  {
    test: /^return\s*\(\s*$/,
    build: (line, m, ctx) => {
      const nextLine = (ctx.lines[ctx.lineIndex + 1] || '').trim();
      const jsx = nextLine.startsWith('<');
      return make(P, {
        title: jsx ? 'Returning JSX' : 'Return statement',
        says: jsx ? 'Return the markup below as this component’s output.' : 'Return the value of the expression that follows.',
        runtime: jsx
          ? 'JSX is compiled before it reaches the browser: each tag becomes a call that creates a plain JavaScript object describing the element. Returning it does not touch the DOM — React compares it with the previous render and applies only the differences.'
          : 'The function ends and its call frame is popped off the call stack; the caller receives the value.',
        why: jsx ? 'Describing the UI as data lets React decide the minimal DOM work.' : 'It hands a result back to the caller.',
        next: jsx ? 'React commits any changes to the DOM after rendering finishes.' : 'Control returns to the caller.'
      });
    }
  },
  {
    test: /^<\/?([A-Za-z][\w.]*)/,
    build: (line, m) => {
      const name = m[1];
      const isComponent = /^[A-Z]/.test(name);
      const closing = line.startsWith('</');
      return make(P, {
        title: closing ? `Closing </${name}>` : isComponent ? `Rendering the ${name} component` : `JSX element <${name}>`,
        says: closing
          ? `Ends the <${name}> element opened above.`
          : isComponent
          ? `Render ${name} here and pass it the attributes as props.`
          : `Describe a <${name}> element${/\{/.test(line) ? ' with values computed from JavaScript in {…}' : ''}.`,
        runtime: isComponent
          ? `JSX compiles this to a call that creates an element object of type ${name}. During rendering React calls ${name}(props) and recurses into whatever it returns.`
          : 'JSX compiles this to a function call that returns an object describing the element. React creates or updates the real DOM node only during the commit phase.',
        why: 'JSX lets you describe UI structure with familiar markup while keeping full JavaScript expressions in {…}.',
        next: closing ? 'Sibling elements continue below.' : 'Children inside the element are evaluated and become its props.children.'
      });
    }
  },
  {
    test: /^\{\s*([\w$.]+)\.map\(/,
    build: (line, m) =>
      make(P, {
        title: `Rendering a list from ${m[1]}`,
        says: `For each item in ${m[1]}, produce an element.`,
        runtime: 'map returns a new array of element objects. React renders arrays as siblings and uses each element’s key to match items between renders, so it can move, insert or remove DOM nodes instead of rebuilding the list.',
        why: 'Rendering from data keeps the UI in sync with state automatically.',
        next: 'Each returned element must have a stable, unique key prop.'
      })
  },

  // ── Server (Express / Node) ────────────────────────────────
  {
    test: /^(app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]\s*,\s*(async\s*)?/,
    build: (line, m) =>
      make(P, {
        title: `Route: ${m[2].toUpperCase()} ${m[3]}`,
        says: `When an HTTP ${m[2].toUpperCase()} request arrives for ${m[3]}, run the handler function.`,
        runtime: `This line runs once at start-up and only registers the route. For each matching request, Express builds req and res objects and calls the handler${m[4] ? ' — an async handler, so it can await without blocking other requests' : ''}. Path segments like :id are parsed into req.params.`,
        why: 'Routes map URLs and methods to the code that should respond.',
        next: 'The handler must send exactly one response (res.json, res.send, res.status(...)...) or the client will wait until it times out.'
      })
  },
  {
    test: /^(app|router)\.use\((.*)\)/,
    build: (line, m) =>
      make(P, {
        title: 'Registering middleware',
        says: `Add ${truncate(m[2], 40)} to the request pipeline.`,
        runtime: 'Middleware runs in the order it is registered, for every request (or every request under a path). express.json(), for example, reads the request body stream and parses it into req.body before your routes run.',
        why: 'Cross-cutting work — parsing, logging, authentication — is written once instead of in every route.',
        next: 'Each middleware either responds or calls next() to pass the request on.'
      })
  },
  {
    test: /^(?:const|let)\s+([\w$]+)\s*=\s*express\(\)/,
    build: (line, m) =>
      make(P, {
        title: 'Creating an Express application',
        says: `Create an Express app and store it in ${m[1]}.`,
        runtime: 'express() returns a request-handler function with methods for registering middleware and routes. Nothing listens on the network yet.',
        why: 'The app object is where all routes and middleware are attached.',
        next: `Routes are added to ${m[1]}; ${m[1]}.listen() later starts the HTTP server.`
      })
  },
  {
    test: /^(app|server)\.listen\((.*)\)/,
    build: (line, m) =>
      make(P, {
        title: 'Starting the HTTP server',
        says: `Start accepting connections on port ${truncate(m[2], 30)}.`,
        runtime: 'Node asks the operating system to open a listening socket. listen returns immediately; from then on, each incoming connection becomes an event handled by the event loop, so one thread can serve many clients while their I/O is in progress.',
        why: 'Without this the routes exist but nothing receives requests.',
        next: 'The process stays alive, waiting for requests.'
      })
  },
  {
    test: /res\.status\((\d+)\)\.json\((.*)\)/,
    build: (line, m) =>
      make(P, {
        title: `Responding with status ${m[1]}`,
        says: `${/^return\b/.test(line) ? 'Stop here and send' : 'Send'} an HTTP ${m[1]} response with a JSON body.`,
        runtime: `res.status sets the status line; .json serialises the value with JSON.stringify, sets Content-Type: application/json, and writes the response to the socket. ${/^return\b/.test(line) ? 'return exits the handler so no second response is attempted.' : ''}`,
        why: Number(m[1]) >= 400 ? 'Error status codes let clients react correctly instead of parsing error text.' : `${m[1]} tells the client the request succeeded${m[1] === '201' ? ' and something was created' : ''}.`,
        next: 'The response is finished; sending another for the same request would throw an error.'
      })
  },
  {
    test: /res\.json\((.*)\)/,
    build: (line, m) =>
      make(P, {
        title: 'Sending a JSON response',
        says: `Send ${truncate(m[1], 40)} to the client as JSON.`,
        runtime: 'The value is serialised with JSON.stringify, Content-Type is set to application/json, the status defaults to 200, and the response is written to the network socket.',
        why: 'JSON is the format browsers and API clients expect.',
        next: 'The request is complete.'
      })
  },

  // ── Async ──────────────────────────────────────────────────
  {
    test: /^(const|let|var)\s+(.+?)\s*=\s*await\s+(.+?);?$/,
    build: (line, m, ctx) => {
      const [, kw, name, expr] = m;
      const callee = calleeOf(expr) || 'the expression';
      const isFetch = /^fetch\b/.test(expr);
      const isJson = /\.json\(\)\s*;?$/.test(expr);
      const isCompare = /bcrypt\.compare/.test(expr);
      const asyncCtx = insideAsync(ctx.lines, ctx.lineIndex);
      const runtime = isFetch
        ? `fetch() hands the request to the browser’s networking layer and immediately returns a pending Promise. await suspends this async function and gives control back to the event loop, so the page keeps rendering and responding. When the response headers arrive, the Promise resolves with a Response object and the function resumes as a microtask. The body has not been read yet.`
        : isJson
        ? `Reading the body is asynchronous: the browser streams the remaining bytes and then parses them as JSON. await pauses this function until that Promise resolves with a plain JavaScript object.`
        : isCompare
        ? 'bcrypt hashes the submitted password with the salt stored inside the saved hash and compares the results. It is deliberately slow and runs off the main thread, so await keeps the server free to handle other requests meanwhile.'
        : `${callee}() runs right away and returns a Promise. await suspends this function at this line and returns control to the event loop, so other code, events and rendering continue. When the Promise settles, the rest of this function is queued as a microtask and resumes here with the result.`;
      return make(P, {
        title: isFetch ? 'Waiting for a network response' : isJson ? 'Waiting for the body to be parsed' : 'Waiting for a Promise without blocking',
        says: `Call ${callee === 'the expression' ? truncate(expr, 40) : `${callee}()`}, wait for its Promise to settle, and store the result in ${name}.`,
        runtime,
        why: 'Work that takes time (network, disk, timers) would freeze everything if JavaScript waited synchronously. await keeps the steps in reading order without blocking.',
        next: `If the Promise resolves, ${name} holds the value and the next line runs. If it rejects, an error is thrown at this line — handled by the nearest catch.`,
        analogy: 'Ordering coffee and getting a buzzer: you step aside so the queue keeps moving, and come back when it buzzes.',
        warning: asyncCtx === false ? 'await is only allowed inside an async function. The enclosing function is not async, so this line is a syntax error.' : null,
        notes: [KEYWORD_NOTES[kw]]
      });
    }
  },
  {
    test: /^(return\s+)?await\s+(.+)/,
    build: (line, m, ctx) =>
      make(P, {
        title: 'Awaiting a Promise',
        says: `Wait for ${truncate(m[2].replace(/;$/, ''), 40)} to finish before continuing${m[1] ? ', then return its result' : ''}.`,
        runtime: 'The expression runs and produces a Promise. await suspends the current async function and yields to the event loop. When the Promise settles, the function resumes here as a microtask.',
        why: 'The next step depends on this one finishing first.',
        next: 'If the Promise rejects, the error is thrown from this line.',
        warning: insideAsync(ctx.lines, ctx.lineIndex) === false ? 'await is only valid inside an async function.' : null
      })
  },
  {
    test: /^(?:export\s+)?(?:default\s+)?async\s+function\s*([\w$]*)\s*\((.*?)\)/,
    build: (line, m) =>
      make(P, {
        title: `Declaring async function ${m[1] || '(anonymous)'}`,
        says: `Define a function named ${m[1] || '(anonymous)'}${m[2] ? ` that takes ${m[2]}` : ''} and may use await inside.`,
        runtime: 'Declaring does not run the body. Because it is async, calling it always returns a Promise immediately. Inside, each await can suspend the function; whatever it eventually returns resolves that Promise, and any uncaught error rejects it.',
        why: 'async functions let you write asynchronous steps in sequence, like ordinary code.',
        next: 'Nothing runs until the function is called. Function declarations are hoisted, so it can be called from anywhere in this scope.'
      })
  },
  {
    test: /^(?:const|let|var)\s+([\w$]+)\s*=\s*async\s*\(?([^)=]*)\)?\s*=>/,
    build: (line, m) =>
      make(P, {
        title: `Async arrow function ${m[1]}`,
        says: `Store an async function in ${m[1]}${m[2] ? ` that takes ${m[2]}` : ''}.`,
        runtime: 'The function object is created now, but its body runs only when called. Calls return a Promise; await inside suspends only this function.',
        why: 'An inline async function is convenient for handlers and callbacks that need to wait.',
        next: `${m[1]} cannot be called before this line — unlike a function declaration, it is not hoisted with its value.`
      })
  },
  {
    test: /new Promise\(\s*\(?([\w$, ]*)\)?\s*=>/,
    build: (line, m) =>
      make(P, {
        title: 'Creating a Promise',
        says: `Create a Promise and receive ${m[1] || 'resolve and reject'} to settle it.`,
        runtime: 'The function you pass (the executor) runs synchronously, right now. The Promise starts pending. Calling resolve(value) fulfils it and queues any .then/await continuations as microtasks; calling reject(error) or throwing rejects it.',
        why: 'Promise wraps callback-based or timer-based work so it can be awaited.',
        next: 'The Promise is returned immediately, still pending, while the executor’s async work continues.'
      })
  },
  {
    test: /\b(setTimeout|setInterval)\(/,
    build: (line, m) => {
      const delay = (line.match(/,\s*(\d+)\s*\)\s*;?\s*\)?\s*;?$/) || [])[1];
      const interval = m[1] === 'setInterval';
      return make(P, {
        title: interval ? 'Scheduling a repeating timer' : 'Scheduling a timer',
        says: `Run the callback ${interval ? 'repeatedly, every' : 'after'} ${delay ? `${delay} ms` : 'the given delay'}.`,
        runtime: `The browser (or Node) starts a timer outside the JavaScript thread and returns an id immediately. When it expires, the callback is placed in the task queue; it runs only once the call stack is empty and earlier tasks and all microtasks have finished — so the delay is a minimum, not a guarantee.`,
        why: interval ? 'For recurring work such as polling or clocks.' : 'To defer work, or to simulate slow operations like a network request.',
        next: 'Execution continues with the next line immediately; the callback runs later.'
      });
    }
  },
  {
    test: /^\.?(then|catch|finally)\(/,
    build: (line, m) =>
      make(P, {
        title: `Promise .${m[1]}()`,
        says: m[1] === 'then' ? 'Run this callback with the value once the Promise fulfils.' : m[1] === 'catch' ? 'Run this callback if the Promise (or an earlier step) rejects.' : 'Run this callback whether the Promise fulfils or rejects.',
        runtime: `.${m[1]} registers a reaction and returns a new Promise immediately. When the original settles, the callback is queued as a microtask — it always runs asynchronously, even if the Promise was already settled.`,
        why: 'Chaining keeps each asynchronous step separate and lets one catch handle errors from all of them.',
        next: 'The next link in the chain receives whatever this callback returns.'
      })
  },
  {
    test: /^(?:const|let|var\s+)?.*\bfetch\(\s*([`'"].+?[`'"])?/,
    build: (line, m) =>
      make(P, {
        title: 'Starting a network request',
        says: `Request ${m[1] || 'a resource'} over HTTP.`,
        runtime: 'fetch passes the request to the browser’s network stack and returns a pending Promise right away. It resolves when response headers arrive — even for 404 or 500 responses; it only rejects on network failure.',
        why: 'fetch is the standard way to talk to servers from JavaScript.',
        next: 'Without await or .then, the next line runs before the response arrives.'
      })
  },

  // ── Functions and classes ─────────────────────────────────
  {
    test: /^(?:export\s+)?(?:default\s+)?function\s*\*?\s*([\w$]*)\s*\((.*?)\)/,
    build: (line, m) => {
      const isComponent = /^[A-Z]/.test(m[1]);
      return make(P, {
        title: isComponent ? `Component ${m[1]}` : `Declaring function ${m[1] || '(anonymous)'}`,
        says: isComponent
          ? `Define a React component named ${m[1]} that receives ${m[2] || 'no props'}.`
          : `Define a function ${m[1]}${m[2] ? ` with parameters ${m[2]}` : ' with no parameters'}.`,
        runtime: isComponent
          ? 'A component is a plain function. React calls it on every render with the current props, and it returns a description of the UI.'
          : 'During the creation phase of this scope, the engine creates the whole function object — this is hoisting, so the function can be called even from lines above. The body does not run until it is called; each call pushes a new frame onto the call stack with its own local variables.',
        why: 'Functions name a piece of behaviour so it can be reused and reasoned about in one place.',
        next: 'Nothing executes yet; the engine skips over the body.'
      });
    }
  },
  {
    test: /^(?:const|let|var)\s+([\w$]+)\s*=\s*\(?([^)=]*)\)?\s*=>/,
    build: (line, m) =>
      make(P, {
        title: `Arrow function ${m[1]}`,
        says: `Create a function and store it in ${m[1]}${m[2].trim() ? `; it takes ${m[2].trim()}` : ''}.`,
        runtime: 'The function object is created when this line runs (not hoisted like a declaration). Arrow functions capture this and arguments from the surrounding scope instead of having their own. Variables they reference from outside are kept alive by the closure.',
        why: 'Short, inline functions for callbacks and small helpers.',
        next: `${m[1]} can be called from this line onward.`
      })
  },
  {
    test: /^(?:export\s+)?class\s+([\w$]+)(?:\s+extends\s+([\w$.]+))?/,
    build: (line, m) =>
      make(P, {
        title: `Class ${m[1]}`,
        says: `Define a class ${m[1]}${m[2] ? ` that extends ${m[2]}` : ''}.`,
        runtime: `A class is a constructor function with methods placed on ${m[1]}.prototype. Instances created with new share those methods through the prototype chain.${m[2] ? ` extends links ${m[1]}.prototype to ${m[2]}.prototype, so property lookups fall back to the parent.` : ''} Class bodies always run in strict mode.`,
        why: 'Classes group data and the behaviour that works on it.',
        next: 'The class can be instantiated with new from this line on (classes are not hoisted with a value).'
      })
  },
  {
    test: /^constructor\s*\((.*?)\)/,
    build: (line, m) =>
      make(P, {
        title: 'Constructor',
        says: `Code that runs when a new instance is created${m[1] ? `, receiving ${m[1]}` : ''}.`,
        runtime: 'new creates an empty object linked to the class prototype, binds it to this, and runs the constructor. Unless it returns another object, that new object is the result.',
        why: 'To initialise each instance’s own data.',
        next: 'Assignments to this.something below become properties of the new instance.'
      })
  },

  // ── Control flow ──────────────────────────────────────────
  {
    test: /^try\s*\{?$/,
    build: () =>
      make(P, {
        title: 'try block',
        says: 'Run the following statements, watching for errors.',
        runtime: 'The engine marks a handler on the call stack. If anything inside throws — including a rejected await — execution jumps straight to the matching catch, skipping the remaining lines in try.',
        why: 'To handle failure in one place instead of letting it crash the caller.',
        next: 'The statements inside the braces run in order.'
      })
  },
  {
    test: /^\}?\s*catch\s*\(?\s*([\w$]*)\s*\)?\s*\{?/,
    build: (line, m) =>
      make(P, {
        title: 'catch block',
        says: `If anything in the try block threw, handle it here${m[1] ? ` with the error available as ${m[1]}` : ''}.`,
        runtime: 'This code runs only when an exception reached this handler. The stack has already been unwound back to this function; the thrown value is bound to the catch parameter.',
        why: 'To recover, log, or show the user something useful instead of a broken page.',
        next: 'After catch, execution continues after the whole try/catch statement.'
      })
  },
  {
    test: /^\}?\s*finally\s*\{?/,
    build: () =>
      make(P, {
        title: 'finally block',
        says: 'Run this code whether try succeeded or failed.',
        runtime: 'finally runs after try (and catch, if it ran), even if they returned or threw.',
        why: 'Cleanup that must always happen: hiding a spinner, closing a resource.',
        next: 'Then execution continues — or the pending return/throw completes.'
      })
  },
  {
    test: /^throw\s+(.+)/,
    build: (line, m) =>
      make(P, {
        title: 'Throwing an error',
        says: `Stop normal execution and raise ${truncate(m[1].replace(/;$/, ''), 40)}.`,
        runtime: 'The engine unwinds the call stack frame by frame until it finds a try/catch. If none exists, the error becomes uncaught and is reported in the console (or rejects the enclosing async function’s Promise).',
        why: 'To signal that something went wrong in a way callers cannot ignore.',
        next: 'No further lines in this block run.'
      })
  },
  {
    test: /^return\b\s*(.*)/,
    build: (line, m, ctx) => {
      const cond = /^if\s*\(/.test(line);
      const blocks = enclosingBlocks(ctx.lines, ctx.lineIndex);
      const fn = blocks.find((b) => /function\b|=>/.test(b.text));
      const asyncFn = fn && /\basync\b/.test(fn.text);
      const value = m[1].replace(/;$/, '');
      if (/^(\([^)]*\)|[\w$]+)\s*=>|^function\b/.test(value)) {
        const inEffect = blocks.some((b) => /useEffect\(/.test(b.text));
        return make(P, {
          title: inEffect ? 'Returning a cleanup function' : 'Returning a function (closure)',
          says: inEffect ? 'Give React a function to run when this effect is torn down.' : 'Hand back a new function to the caller.',
          runtime: inEffect
            ? 'React stores this function and calls it before the effect runs again and when the component unmounts. Here it removes the listener, so old handlers do not pile up or update a component that no longer exists.'
            : 'The returned function keeps a reference to the variables of the scope it was created in. Even after this function returns and its frame is popped, those variables stay alive on the heap for as long as the returned function exists — that is a closure.',
          why: inEffect ? 'Every subscription needs a matching unsubscribe.' : 'Closures give a function private, persistent state.',
          next: 'Control goes back to the caller with the function as the result.'
        });
      }
      return make(P, {
        title: value ? 'Returning a value' : 'Returning early',
        says: value ? `End the function and hand back ${truncate(value, 40)}.` : 'End the function here without a value.',
        runtime: `The current call frame is popped off the call stack and its local variables become unreachable (unless a closure still references them).${asyncFn ? ' Because the function is async, the value resolves the Promise the caller received.' : ''}${cond ? '' : ''}`,
        why: 'To give the caller a result, or to stop as soon as the work is done.',
        next: 'Control goes back to the line that called this function.'
      });
    }
  },
  {
    test: /^\}?\s*else(\s+if\s*\((.+)\))?/,
    build: (line, m) =>
      make(P, {
        title: m[1] ? 'else if' : 'else',
        says: m[1] ? `Otherwise, if ${truncate(m[2], 40)} is truthy, run this block.` : 'Otherwise, run this block.',
        runtime: 'Only reached when every earlier condition in the chain was falsy. At most one branch of an if/else chain runs.',
        why: 'To handle the remaining cases.',
        next: 'After the chosen branch, execution continues after the whole chain.'
      })
  },
  {
    test: /^for\s*\(\s*(?:const|let|var)\s+(.+?)\s+of\s+(.+?)\)/,
    build: (line, m) =>
      make(P, {
        title: `Looping over ${m[2]}`,
        says: `For each value in ${m[2]}, run the block with it bound to ${m[1]}.`,
        runtime: `for…of asks ${m[2]} for its iterator and calls next() until done. Each iteration gets a fresh ${m[1]} binding, so closures created inside capture the value of that iteration.`,
        why: 'The simplest way to visit every item of an array, string, Map or Set.',
        next: 'The block runs once per item, then execution continues after the loop.'
      })
  },
  {
    test: /^for\s*\(\s*(?:const|let|var)\s+(.+?)\s+in\s+(.+?)\)/,
    build: (line, m) =>
      make(P, {
        title: `Looping over the keys of ${m[2]}`,
        says: `For each enumerable property name of ${m[2]}, run the block with it as ${m[1]}.`,
        runtime: 'for…in walks string keys, including inherited enumerable ones from the prototype chain. Order follows insertion for string keys.',
        why: 'To inspect an object’s keys. For arrays, prefer for…of.',
        next: 'The block runs once per key.'
      })
  },
  {
    test: /^for\s*\((.*);(.*);(.*)\)/,
    build: (line, m) =>
      make(P, {
        title: 'Counting loop',
        says: `Start with ${m[1].trim()}, repeat while ${m[2].trim()}, and do ${m[3].trim()} after each pass.`,
        runtime: 'The initialiser runs once. Before each iteration the condition is checked; after each iteration the update runs. With let, every iteration gets its own copy of the counter.',
        why: 'When you need the index, or a custom step.',
        next: 'When the condition becomes false, execution continues after the loop.'
      })
  },
  {
    test: /^while\s*\((.+)\)/,
    build: (line, m) =>
      make(P, {
        title: 'while loop',
        says: `Repeat the block as long as ${truncate(m[1], 40)} is truthy.`,
        runtime: 'The condition is checked before each pass. The loop holds the thread for as long as it runs — a loop that never ends freezes the page.',
        why: 'When you do not know in advance how many iterations you need.',
        next: 'Something inside must eventually make the condition false.'
      })
  },

  // ── Arrays ────────────────────────────────────────────────
  {
    test: /\.(map|filter|reduce|forEach|find|findIndex|some|every|sort|flatMap)\(/,
    build: (line, m) => {
      const info = {
        map: ['Transforming every item', 'Create a new array with the callback’s result for each item.', 'map calls the callback once per element, in order, and collects the return values into a new array of the same length. The original array is not changed.'],
        filter: ['Keeping matching items', 'Create a new array with only the items for which the callback returns truthy.', 'filter calls the callback for each element and copies the element into a new array when the result is truthy. The original is untouched.'],
        reduce: ['Folding an array into one value', 'Combine all items into a single value using an accumulator.', 'reduce calls the callback with (accumulator, item) for each element; whatever the callback returns becomes the next accumulator. The initial value (the second argument) is the starting accumulator.'],
        forEach: ['Running code for each item', 'Call the callback once for every item.', 'forEach calls the callback per element and returns undefined. It cannot be stopped early with break, and it does not wait for async callbacks.'],
        find: ['Finding the first match', 'Return the first item for which the callback returns truthy.', 'find stops at the first match and returns it, or undefined if nothing matches.'],
        findIndex: ['Finding the index of a match', 'Return the position of the first matching item.', 'findIndex stops at the first match and returns its index, or -1.'],
        some: ['Checking if any item matches', 'Return true if the callback is truthy for at least one item.', 'some stops at the first truthy result.'],
        every: ['Checking if all items match', 'Return true only if the callback is truthy for every item.', 'every stops at the first falsy result.'],
        sort: ['Sorting in place', 'Reorder the array.', 'sort mutates the original array. Without a compare function it converts items to strings, so [10, 9, 1] sorts as [1, 10, 9].'],
        flatMap: ['Mapping and flattening', 'Map each item to an array and join the results.', 'flatMap maps and then flattens one level.']
      }[m[1]];
      return make(P, {
        title: info[0],
        says: info[1],
        runtime: info[2],
        why: 'Array methods express what you want done with data rather than how to loop over it.',
        next: /^\./.test(line) ? 'This continues the chain from the line above — each method receives the previous result.' : 'The result can be stored or chained into another method.'
      });
    }
  },

  // ── DOM ───────────────────────────────────────────────────
  {
    test: /([\w$.\]\)]+)\.addEventListener\(\s*['"`](\w+)['"`]/,
    build: (line, m) =>
      make(P, {
        title: `Listening for "${m[2]}" events`,
        says: `When a ${m[2]} event happens on ${m[1]}, run the callback.`,
        runtime: `This registers the callback with the browser and returns immediately — the callback does not run now. When the user triggers a ${m[2]}, the browser creates an Event object, dispatches it down to the target and back up through its ancestors (bubbling), and queues your callback as a task. It runs once the call stack is empty.`,
        why: 'Interfaces are driven by user actions; listeners connect those actions to your code.',
        next: 'Execution moves on immediately. The callback body runs later, once per event.',
        analogy: 'Leaving your number with a receptionist: nothing happens now, but you get a call each time someone asks for you.'
      })
  },
  {
    test: /\.(textContent|innerText)\s*=\s*(.+)/,
    build: (line, m) =>
      make(P, {
        title: `Writing text with ${m[1]}`,
        says: `Replace the element’s text with ${truncate(m[2].replace(/;$/, ''), 40)}.`,
        runtime: `The element’s children are removed and replaced with a single text node. Nothing is parsed as HTML, so the value is safe to insert. The DOM changes immediately, but the screen updates later, when the browser next recalculates style and layout and paints — after this task finishes.`,
        why: 'The safe, fast way to show data on the page.',
        next: 'Further DOM changes in the same task are batched into the same repaint.'
      })
  },
  {
    test: /\.innerHTML\s*=\s*(.+)/,
    build: (line, m) =>
      make(P, {
        title: 'Writing HTML with innerHTML',
        says: 'Parse the string as HTML and replace the element’s contents with the result.',
        runtime: 'The browser runs its HTML parser on the string, builds new nodes and swaps them in. Existing children — and their event listeners — are destroyed.',
        why: 'Convenient for templates, but never use it with text that came from users: it can execute injected markup.',
        next: 'Prefer textContent for plain text.'
      })
  },
  {
    test: /\.classList\.(add|remove|toggle|contains)\((.+)\)/,
    build: (line, m) =>
      make(P, {
        title: `classList.${m[1]}()`,
        says: `${m[1][0].toUpperCase()}${m[1].slice(1)} the class ${m[2].replace(/;$/, '')}.`,
        runtime: 'Changing classes marks the element’s style as dirty. Before the next frame the browser re-matches CSS rules and, if geometry changed, re-runs layout before painting.',
        why: 'Keeping visual states in CSS and toggling classes keeps styling out of JavaScript.',
        next: 'CSS transitions on the element will animate the change.'
      })
  },
  {
    test: /\.style\.([\w$]+)\s*=\s*(.+)/,
    build: (line, m) =>
      make(P, {
        title: `Inline style: ${m[1]}`,
        says: `Set the element’s ${m[1]} to ${m[2].replace(/;$/, '')}.`,
        runtime: 'This writes to the element’s style attribute, which wins over stylesheet rules (except !important). The browser recalculates style, and layout too if the property affects geometry.',
        why: 'For values only known at runtime. For fixed states, toggle a class instead.',
        next: 'The change appears on the next frame.'
      })
  },
  {
    test: /\.(remove|append|appendChild|prepend|before|after|replaceWith)\(/,
    build: (line, m) =>
      make(P, {
        title: `DOM ${m[1]}()`,
        says: m[1] === 'remove' ? 'Detach this element from the document.' : `Insert nodes with ${m[1]}().`,
        runtime: 'The DOM tree is updated synchronously. Removed nodes disappear on the next paint; if nothing else references them they are later garbage collected along with their listeners.',
        why: 'To add or remove parts of the page in response to state.',
        next: 'Layout is recalculated before the next frame.'
      })
  },

  {
    test: /(?:(const|let|var)\s+([\w$]+)\s*=\s*)?(document|[\w$]+)\.(querySelector|querySelectorAll|getElementById|getElementsByClassName)\(\s*['"`](.+?)['"`]\s*\)/,
    build: (line, m) => {
      const all = m[4] === 'querySelectorAll' || m[4] === 'getElementsByClassName';
      const target = m[4] === 'getElementById' ? `#${m[5]}` : m[5];
      return make(P, {
        title: all ? `Selecting all "${target}" elements` : `Selecting "${target}"`,
        says: `${m[2] ? `Find ${all ? 'every element' : 'the element'} matching ${target} and store ${all ? 'them' : 'it'} in ${m[2]}.` : `Find ${all ? 'every element' : 'the element'} matching ${target}.`}`,
        runtime: m[4] === 'getElementById'
          ? 'The browser keeps an index of ids, so this lookup is fast. It returns the element, or null if no element has that id when this line runs.'
          : `The browser walks the DOM tree in document order testing each element against the CSS selector${all ? ' and returns a static NodeList of every match' : ' and stops at the first match, or returns null'}.`,
        why: 'You need a reference to an element before you can read or change it.',
        next: all ? 'The list does not update if matching elements are added later.' : 'If the script runs before the element exists in the DOM, the result is null.',
        notes: m[1] ? [KEYWORD_NOTES[m[1]]] : []
      });
    }
  },
  // ── Storage, JSON, console ────────────────────────────────
  {
    test: /(localStorage|sessionStorage)\.(getItem|setItem|removeItem)\((.*)\)/,
    build: (line, m) =>
      make(P, {
        title: `${m[1]}.${m[2]}()`,
        says: m[2] === 'setItem' ? 'Save a string under a key in the browser.' : m[2] === 'getItem' ? 'Read a saved string by key (null if missing).' : 'Delete a saved key.',
        runtime: `${m[1]} is synchronous and stores strings only, per origin. ${m[1] === 'localStorage' ? 'Data survives reloads and restarts.' : 'Data lasts for this tab only.'} Objects must be converted with JSON.stringify and JSON.parse.`,
        why: 'Simple persistence without a server.',
        next: 'The call blocks briefly; keep stored data small.'
      })
  },
  {
    test: /JSON\.(parse|stringify)\(/,
    build: (line, m) =>
      make(P, {
        title: `JSON.${m[1]}()`,
        says: m[1] === 'parse' ? 'Turn a JSON string into JavaScript values.' : 'Turn a JavaScript value into a JSON string.',
        runtime: m[1] === 'parse' ? 'The string is parsed synchronously; invalid JSON throws a SyntaxError.' : 'Functions, undefined and symbols are skipped; Dates become strings; circular references throw.',
        why: 'JSON is how data is stored as text and sent over the network.',
        next: 'The converted value is returned.'
      })
  },
  {
    test: /console\.(log|error|warn|info|table)\((.*)\)/,
    build: (line, m) =>
      make(P, {
        title: `console.${m[1]}()`,
        says: `Print ${truncate(m[2].replace(/\);?$/, ''), 50)} to the console.`,
        runtime: 'The arguments are evaluated first, then handed to the console. Objects are shown by reference, so expanding them later can show newer values. In this workspace, output is captured from the sandboxed page and shown below.',
        why: m[1] === 'error' ? 'To report failures where developers will see them.' : 'To see what your program is doing at this exact point.',
        next: 'Execution continues — logging does not stop the program.'
      })
  },

  // ── Declarations (generic) ────────────────────────────────
  {
    test: /^(const|let|var)\s+(\{[^}]*\}|\[[^\]]*\])\s*=\s*(.+?);?$/,
    build: (line, m) =>
      make(P, {
        title: 'Destructuring',
        says: `Unpack ${m[2]} from ${truncate(m[3], 40)} into separate variables.`,
        runtime: m[2].startsWith('{')
          ? 'Each name is read as a property of the object on the right. Missing properties become undefined (or the default value, if given).'
          : 'Values are taken by position using the iterator of the value on the right.',
        why: 'Shorter than reading each property on its own line.',
        next: 'Each unpacked name is now a variable in this scope.',
        notes: [KEYWORD_NOTES[m[1]]]
      })
  },
  {
    test: /^(const|let|var)\s+([\w$]+)\s*=\s*(.+?);?$/,
    build: (line, m) => {
      const [, kw, name, value] = m;
      let kind = 'the result of an expression';
      let extra = '';
      if (/^new\s+([\w$.]+)/.test(value)) {
        kind = `a new ${value.match(/^new\s+([\w$.]+)/)[1]} instance`;
        extra = ' new creates an object, links it to the constructor’s prototype and runs the constructor.';
      } else if (/^\{/.test(value)) {
        kind = 'an object';
        extra = ' Objects live on the heap; the variable holds a reference to it.';
      } else if (/^\[/.test(value)) {
        kind = 'an array';
        extra = ' Arrays are objects on the heap; the variable holds a reference.';
      } else if (/^['"`]/.test(value)) kind = 'a string';
      else if (/^-?\d/.test(value)) kind = 'a number';
      else if (/^(true|false)$/.test(value)) kind = 'a boolean';
      else if (/^[\w$.]+\(/.test(value)) {
        kind = `the return value of ${calleeOf(value)}()`;
        extra = ` ${calleeOf(value)}() runs first, synchronously, with its own frame on the call stack.`;
      }
      return make(P, {
        title: `Declaring ${name}`,
        says: `Create ${kw === 'const' ? 'a constant' : 'a variable'} named ${name} holding ${kind}.`,
        runtime: `The right-hand side is evaluated first, then bound to ${name} in the current scope.${extra}`,
        why: `Naming a value makes the code readable and lets later lines use it.`,
        next: kw === 'const' ? `${name} cannot be reassigned from here on.` : `${name} can be read and reassigned from here on.`,
        notes: [KEYWORD_NOTES[kw]]
      });
    }
  },

  // ── Assignment and calls ──────────────────────────────────
  {
    test: /^this\.([\w$]+)\s*=\s*(.+)/,
    build: (line, m) =>
      make(P, {
        title: `Setting this.${m[1]}`,
        says: `Store ${truncate(m[2].replace(/;$/, ''), 40)} as the ${m[1]} property of the current instance.`,
        runtime: 'this refers to the object being constructed (or the object the method was called on). The property is created on that object, not on the class.',
        why: 'Each instance keeps its own copy of this data.',
        next: `Other methods can read it as this.${m[1]}.`
      })
  },
  {
    test: /^([\w$.[\]"']+)\s*(\+|-|\*|\/)=\s*(.+)/,
    build: (line, m) =>
      make(P, {
        title: 'Updating a value in place',
        says: `Set ${m[1]} to ${m[1]} ${m[2]} ${m[3].replace(/;$/, '')}.`,
        runtime: `The current value of ${m[1]} is read, combined with the right side, and written back. The binding must be declared with let or var — reassigning a const throws a TypeError.`,
        why: 'A shorthand for updating counters, totals and strings.',
        next: `${m[1]} holds the new value for the following lines.`
      })
  },
  {
    test: /^([\w$.[\]]+)(\+\+|--)/,
    build: (line, m) =>
      make(P, {
        title: m[2] === '++' ? 'Increment' : 'Decrement',
        says: `${m[2] === '++' ? 'Add' : 'Subtract'} one ${m[2] === '++' ? 'to' : 'from'} ${m[1]}.`,
        runtime: `Reads ${m[1]}, converts it to a number, and writes back the result.`,
        why: 'Counting.',
        next: `${m[1]} is updated immediately.`
      })
  },
  {
    test: /^([\w$.[\]"']+)\s*=\s*(.+)/,
    build: (line, m) =>
      make(P, {
        title: `Assigning to ${m[1]}`,
        says: `Store ${truncate(m[2].replace(/;$/, ''), 40)} in ${m[1]}.`,
        runtime: m[1].includes('.')
          ? 'The object on the left is looked up first; then the property is created or overwritten on it.'
          : `The right side is evaluated, then written to the existing binding ${m[1]}, found by walking outward through the scope chain.`,
        why: 'To update state that later code depends on.',
        next: 'Subsequent reads see the new value.'
      })
  },
  {
    test: /^(set[A-Z][\w$]*)\((.*)\)\s*;?$/,
    build: (line, m) =>
      make(P, {
        title: `Requesting a state update with ${m[1]}`,
        says: `Ask React to store ${truncate(m[2], 40)} as the new state.`,
        runtime: `${m[1]} does not change the variable in the current render. React queues the update, and after the current event handler finishes it re-runs the component with the new value and updates only the DOM that changed. Passing a new array or object (not a mutated one) is what lets React see the change.`,
        why: 'State is how React knows the screen must update.',
        next: 'Code after this line still sees the old value.'
      })
  },
  {
    test: /^([\w$.]+)\((.*)\)\s*;?$/,
    build: (line, m) =>
      make(P, {
        title: `Calling ${m[1]}()`,
        says: `Run ${m[1]}${m[2] ? ` with ${truncate(m[2], 40)}` : ''}.`,
        runtime: `A new frame for ${m[1]} is pushed onto the call stack with its parameters bound to the arguments. This line waits until that frame returns${/^[a-z]/.test(m[1]) ? ' — unless the function is async, in which case it returns a Promise as soon as it reaches its first await' : ''}.`,
        why: 'Calling is how a defined function actually does its work.',
        next: 'The return value is discarded here, since it is not stored.'
      })
  },
  {
    test: /^\{\s*(.+?)\s*\},?$/,
    build: (line, m) => {
      const keys = m[1].split(',').map((p) => p.split(':')[0].trim()).filter(Boolean);
      return make(P, {
        title: 'Object literal',
        says: `An object with the properties ${keys.join(', ')}.`,
        runtime: 'A new object is allocated on the heap each time this expression runs. Inside an array literal, a reference to it is stored at the next index.',
        why: 'Objects group related values — here, one record of data.',
        next: 'The next element of the array, or the end of it.'
      });
    }
  },
  {
    test: /^[^<>=;(){}]*\{[\w$.?]+\}[^=;]*$/,
    build: (line, m, ctx) => {
      const prev = (ctx.lines.slice(0, ctx.lineIndex).reverse().find((l) => l.trim()) || '').trim();
      if (!/>$|^</.test(prev)) return unknown('JavaScript');
      const exprs = line.match(/\{([\w$.?]+)\}/g).map((e) => e.slice(1, -1));
      return make(P, {
        title: 'JSX text with embedded values',
        says: `Text content with ${exprs.join(', ')} inserted from JavaScript.`,
        runtime: `Each {…} is evaluated during render and its current value is inserted as text. When ${exprs[0]} changes and the component re-renders, React updates only that text node in the DOM.`,
        why: 'Keeps the displayed text in sync with state automatically.',
        next: 'The element closes below.'
      });
    }
  },
  {
    test: /^([\w$]+)\s*:\s*(.+?),?$/,
    build: (line, m) =>
      make(P, {
        title: `Property ${m[1]}`,
        says: `Give the object a property ${m[1]} with the value ${truncate(m[2], 40)}.`,
        runtime: 'Object literals are built when the expression runs; each property is evaluated in order and added to the new object.',
        why: 'Objects group related values under names.',
        next: 'The next property, or the end of the object.'
      })
  }
];

export const explainJavaScript = (line, ctx) => {
  if (!line) return blank();

  // Closing brackets: find what they close.
  if (/^[}\])]/.test(line) && !/^\}\s*(catch|else|finally)/.test(line)) {
    const opener = findOpener(ctx.lines, ctx.lineIndex);
    const what = opener ? describeOpener(opener.text) : 'a block';
    return make(S.STRUCTURE, {
      title: `End of ${what}`,
      says: opener ? `Closes ${what} that started on line ${opener.index + 1}.` : 'Closes a block.',
      runtime: /^\}\)/.test(line)
        ? 'The function passed as an argument ends here, and so does the call it was passed to. The callback itself runs later, when it is invoked.'
        : opener && /function\b|=>/.test(opener.text)
        ? 'When execution reaches the end of a function body without a return, the function returns undefined and its frame is popped off the call stack.'
        : 'Variables declared with let or const inside the block go out of scope here.',
      why: 'Brackets define where blocks, functions, objects and calls begin and end.',
      next: 'Execution continues after the closed construct.',
      relatedLine: opener ? opener.index : null
    });
  }

  for (const rule of rules) {
    const m = line.match(rule.test);
    if (m) {
      const result = rule.build(line, m, ctx);
      result.tags = [...(result.tags || []), ...tagsFor(line).filter((t) => !result.title.toLowerCase().includes(t.label.toLowerCase()))];
      if (/^export\s+(default\s+)?(function|async|class|const|let|var)\b/.test(line)) {
        result.tags.unshift({ label: 'export', note: 'Also makes this available to other modules that import it.' });
      }
      return result;
    }
  }
  return unknown('JavaScript');
};
