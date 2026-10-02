import { S, make, unknown, blank, truncate } from './shared';

const P = S.PATTERN;

const GIT = {
  init: ['Create a new repository', 'Creates a hidden .git folder holding the object database (every version of every file, compressed and addressed by its hash), refs for branches, and HEAD — a pointer to the current branch.'],
  clone: ['Copy a remote repository', 'Downloads the complete history, creates a remote called origin, and checks out the default branch.'],
  status: ['Show what has changed', 'Compares three trees: the last commit (HEAD), the staging area (index) and your working files, and reports differences between them. Nothing is changed.'],
  add: ['Stage changes', 'Hashes the file contents, stores them as blob objects in .git/objects, and records them in the index — the draft of your next commit.'],
  commit: ['Record a snapshot', 'Writes a tree object from the index and a commit object pointing to that tree, the parent commit, the author and the message. The current branch pointer then moves to the new commit.'],
  push: ['Upload commits', 'Sends commits the remote does not have, then asks it to move its branch pointer. It is refused if the remote has commits you have not pulled.'],
  pull: ['Download and integrate', 'Runs git fetch to download new commits, then merges (or rebases) them into your current branch.'],
  fetch: ['Download without changing your work', 'Updates remote-tracking branches like origin/main. Your own branches and files stay untouched.'],
  switch: ['Change branch', 'Moves HEAD to another branch and updates your working files to match its latest commit. -c creates the branch first, pointing at the current commit.'],
  checkout: ['Switch branches or restore files', 'An older multi-purpose command; for branches it moves HEAD and updates files, like git switch.'],
  branch: ['List or create branches', 'A branch is just a small file containing a commit hash. Creating one is instant and copies nothing.'],
  merge: ['Combine another branch into this one', 'Finds the common ancestor, combines both sets of changes, and creates a merge commit with two parents — or simply moves the pointer forward if no divergence exists (fast-forward).'],
  rebase: ['Replay commits on a new base', 'Re-creates your commits one by one on top of another commit. They get new hashes, so never rebase commits others already have.'],
  log: ['Show history', 'Walks parent links from HEAD backwards and prints each commit.'],
  diff: ['Show line-by-line changes', 'Compares two trees (by default your files against the index).'],
  reset: ['Move the branch pointer', 'Moves the current branch to another commit; --hard also overwrites your files, discarding uncommitted work.'],
  revert: ['Undo by adding a commit', 'Creates a new commit that applies the inverse of an earlier one — safe for shared history.'],
  stash: ['Shelve changes', 'Saves uncommitted changes in a special commit and restores a clean working tree.'],
  tag: ['Name a commit', 'Creates a fixed label, typically for releases.'],
  remote: ['Manage remotes', 'Remotes are named URLs, like origin, that push and fetch talk to.']
};

const DOCKER = {
  build: ['Build an image', 'Sends the build context to the Docker daemon, runs each Dockerfile instruction in order and stores the result as layers, reusing cached layers when nothing they depend on changed.'],
  run: ['Start a container', 'Creates a writable layer on top of the image, sets up an isolated filesystem, network and process namespace, and starts the image’s command as process 1 inside it.'],
  ps: ['List running containers', 'Asks the daemon for containers and their status.'],
  images: ['List images', 'Shows locally stored images and their sizes.'],
  exec: ['Run a command in a running container', 'Starts an extra process inside the existing container’s namespaces — useful for debugging.'],
  logs: ['Show container output', 'Prints what the container’s main process wrote to stdout and stderr.'],
  stop: ['Stop a container', 'Sends SIGTERM, waits, then SIGKILL if the process has not exited.'],
  push: ['Upload an image', 'Uploads layers the registry does not already have.'],
  pull: ['Download an image', 'Fetches the image layers from a registry.'],
  compose: ['Manage a multi-container app', 'Reads compose.yaml and creates the networks, volumes and containers it describes.']
};

