export const react = {
  id: 'react-development',
  title: 'React',
  subtitle: 'Components, State and Real Applications',
  category: 'Frontend',
  level: 'Intermediate',
  hours: 22,
  price: 7499, // INR
  skills: ['React', 'JavaScript', 'Component architecture'],
  summary: 'Build React applications by understanding rendering, state and effects rather than memorising patterns.',
  description:
    'You learn what a render is, why state updates are asynchronous, when effects run and how to structure an application so data flows predictably. The course ends with routing, data fetching and a deployed app.',
  outcomes: [
    'Explain what triggers a render and how React reconciles the DOM.',
    'Place state where it belongs and lift it when components need to share it.',
    'Use effects for synchronisation, not for everything.',
    'Fetch data with loading and error states.',
    'Structure a multi-page application with routing.'
  ],
  audience: [
    'Developers comfortable with JavaScript who are new to React.',
    'React users who want to stop fighting re-renders and effects.'
  ],
  projects: [
    { title: 'Kanban board', description: 'Drag-free task board with lifted state and local persistence.' },
    { title: 'Movie search app', description: 'Routing, data fetching, loading skeletons and error handling.' }
  ],
  sandbox: {
    mode: 'read',
    prompt: 'JSX needs a build step, so this scratch file is explained line by line rather than run.',
    files: [{ id: 'jsx', name: 'App.jsx', language: 'javascript', code: 'export default function App() {\n  return <h1>Hello</h1>;\n}' }]
  },
  modules: [
    {
      id: 'rc-m1',
      title: 'Rendering and state',
      lessons: [
        {
          id: 'rc-01',
          title: 'What a render really is',
          duration: '16 min',
          preview: true,
          summary: 'Components are functions; rendering is calling them; React compares the results and updates the DOM.',
          workspace: {
            mode: 'read',
            prompt: 'Move through the component and see what happens on every render.',
            files: [
              { id: 'jsx', name: 'Counter.jsx', language: 'javascript', code: 'import { useState } from "react";\n\nexport function Counter() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <button onClick={() => setCount(count + 1)}>\n      Clicked {count} times\n    </button>\n  );\n}' }
            ]
          }
        },
        {
          id: 'rc-02',
          title: 'Props, state and lifting state up',
          duration: '20 min',
          summary: 'Decide which component owns a piece of data and pass it down.'
        },
        {
          id: 'rc-03',
          title: 'Effects and when not to use them',
          duration: '22 min',
          summary: 'Synchronise with the outside world, clean up, and avoid effect chains.',
          workspace: {
            mode: 'read',
            prompt: 'Read when the effect runs, and why it returns a cleanup function.',
            files: [
              { id: 'jsx', name: 'useWindowWidth.js', language: 'javascript', code: 'import { useEffect, useState } from "react";\n\nexport function useWindowWidth() {\n  const [width, setWidth] = useState(window.innerWidth);\n\n  useEffect(() => {\n    const onResize = () => setWidth(window.innerWidth);\n    window.addEventListener("resize", onResize);\n    return () => window.removeEventListener("resize", onResize);\n  }, []);\n\n  return width;\n}' }
            ]
          }
        }
      ]
    },
    {
      id: 'rc-m2',
      title: 'Building applications',
      lessons: [
        { id: 'rc-04', title: 'Data fetching with loading and error states', duration: '20 min', summary: 'Request data, handle slow and failed responses, and avoid race conditions.' },
        { id: 'rc-05', title: 'Routing and application structure', duration: '18 min', summary: 'Pages, layouts, nested routes and organising files as the app grows.' },
        { id: 'rc-06', title: 'Performance and deployment', duration: '16 min', summary: 'Memoisation where it matters, code splitting, and shipping a production build.' }
      ]
    }
  ]
};
