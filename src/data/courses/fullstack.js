export const fullstack = {
  id: 'fullstack-web-development',
  title: 'Full-Stack Web Development',
  subtitle: 'From Zero to Production',
  category: 'Full-Stack',
  level: 'Beginner → Job-ready',
  hours: 42,
  price: 10499, // INR
  skills: ['HTML', 'CSS', 'JavaScript', 'Git', 'React', 'Node.js', 'SQL', 'Deployment'],
  summary:
    'Build and ship a complete web application: the page, the API behind it, the database under it, and the server it runs on.',
  description:
    'You start with how a browser turns a URL into pixels and finish with your own application running in production. Each stage adds one layer — markup, styling, behaviour, a React interface, an Express API, a SQL database, authentication — and you deploy what you build.',
  outcomes: [
    'Explain what happens between typing a URL and seeing a rendered page.',
    'Build responsive interfaces with semantic HTML, modern CSS and React.',
    'Design a REST API in Node.js and persist data in a relational database.',
    'Add password-based authentication without storing secrets in plain text.',
    'Package the application in a container and deploy it with environment-based configuration.'
  ],
  audience: [
    'Beginners who want one coherent path instead of a pile of disconnected tutorials.',
    'Frontend developers who want to understand the server side of their own apps.',
    'Career switchers who need a portfolio project that runs in production.'
  ],
  projects: [
    { title: 'Personal portfolio', description: 'A semantic, responsive site deployed under your own domain.' },
    { title: 'Notes app with React', description: 'Create, edit and filter notes with component state and persistence.' },
    { title: 'Full-stack task tracker', description: 'React client, Express API, PostgreSQL storage, login, and a production deploy.' }
  ],
  sandbox: {
    mode: 'web',
    prompt: 'Free practice space. Write anything, run it, and place your cursor on a line to see what it does.',
    files: [
      { id: 'html', name: 'index.html', language: 'html', code: '<main>\n  <h1>Scratchpad</h1>\n  <p id="out">Edit me.</p>\n</main>' },
      { id: 'css', name: 'style.css', language: 'css', code: 'body {\n  font-family: system-ui, sans-serif;\n  padding: 1.5rem;\n}' },
      { id: 'js', name: 'script.js', language: 'javascript', code: 'const out = document.getElementById("out");\nout.textContent = "Hello from script.js";' }
    ]
  },
  modules: [
    {
      id: 'fs-m1',
      title: 'Foundations of the web',
      lessons: [
        {
          id: 'fs-01',
          title: 'How the web works: requests, responses and the browser',
          duration: '14 min',
          preview: true,
          summary: 'Follow a single URL from the address bar through DNS, HTTP and the rendering pipeline.',
          notes: '## How the web works\n\n- DNS turns a domain into an IP address.\n- The browser sends an HTTP request; the server answers with a status code, headers and a body.\n- HTML is parsed into the DOM, CSS into the CSSOM, and both are combined to lay out and paint the page.',
          workspace: {
            mode: 'web',
            prompt: 'Add a <p> under the heading that describes what a browser does when it receives HTML.',
            check: { file: 'html', pattern: /<p[\s>][\s\S]*?<\/p>/i, success: 'The parser now creates a paragraph node in the DOM for your text.' },
            files: [
              { id: 'html', name: 'index.html', language: 'html', code: '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8">\n    <title>Request → Response</title>\n  </head>\n  <body>\n    <h1>What the browser received</h1>\n  </body>\n</html>' },
              { id: 'css', name: 'style.css', language: 'css', code: 'body {\n  font-family: system-ui, sans-serif;\n  padding: 1.5rem;\n  line-height: 1.5;\n}' },
              { id: 'js', name: 'script.js', language: 'javascript', code: 'console.log("DOM ready with", document.body.children.length, "top-level elements");' }
            ]
          }
        },
        {
          id: 'fs-02',
          title: 'HTML and CSS: structure first, then layout',
          duration: '22 min',
          summary: 'Use semantic elements for meaning and Flexbox for layout, and see how the cascade decides which rule wins.',
          notes: '## Structure, then layout\n\n- Choose elements for meaning: header, nav, main, article, footer.\n- `display: flex` lays children out along one axis; `gap` spaces them.\n- When two rules conflict, specificity and source order decide.',
          workspace: {
            mode: 'web',
            prompt: 'Make the .site-header lay its children out in a row with space between them.',
            check: { file: 'css', pattern: /justify-content\s*:\s*space-between/i, success: 'Flexbox now distributes the free space between the logo and the navigation.' },
            files: [
              { id: 'html', name: 'index.html', language: 'html', code: '<header class="site-header">\n  <a class="logo" href="#">Tasks</a>\n  <nav>\n    <a href="#">Today</a>\n    <a href="#">Upcoming</a>\n  </nav>\n</header>' },
              { id: 'css', name: 'style.css', language: 'css', code: '.site-header {\n  display: flex;\n  align-items: center;\n  padding: 1rem 1.25rem;\n  border-bottom: 1px solid #ddd;\n  font-family: system-ui, sans-serif;\n}\n\nnav a {\n  margin-left: 1rem;\n  color: #333;\n}' },
              { id: 'js', name: 'script.js', language: 'javascript', code: '// No JavaScript needed for this lesson.' }
            ]
          }
        },
        {
          id: 'fs-03',
          title: 'JavaScript and the DOM: making pages respond',
          duration: '26 min',
          summary: 'Select elements, listen for events and update the page from state instead of guessing what is on screen.',
          notes: '## Events and state\n\n- Keep the data (state) in variables; render the DOM from it.\n- `addEventListener` registers a callback; the event loop runs it after the click.',
          workspace: {
            mode: 'web',
            prompt: 'Wire the button so each click adds one to the counter and updates the text.',
            check: { file: 'js', pattern: /addEventListener\s*\(\s*["']click["']/i, success: 'Your listener is registered — every click now queues your callback on the event loop.' },
            files: [
              { id: 'html', name: 'index.html', language: 'html', code: '<section class="counter">\n  <p id="count">0</p>\n  <button id="add">Add one</button>\n</section>' },
              { id: 'css', name: 'style.css', language: 'css', code: '.counter {\n  font-family: system-ui, sans-serif;\n  text-align: center;\n  padding: 2rem;\n}\n#count {\n  font-size: 3rem;\n  margin-bottom: 1rem;\n}' },
              { id: 'js', name: 'script.js', language: 'javascript', code: 'let count = 0;\nconst display = document.getElementById("count");\nconst button = document.getElementById("add");\n\n// Listen for clicks on button, add one to count,\n// then write count into display.textContent\n' }
            ]
          }
        },
        {
          id: 'fs-04',
          title: 'Git and GitHub: saving and sharing your work',
          duration: '18 min',
          summary: 'Commit snapshots, work on branches and push to a shared remote without losing work.',
          workspace: {
            mode: 'read',
            prompt: 'Read the workflow line by line. Place your cursor on each command to see what Git changes on disk.',
            files: [
              { id: 'sh', name: 'workflow.sh', language: 'shell', code: '# Start tracking a project\ngit init\ngit add index.html style.css\ngit commit -m "First version of the portfolio"\n\n# Work on a feature without touching main\ngit switch -c feature/contact-form\ngit add .\ngit commit -m "Add contact form"\n\n# Share it\ngit push -u origin feature/contact-form' }
            ]
          }
        }
      ]
    },
    {
      id: 'fs-m2',
      title: 'Frontend with React',
      lessons: [
        {
          id: 'fs-05',
          title: 'Components, props and state',
          duration: '28 min',
          summary: 'Split an interface into components, pass data down with props and keep changing data in state.',
          workspace: {
            mode: 'read',
            prompt: 'React needs a build step, so this file is for reading. Move through it line by line.',
            files: [
              { id: 'jsx', name: 'NoteList.jsx', language: 'javascript', code: 'import { useState } from "react";\n\nexport function NoteList({ initialNotes }) {\n  const [notes, setNotes] = useState(initialNotes);\n\n  const addNote = (text) => {\n    setNotes([...notes, { id: Date.now(), text }]);\n  };\n\n  return (\n    <ul>\n      {notes.map((note) => (\n        <li key={note.id}>{note.text}</li>\n      ))}\n    </ul>\n  );\n}' }
            ]
          }
        },
        {
          id: 'fs-06',
          title: 'Fetching data: promises and async/await',
          duration: '24 min',
          summary: 'Request data without freezing the page, and understand what actually pauses when you write await.',
          notes: '## async / await\n\n- An async function always returns a Promise.\n- `await` pauses only the current function; the rest of the page keeps running.\n- Wrap awaits in try/catch so a failed request does not break the UI.',
          workspace: {
            mode: 'web',
            prompt: 'Run the code, then place your cursor on the line with await and read what the runtime does.',
            check: { file: 'js', pattern: /await\s+fetchUser\s*\(/, success: 'The function pauses at await, the page stays responsive, and it resumes when the Promise settles.' },
            annotations: {
              'const user = await fetchUser(1);': {
                title: 'Waiting for a Promise without blocking the page',
                says: 'Call fetchUser(1), wait for the Promise it returns to settle, then store the resolved value in a new constant called user.',
                runtime: 'fetchUser runs immediately and returns a pending Promise. await suspends showUser at this line and hands control back to the event loop, so clicks, rendering and other code keep running. When the timer inside fetchUser fires and the Promise resolves, the rest of showUser is queued as a microtask and continues with the resolved object.',
                why: 'Network requests take an unknown amount of time. await lets you write the steps in reading order without freezing the interface while you wait.',
                next: 'If the Promise resolves, user holds { id, name } and the next line renders it. If it rejects, execution jumps straight to the catch block below.',
                analogy: 'Ordering at a counter and getting a buzzer: you step aside instead of blocking the queue, and come back when it buzzes.'
              }
            },
            files: [
              { id: 'html', name: 'index.html', language: 'html', code: '<article class="profile">\n  <h2 id="name">Loading…</h2>\n  <p id="status">Waiting for the server</p>\n</article>' },
              { id: 'css', name: 'style.css', language: 'css', code: '.profile {\n  font-family: system-ui, sans-serif;\n  padding: 1.5rem;\n}' },
              { id: 'js', name: 'script.js', language: 'javascript', code: '// Simulates a server that answers after 600 ms\nfunction fetchUser(id) {\n  return new Promise((resolve) => {\n    setTimeout(() => resolve({ id, name: "Ada Lovelace" }), 600);\n  });\n}\n\nasync function showUser() {\n  try {\n    const user = await fetchUser(1);\n    document.getElementById("name").textContent = user.name;\n    document.getElementById("status").textContent = "Loaded";\n  } catch (error) {\n    console.error("Could not load user:", error);\n  }\n}\n\nshowUser();\nconsole.log("This line runs before the user arrives");' }
            ]
          }
        }
      ]
    },
    {
      id: 'fs-m3',
      title: 'Backend, data and deployment',
      lessons: [
        {
          id: 'fs-07',
          title: 'Building a REST API with Node.js and Express',
          duration: '30 min',
          summary: 'Define routes, read request data, return JSON and use status codes that clients can rely on.',
          workspace: {
            mode: 'read',
            prompt: 'Server code runs in Node.js, not in the browser. Read each line to see what Express does with an incoming request.',
            files: [
              { id: 'js', name: 'server.js', language: 'javascript', code: 'const express = require("express");\nconst app = express();\n\napp.use(express.json());\n\nconst tasks = [];\n\napp.get("/api/tasks", (req, res) => {\n  res.json(tasks);\n});\n\napp.post("/api/tasks", (req, res) => {\n  const task = { id: tasks.length + 1, title: req.body.title };\n  tasks.push(task);\n  res.status(201).json(task);\n});\n\napp.listen(process.env.PORT || 3000);' }
            ]
          }
        },
        {
          id: 'fs-08',
          title: 'Databases: modelling and querying with SQL',
          duration: '26 min',
          summary: 'Design tables, connect them with keys and write the queries your API needs.',
          workspace: {
            mode: 'read',
            prompt: 'Read the schema and the queries. Each line explains what the database engine does with it.',
            files: [
              { id: 'sql', name: 'schema.sql', language: 'sql', code: 'CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email TEXT NOT NULL UNIQUE\n);\n\nCREATE TABLE tasks (\n  id SERIAL PRIMARY KEY,\n  user_id INTEGER REFERENCES users(id),\n  title TEXT NOT NULL,\n  done BOOLEAN DEFAULT false\n);\n\nCREATE INDEX idx_tasks_user ON tasks(user_id);\n\nSELECT t.title, t.done\nFROM tasks t\nJOIN users u ON u.id = t.user_id\nWHERE u.email = \'ada@example.com\'\nORDER BY t.id;' }
            ]
          }
        },
        {
          id: 'fs-09',
          title: 'Authentication: passwords, sessions and tokens',
          duration: '28 min',
          summary: 'Hash passwords, issue a token on login and protect routes that need a signed-in user.',
          workspace: {
            mode: 'read',
            prompt: 'Read how a login request is verified. Never store a password you can read back.',
            files: [
              { id: 'js', name: 'auth.js', language: 'javascript', code: 'const bcrypt = require("bcrypt");\nconst jwt = require("jsonwebtoken");\n\nasync function login(req, res) {\n  const user = await db.findUserByEmail(req.body.email);\n  if (!user) return res.status(401).json({ error: "Invalid credentials" });\n\n  const ok = await bcrypt.compare(req.body.password, user.passwordHash);\n  if (!ok) return res.status(401).json({ error: "Invalid credentials" });\n\n  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });\n  res.json({ token });\n}\n\nmodule.exports = { login };' }
            ]
          }
        },
        {
          id: 'fs-10',
          title: 'Deploying to production',
          duration: '24 min',
          summary: 'Package the app in a container, configure it with environment variables and run it on a server.',
          workspace: {
            mode: 'read',
            prompt: 'Read the Dockerfile from top to bottom — each instruction creates a layer in the image.',
            files: [
              { id: 'docker', name: 'Dockerfile', language: 'dockerfile', code: 'FROM node:20-alpine\nWORKDIR /app\n\nCOPY package*.json ./\nRUN npm ci --omit=dev\n\nCOPY . .\n\nENV NODE_ENV=production\nEXPOSE 3000\nUSER node\nCMD ["node", "server.js"]' }
            ]
          }
        }
      ]
    }
  ]
};