const COMMANDS = {
  ls: ['List directory contents', 'The shell starts the ls program, which asks the kernel to read the directory entries. -l shows permissions, owner, size and date; -a includes hidden dot-files.'],
  cd: ['Change directory', 'cd is a shell built-in, not a separate program: it changes the current working directory of the shell process itself, so later relative paths resolve from there.'],
  pwd: ['Print working directory', 'Shows the absolute path the shell is currently in.'],
  mkdir: ['Create directories', 'Asks the kernel to create a directory entry. -p creates missing parents and does not fail if it already exists.'],
  rm: ['Remove files', 'Unlinks the directory entry; there is no recycle bin. -r recurses into directories, so double-check the path.'],
  cp: ['Copy files', 'Reads the source and writes a new file.'],
  mv: ['Move or rename', 'Within one filesystem this only changes directory entries — the data is not copied.'],
  cat: ['Print file contents', 'Reads the file and writes it to standard output.'],
  tail: ['Show the end of a file', 'Reads backwards from the end. -n sets how many lines; -f keeps following as the file grows.'],
  grep: ['Search text', 'Reads its input line by line and prints lines matching the pattern.'],
  sort: ['Sort lines', 'Reads all input, sorts it, then writes it out.'],
  uniq: ['Collapse duplicate lines', 'Only adjacent duplicates are merged, which is why it usually follows sort. -c prefixes each line with a count.'],
  chmod: ['Change permissions', 'Updates the file’s mode bits in its inode: read, write and execute for owner, group and others. +x makes it executable; 600 means only the owner can read and write.'],
  chown: ['Change owner', 'Sets the user and group that own the file. Usually requires root.'],
  ps: ['List processes', 'Reads process information from /proc. aux shows every process with its user, CPU and memory.'],
  kill: ['Send a signal', 'Sends a signal (SIGTERM by default) to a process; the process decides how to respond.'],
  sudo: ['Run as another user (root)', 'Checks your permission in the sudoers file, then runs the following command with elevated privileges.'],
  systemctl: ['Control services', 'Talks to systemd, the init system that starts and supervises services. status shows whether it is running, its PID and recent log lines.'],
  echo: ['Print text', 'A shell built-in that writes its arguments to standard output.'],
  curl: ['Make an HTTP request', 'Opens a connection, sends the request and prints the response body. -s hides progress output.'],
  export: ['Set an environment variable', 'Marks the variable to be copied into the environment of every program started from this shell.'],
  ssh: ['Open a remote shell', 'Encrypts a connection to another machine and runs a shell there.'],
  npm: ['Node package manager', 'Installs dependencies into node_modules or runs scripts from package.json.'],
  wget: ['Download a URL', 'Fetches a resource over HTTP.']
};

const operatorTags = (line) => {
  const tags = [];
  if (/\s\|\s/.test(line)) tags.push({ label: '| pipe', note: 'The shell connects one program’s standard output to the next one’s standard input. Both run at the same time, streaming data between them.' });
  if (/\s>>\s/.test(line)) tags.push({ label: '>> append', note: 'Redirects output to the end of the file instead of the terminal.' });
  else if (/\s>\s/.test(line)) tags.push({ label: '> redirect', note: 'Sends output to a file, replacing its contents.' });
  if (/\s&&\s/.test(line)) tags.push({ label: '&&', note: 'Runs the next command only if the previous one exited with status 0 (success).' });
  if (/\s\|\|\s/.test(line)) tags.push({ label: '||', note: 'Runs the next command only if the previous one failed.' });
  return tags;
};

