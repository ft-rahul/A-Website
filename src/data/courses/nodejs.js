export const nodejs = {
  id: 'nodejs-backend',
  title: 'Backend Development with Node.js',
  subtitle: 'APIs, Data and Authentication',
  category: 'Backend',
  level: 'Intermediate',
  hours: 28,
  price: 7999, // INR
  skills: ['Node.js', 'JavaScript', 'REST APIs', 'SQL', 'Authentication'],
  summary: 'Build reliable HTTP APIs in Node.js: routing, validation, persistence, authentication and testing.',
  description:
    'You start with how Node.js handles many requests on one thread, then build an Express API step by step — validation, a database layer, authentication, error handling, tests and configuration for production.',
  outcomes: [
    'Explain the Node.js event loop and why blocking it hurts every user.',
    'Design REST endpoints with correct methods and status codes.',
    'Validate input and return consistent error responses.',
    'Persist data in PostgreSQL through a clean data layer.',
    'Secure routes with hashed passwords and signed tokens.'
  ],
  audience: [
    'Frontend developers who want to build their own APIs.',
    'JavaScript developers moving to backend roles.'
  ],
  projects: [
    { title: 'Bookmarks API', description: 'CRUD endpoints, validation, PostgreSQL and integration tests.' },
    { title: 'Auth service', description: 'Sign-up, login, password hashing and protected routes.' }
  ],
  sandbox: {
    mode: 'read',
    prompt: 'Server code runs in Node.js, so this scratch file is explained line by line.',
    files: [{ id: 'js', name: 'scratch.js', language: 'javascript', code: 'const http = require("http");' }]
  },
  modules: [
    {
      id: 'nd-m1',
      title: 'Node.js and HTTP',
      lessons: [
        {
          id: 'nd-01',
          title: 'How Node.js handles thousands of requests on one thread',
          duration: '18 min',
          preview: true,
          summary: 'Non-blocking I/O, the event loop, and the kinds of code that freeze a server.',
          workspace: {
            mode: 'read',
            prompt: 'Read the server. Notice which lines run once and which run per request.',
            files: [
              { id: 'js', name: 'server.js', language: 'javascript', code: 'const express = require("express");\nconst app = express();\n\napp.use(express.json());\n\napp.get("/api/health", (req, res) => {\n  res.json({ status: "ok" });\n});\n\napp.get("/api/books/:id", async (req, res) => {\n  const book = await db.findBook(req.params.id);\n  if (!book) return res.status(404).json({ error: "Not found" });\n  res.json(book);\n});\n\napp.listen(process.env.PORT || 3000);' }
            ]
          }
        },
        { id: 'nd-02', title: 'Designing REST endpoints', duration: '20 min', summary: 'Resources, methods, status codes and consistent response shapes.' },
        { id: 'nd-03', title: 'Validation and error handling', duration: '18 min', summary: 'Reject bad input at the edge and centralise error responses.' }
      ]
    },
    {
      id: 'nd-m2',
      title: 'Data and security',
      lessons: [
        { id: 'nd-04', title: 'Persistence with PostgreSQL', duration: '24 min', summary: 'Connection pools, parameterised queries and migrations.' },
        { id: 'nd-05', title: 'Authentication and authorisation', duration: '24 min', summary: 'Password hashing, sessions versus tokens, and protecting routes.' },
        { id: 'nd-06', title: 'Testing and production configuration', duration: '20 min', summary: 'Integration tests, environment variables, logging and graceful shutdown.' }
      ]
    }
  ]
};
