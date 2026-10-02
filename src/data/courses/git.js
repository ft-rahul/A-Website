export const git = {
  id: 'git-github',
  title: 'Git and GitHub',
  subtitle: 'Version Control for Real Teams',
  category: 'Tools',
  level: 'Beginner',
  hours: 8,
  price: 2999, // INR
  skills: ['Git'],
  summary: 'Understand commits, branches and remotes well enough to recover from any mistake and collaborate calmly.',
  description:
    'Git becomes simple once you see what it stores. You learn the commit graph, branching and merging, rebasing, resolving conflicts and the pull-request workflow teams use every day.',
  outcomes: [
    'Explain what a commit, a branch and HEAD actually are.',
    'Branch, merge and rebase without fear.',
    'Resolve merge conflicts and undo mistakes safely.',
    'Collaborate through pull requests and code review.'
  ],
  audience: ['Beginners using Git for the first time.', 'Developers who copy commands and hope they work.'],
  projects: [{ title: 'Team repository simulation', description: 'Feature branches, a conflict, a review and a release tag.' }],
  sandbox: {
    mode: 'read',
    prompt: 'Scratch file for Git commands.',
    files: [{ id: 'sh', name: 'git.sh', language: 'shell', code: 'git status' }]
  },
  modules: [
    {
      id: 'gt-m1',
      title: 'Git fundamentals',
      lessons: [
        {
          id: 'gt-01',
          title: 'Commits, branches and HEAD',
          duration: '16 min',
          preview: true,
          summary: 'What Git stores on disk and how branches are just movable pointers.',
          workspace: {
            mode: 'read',
            prompt: 'Move through the commands to see what each one changes in the repository.',
            files: [
              { id: 'sh', name: 'basics.sh', language: 'shell', code: 'git init\ngit status\ngit add README.md\ngit commit -m "Add README"\ngit log --oneline\ngit switch -c feature/login\ngit merge main' }
            ]
          }
        },
        { id: 'gt-02', title: 'Merging, rebasing and conflicts', duration: '18 min', summary: 'Combine work from branches and fix conflicts with confidence.' },
        { id: 'gt-03', title: 'Undoing things safely', duration: '14 min', summary: 'restore, reset, revert and the reflog — which one to use when.' },
        { id: 'gt-04', title: 'Collaborating on GitHub', duration: '16 min', summary: 'Remotes, pull requests, reviews and protected branches.' }
      ]
    }
  ]
};