export const explainShell = (line) => {
  if (!line) return blank();
  if (/^#!/.test(line)) {
    return make(P, {
      title: 'Shebang',
      says: `Run this script with ${line.slice(2).trim()}.`,
      runtime: 'When the file is executed, the kernel reads these first bytes and starts the named interpreter, passing the script path to it. /usr/bin/env looks the interpreter up on PATH.',
      why: 'Makes the script runnable directly as ./script.sh.',
      next: 'The interpreter reads the rest of the file.'
    });
  }
  if (/^#/.test(line)) {
    return make(S.STRUCTURE, { title: 'Comment', says: `“${truncate(line.replace(/^#\s?/, ''), 80)}”`, runtime: 'The shell ignores everything after # on a line.', why: 'Explains what the next commands are for.', next: 'The next line is executed.' });
  }

  const tags = operatorTags(line);
  const first = line.replace(/^sudo\s+/, '');
  const words = first.split(/\s+/);
  const cmd = words[0];

  if (cmd === 'git' && GIT[words[1]]) {
    const [title, runtime] = GIT[words[1]];
    const msg = line.match(/-m\s+["'](.+?)["']/);
    return make(P, {
      title: `git ${words[1]} — ${title}`,
      says: `${title}${words.slice(2).length ? ` (${truncate(words.slice(2).join(' '), 50)})` : ''}.`,
      runtime,
      why: msg ? `The message “${msg[1]}” explains the change to whoever reads the history later.` : 'Git keeps every version, so mistakes are recoverable and work can happen in parallel.',
      next: 'The command exits; Git’s state on disk is updated.',
      tags
    });
  }
  if (cmd === 'docker' && DOCKER[words[1]]) {
    const [title, runtime] = DOCKER[words[1]];
    return make(P, { title: `docker ${words[1]} — ${title}`, says: `${title}.`, runtime, why: 'Containers package an application with everything it needs so it runs the same everywhere.', next: 'The Docker CLI sends the request to the daemon and prints the result.', tags });
  }
  if (COMMANDS[cmd]) {
    const [title, runtime] = COMMANDS[cmd];
    const args = words.slice(1).join(' ');
    return make(P, {
      title: `${line.startsWith('sudo') ? 'sudo ' : ''}${cmd} — ${title}`,
      says: `${title}${args ? `: ${truncate(args, 60)}` : ''}.`,
      runtime: `${line.startsWith('sudo') ? 'sudo first verifies you may run commands as root. ' : ''}${cmd === 'cd' || cmd === 'echo' || cmd === 'export' ? '' : 'The shell searches PATH for the program, forks a child process and executes it, then waits for its exit status. '}${runtime}`,
      why: 'Each small tool does one job; the shell combines them.',
      next: 'When it finishes, $? holds its exit status (0 means success).',
      tags
    });
  }
  return unknown('shell');
};

const DOCKERFILE = {
  FROM: ['Choose the base image', 'Every image starts from another. The base image’s layers are downloaded once and shared by every image built on them.'],
  WORKDIR: ['Set the working directory', 'Creates the directory if needed; later RUN, COPY and CMD instructions run relative to it.'],
  COPY: ['Copy files into the image', 'Files from the build context are added as a new layer. If the copied files are unchanged since the last build, Docker reuses the cached layer — and every layer after it.'],
  ADD: ['Copy files (with extras)', 'Like COPY but can also unpack archives and download URLs. Prefer COPY for clarity.'],
  RUN: ['Run a command at build time', 'Starts a temporary container from the current layers, runs the command, and saves the resulting filesystem changes as a new layer.'],
  ENV: ['Set an environment variable', 'Stored in the image configuration and present in every container started from it.'],
  ARG: ['Declare a build argument', 'Available only while building; not present in running containers.'],
  EXPOSE: ['Document a port', 'Metadata only — it does not publish the port. You still map it with -p or in Compose.'],
  USER: ['Drop privileges', 'Following instructions and the container’s process run as this user instead of root, limiting damage if the app is compromised.'],
  CMD: ['Default command', 'Not run at build time. When a container starts, this becomes process 1. The JSON array form runs the program directly, so it receives stop signals properly.'],
  ENTRYPOINT: ['Fixed executable', 'The container always runs this; CMD then supplies default arguments.'],
  HEALTHCHECK: ['Health check', 'Docker runs this command periodically inside the container and marks it healthy or unhealthy based on the exit code.']
};

export const explainDockerfile = (line, ctx) => {
  if (!line) return blank();
  if (/^#/.test(line)) return make(S.STRUCTURE, { title: 'Comment', says: truncate(line.slice(1).trim(), 80), runtime: 'Ignored by the builder.', why: '', next: '' });
  const m = line.match(/^([A-Z]+)\s+(.*)/);
  if (!m || !DOCKERFILE[m[1]]) return unknown('Dockerfile');
  const [title, runtime] = DOCKERFILE[m[1]];
  let why = 'Each instruction is one step in building the image.';
  if (m[1] === 'COPY' && /package/.test(m[2])) why = 'Copying only the dependency manifest first means the slow install step below stays cached until dependencies actually change.';
  if (m[1] === 'COPY' && m[2].startsWith('. ')) why = 'The source code changes most often, so it is copied after dependencies are installed to keep those layers cached.';
  if (m[1] === 'RUN' && /npm ci/.test(m[2])) why = 'npm ci installs exactly what package-lock.json specifies — reproducible builds. --omit=dev leaves out test and build tools.';
  if (m[1] === 'FROM' && /alpine/.test(m[2])) why = 'Alpine variants are much smaller, which means faster pulls and fewer packages to patch.';
  const later = ctx.lines.slice(ctx.lineIndex + 1).filter((l) => /^(COPY|RUN|ADD)\b/.test(l.trim())).length;
  return make(P, {
    title: `${m[1]} — ${title}`,
    says: `${title}: ${truncate(m[2], 60)}.`,
    runtime,
    why,
    next: /^(COPY|RUN|ADD)$/.test(m[1]) && later ? `If this layer changes, the ${later} layer-creating instruction${later > 1 ? 's' : ''} below must be rebuilt too.` : 'The builder moves on to the next instruction.'
  });
};

const YAML_KEYS = {
  name: 'A human-readable name shown in the UI and logs.',
  on: 'The events that trigger this workflow — GitHub listens for them and starts a run.',
  push: 'Run when commits are pushed.',
  pull_request: 'Run when a pull request is opened or updated, so changes are checked before they merge.',
  branches: 'Limit the trigger to these branches.',
  jobs: 'Jobs run in parallel by default, each on its own fresh machine.',
  'runs-on': 'The type of virtual machine GitHub provisions for this job. It starts clean every time — nothing carries over unless you cache it.',
  steps: 'Steps run in order on the same machine, sharing its filesystem.',
  uses: 'Run a published action — reusable code from another repository, pinned to a version.',
  run: 'Run a shell command on the job’s machine. A non-zero exit code fails the step and the job.',
  with: 'Inputs passed to the action.',
  services: 'Each service becomes a container. Compose puts them on a shared network where they reach each other by service name.',
  build: 'Build this service’s image from a Dockerfile in the given directory.',
  image: 'Use an existing image from a registry.',
  ports: 'Publish container ports on the host as "host:container".',
  environment: 'Environment variables set inside the container.',
  depends_on: 'Start the listed services first. It waits for them to start, not to be ready.',
  volumes: 'Persist data outside the container’s writable layer, so it survives restarts and re-creation.'
};

export const explainYaml = (line, ctx) => {
  if (!line) return blank();
  if (/^#/.test(line)) return make(S.STRUCTURE, { title: 'Comment', says: truncate(line.slice(1).trim(), 80), runtime: 'Ignored by the YAML parser.', why: '', next: '' });
  const indent = (ctx.raw.match(/^\s*/) || [''])[0].length;
  const item = line.match(/^-\s+(.*)/);
  const body = item ? item[1] : line;
  const kv = body.match(/^([\w-]+|"[^"]+")\s*:\s*(.*)$/);
  const key = kv ? kv[1].replace(/"/g, '') : null;
  const value = kv ? kv[2] : body;

  if (key && YAML_KEYS[key]) {
    return make(P, {
      title: `${item ? '- ' : ''}${key}${value ? `: ${truncate(value, 30)}` : ''}`,
      says: value ? `Set ${key} to ${value}.` : `Begin the ${key} section.`,
      runtime: YAML_KEYS[key] + (key === 'run' && /npm test/.test(value) ? ' If any test fails, npm exits non-zero and the pipeline stops here.' : ''),
      why: 'Configuration as a file means it is reviewed, versioned and repeatable.',
      next: value ? 'Indentation decides which section the next line belongs to.' : 'The indented lines below belong to it.',
      tags: item ? [{ label: 'List item', note: 'A leading "-" adds an entry to the list owned by the key above.' }] : []
    });
  }
  if (key) {
    return make(P, {
      title: `${key}${value ? `: ${truncate(value, 30)}` : ''}`,
      says: value ? `Set ${key} to ${value}.` : `Begin a mapping named ${key}.`,
      runtime: `YAML parses this into a key-value pair, nested by indentation (${indent} spaces here). Tabs are not allowed for indentation.`,
      why: 'YAML describes nested configuration as plain text.',
      next: value ? 'The next line at the same indentation is a sibling key.' : 'Indented lines below are its children.',
      tags: /\$\{\{|secret/i.test(value) ? [{ label: 'Secret', note: 'Credentials should come from encrypted secrets, not be written in the file.' }] : []
    });
  }
  if (item) {
    return make(P, {
      title: `List item: ${truncate(body, 36)}`,
      says: `Add ${body} to the list above.`,
      runtime: 'A leading "-" creates a list entry. Quoted values stay strings; "3000:3000" is quoted so older YAML parsers do not read it as a base-60 number.',
      why: 'Lists hold repeated values such as ports, steps or volumes.',
      next: 'More items may follow at the same indentation.'
    });
  }
  return unknown('YAML');
};
