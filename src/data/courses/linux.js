export const linux = {
  id: 'linux-fundamentals',
  title: 'Linux Fundamentals',
  subtitle: 'The Command Line for Developers',
  category: 'Tools',
  level: 'Beginner',
  hours: 12,
  price: 3999, // INR
  skills: ['Linux'],
  summary: 'Get comfortable in a terminal: files, permissions, processes, pipes and the tools servers are managed with.',
  description:
    'Almost every server runs Linux. This course teaches the shell as a tool you think with — navigating, combining commands with pipes, managing processes and permissions, and writing small scripts that automate repetitive work.',
  outcomes: [
    'Navigate and manipulate files from the terminal.',
    'Read and change permissions and ownership.',
    'Inspect and control processes and services.',
    'Combine commands with pipes and redirection.',
    'Write small Bash scripts to automate tasks.'
  ],
  audience: ['Developers who avoid the terminal.', 'Anyone about to manage their first server.'],
  projects: [{ title: 'Log analysis script', description: 'A Bash script that summarises errors from a web server log.' }],
  sandbox: {
    mode: 'read',
    prompt: 'Scratch shell file.',
    files: [{ id: 'sh', name: 'scratch.sh', language: 'shell', code: 'pwd' }]
  },
  modules: [
    {
      id: 'lx-m1',
      title: 'Working in the shell',
      lessons: [
        {
          id: 'lx-01',
          title: 'Files, paths and permissions',
          duration: '16 min',
          preview: true,
          summary: 'The filesystem tree, absolute and relative paths, and what rwx really means.',
          workspace: {
            mode: 'read',
            prompt: 'Move through each command to see what the shell and the kernel do.',
            files: [
              { id: 'sh', name: 'files.sh', language: 'shell', code: 'pwd\ncd ~/projects\nmkdir -p notes/2026\nls -la\nchmod 600 secrets.env\nchown deploy:deploy app.log' }
            ]
          }
        },
        {
          id: 'lx-02',
          title: 'Pipes, redirection and text tools',
          duration: '18 min',
          summary: 'Chain small tools together to answer real questions about your data.',
          workspace: {
            mode: 'read',
            prompt: 'Read how data flows from one command to the next.',
            files: [
              { id: 'sh', name: 'pipes.sh', language: 'shell', code: 'grep "ERROR" app.log | sort | uniq -c > errors.txt\ncat errors.txt\necho "done" >> run.log\ncurl -s https://example.com/health && echo "healthy"' }
            ]
          }
        },
        { id: 'lx-03', title: 'Processes and services', duration: '16 min', summary: 'ps, signals, systemd and reading logs with journalctl.' },
        { id: 'lx-04', title: 'Shell scripting basics', duration: '18 min', summary: 'Variables, conditionals, loops and exit codes in Bash.' }
      ]
    }
  ]
};
