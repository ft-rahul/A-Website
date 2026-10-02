export const devops = {
  id: 'devops-engineering',
  title: 'DevOps Engineering',
  subtitle: 'From Development to Deployment',
  category: 'DevOps',
  level: 'Intermediate',
  hours: 34,
  price: 9999, // INR
  skills: ['Linux', 'Git', 'Docker', 'CI/CD', 'Cloud', 'Monitoring'],
  summary:
    'Take code from a developer laptop to a monitored production service with containers, pipelines and repeatable infrastructure.',
  description:
    'DevOps is the work between "it runs on my machine" and "it runs reliably for users". You learn the Linux and Git habits that make automation possible, then containers, continuous integration, cloud deployment, infrastructure as code and the monitoring that tells you when something breaks.',
  outcomes: [
    'Work confidently on a Linux server: processes, permissions, services and logs.',
    'Build small, cache-friendly Docker images and run multi-container apps with Compose.',
    'Write a CI/CD pipeline that tests, builds and deploys on every push.',
    'Describe infrastructure in code instead of clicking through consoles.',
    'Set up metrics, logs and alerts that point to the cause of an incident.'
  ],
  audience: [
    'Developers who want to own the deployment of what they build.',
    'System administrators moving toward automation and containers.',
    'Anyone preparing for a junior DevOps or platform engineering role.'
  ],
  projects: [
    { title: 'Containerised web service', description: 'Dockerfile, Compose stack and a health check for a Node.js API with a database.' },
    { title: 'CI/CD pipeline', description: 'GitHub Actions workflow that tests, builds an image and deploys on merge to main.' },
    { title: 'Observable deployment', description: 'Dashboards and an alert rule for latency and error rate on your own service.' }
  ],
  sandbox: {
    mode: 'read',
    prompt: 'Scratch file. Type shell commands and move the cursor through them to see what each one does.',
    files: [{ id: 'sh', name: 'scratch.sh', language: 'shell', code: '# Type commands here\nls -la\ndocker ps' }]
  },
  modules: [
    {
      id: 'do-m1',
      title: 'Linux and version control for operations',
      lessons: [
        {
          id: 'do-01',
          title: 'The Linux command line for servers',
          duration: '20 min',
          preview: true,
          summary: 'Navigate, inspect processes, read logs and change permissions on a remote machine.',
          workspace: {
            mode: 'read',
            prompt: 'Place your cursor on each command to see what the kernel and the shell actually do.',
            files: [
              { id: 'sh', name: 'server-checks.sh', language: 'shell', code: '#!/usr/bin/env bash\n# Where am I and what is running?\ncd /var/log\nls -la\nps aux | grep node\n\n# Make the deploy script executable\nchmod +x deploy.sh\n\n# Is the service healthy?\nsudo systemctl status nginx\ntail -n 50 /var/log/nginx/error.log' }
            ]
          }
        },
        {
          id: 'do-02',
          title: 'Git workflows that automation can rely on',
          duration: '16 min',
          summary: 'Branches, pull requests and tags as the triggers for builds and releases.'
        }
      ]
    },
    {
      id: 'do-m2',
      title: 'Containers',
      lessons: [
        {
          id: 'do-03',
          title: 'Docker images and containers',
          duration: '26 min',
          summary: 'Write a Dockerfile, understand layers and caching, and keep images small.',
          workspace: {
            mode: 'read',
            prompt: 'Read the Dockerfile. Notice why dependencies are copied before the source code.',
            files: [
              { id: 'docker', name: 'Dockerfile', language: 'dockerfile', code: 'FROM node:20-alpine\nWORKDIR /app\n\nCOPY package*.json ./\nRUN npm ci --omit=dev\n\nCOPY . .\nENV NODE_ENV=production\nEXPOSE 3000\nHEALTHCHECK CMD wget -qO- http://localhost:3000/health || exit 1\nUSER node\nCMD ["node", "server.js"]' }
            ]
          }
        },
        {
          id: 'do-04',
          title: 'Multi-container apps with Docker Compose',
          duration: '22 min',
          summary: 'Run an API and its database together with networking, volumes and environment variables.',
          workspace: {
            mode: 'read',
            prompt: 'Read the Compose file. Each service becomes a container on a shared network.',
            files: [
              { id: 'yaml', name: 'compose.yaml', language: 'yaml', code: 'services:\n  api:\n    build: .\n    ports:\n      - "3000:3000"\n    environment:\n      DATABASE_URL: postgres://app:secret@db:5432/app\n    depends_on:\n      - db\n  db:\n    image: postgres:16\n    volumes:\n      - db-data:/var/lib/postgresql/data\n\nvolumes:\n  db-data:' }
            ]
          }
        }
      ]
    },
    {
      id: 'do-m3',
      title: 'Pipelines, cloud and monitoring',
      lessons: [
        {
          id: 'do-05',
          title: 'Continuous integration and delivery with GitHub Actions',
          duration: '28 min',
          summary: 'Test and build on every push, and deploy automatically when main changes.',
          workspace: {
            mode: 'read',
            prompt: 'Read the workflow. GitHub starts a fresh virtual machine for each job.',
            files: [
              { id: 'yaml', name: '.github/workflows/ci.yml', language: 'yaml', code: 'name: CI\n\non:\n  push:\n    branches: [main]\n  pull_request:\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - run: npm ci\n      - run: npm test' }
            ]
          }
        },
        {
          id: 'do-06',
          title: 'Cloud fundamentals: compute, networking and storage',
          duration: '24 min',
          summary: 'The building blocks every cloud provider offers, and how a request reaches your container.'
        },
        {
          id: 'do-07',
          title: 'Infrastructure as code',
          duration: '22 min',
          summary: 'Describe servers, networks and permissions in versioned files and apply changes safely.'
        },
        {
          id: 'do-08',
          title: 'Monitoring, logs and alerts',
          duration: '20 min',
          summary: 'Measure latency, errors and saturation, and alert on symptoms users actually feel.'
        }
      ]
    }
  ]
};
