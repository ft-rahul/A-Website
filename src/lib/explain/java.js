import { S, make, unknown, blank, findOpener, enclosingBlocks, truncate } from './shared';

const P = S.PATTERN;

const PRIMITIVES = ['int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short'];

const ANNOTATIONS = {
  Override: ['Tell the compiler this method overrides one from a parent class or interface.', 'If no matching method exists above, compilation fails — catching typos in method names.'],
  RestController: ['Mark this class as a web controller whose return values become HTTP response bodies.', 'At start-up Spring scans for it, creates one instance (a singleton bean) and registers its mapped methods with the dispatcher.'],
  Controller: ['Mark this class as a web controller.', 'Spring creates it as a bean and routes matching requests to its methods.'],
  Service: ['Mark this class as a service bean.', 'Spring creates one instance at start-up and injects it wherever it is required.'],
  Repository: ['Mark this class as a data-access bean.', 'Spring also translates database exceptions into its own consistent exception types.'],
  Component: ['Register this class as a Spring bean.', 'Found by component scanning and created by the container.'],
  Autowired: ['Ask Spring to inject a dependency here.', 'The container finds a bean of the required type and passes it in. Constructor injection makes this implicit.'],
  RequestMapping: ['Set the base URL path for every endpoint in this controller.', 'Combined with method-level mappings to build full routes.'],
  GetMapping: ['Handle HTTP GET requests for this path.', 'Spring’s DispatcherServlet matches the request URL and method, converts path variables and calls this method.'],
  PostMapping: ['Handle HTTP POST requests for this path.', 'The request body is read and converted before the method is called.'],
  PutMapping: ['Handle HTTP PUT requests.', 'Typically replaces a resource.'],
  DeleteMapping: ['Handle HTTP DELETE requests.', 'Typically removes a resource.'],
  PathVariable: ['Bind a segment of the URL path to this parameter.', 'Spring extracts {id} from the URL and converts the text to the parameter type, returning 400 if it cannot.'],
  RequestBody: ['Build this parameter from the JSON request body.', 'Jackson reads the body stream and maps JSON fields onto the object’s fields.'],
  Entity: ['Map this class to a database table.', 'JPA uses it to generate SQL and to turn rows into objects.'],
  Id: ['Mark the primary-key field.', 'JPA uses it to identify each row.'],
  SpringBootApplication: ['Mark the entry point of a Spring Boot application.', 'Enables auto-configuration and component scanning from this package down.'],
  Transactional: ['Run this method inside a database transaction.', 'Spring wraps the call: it commits if the method returns normally and rolls back on a runtime exception.']
};

export const explainJava = (line, ctx) => {
  if (!line) return blank();
  if (/^(\/\/|\/\*|\*)/.test(line)) {
    return make(S.STRUCTURE, {
      title: 'Comment',
      says: `A note: “${truncate(line.replace(/^(\/\/+|\/\*+|\*+\/?)\s?/, ''), 80)}”`,
      runtime: 'Discarded by javac. Comments do not exist in the compiled bytecode.',
      why: 'Explains intent to other developers.',
      next: 'Compilation continues with the next line.'
    });
  }
  if (/^\}/.test(line) && !/^\}\s*(catch|else|finally)\b/.test(line)) {
    const opener = findOpener(ctx.lines, ctx.lineIndex);
    const isMethodEnd = opener && /\)\s*(throws [\w, ]+)?\s*\{$/.test(opener.text) && !/^(if|for|while|switch|try|catch)\b/.test(opener.text);
    return make(S.STRUCTURE, {
      title: opener ? `End of ${truncate(opener.text.replace(/\{\s*$/, '').trim(), 36)}` : 'End of block',
      says: opener ? `Closes the block opened on line ${opener.index + 1}.` : 'Closes a block.',
      runtime: isMethodEnd
        ? 'When execution reaches here the method returns: its stack frame — holding its local variables and parameters — is discarded.'
        : 'Local variables declared inside the block go out of scope here.',
      why: 'Braces define the extent of classes, methods and blocks.',
      next: 'Execution continues after the block.'
    });
  }

  let m;
  if ((m = line.match(/^@(\w+)(\((.*)\))?/))) {
    const info = ANNOTATIONS[m[1]];
    return make(P, {
      title: `@${m[1]}${m[3] ? `(${truncate(m[3], 24)})` : ''}`,
      says: info ? info[0] : `Attach the ${m[1]} annotation to the next declaration.`,
      runtime: info ? info[1] : 'Annotations are metadata. Frameworks read them, usually through reflection at start-up, to decide how to treat the annotated code.',
      why: 'Annotations let frameworks configure behaviour declaratively instead of through boilerplate code.',
      next: 'It applies to the declaration on the following line.'
    });
  }
  if ((m = line.match(/^package\s+([\w.]+);/))) {
    return make(P, {
      title: `Package ${m[1]}`,
      says: `Place this file’s classes in the package ${m[1]}.`,
      runtime: 'The package becomes part of each class’s fully qualified name (for example ' + m[1] + '.Main). Compiled .class files are stored in matching folders, and the class loader finds them by that path.',
      why: 'Packages organise code and prevent name clashes between libraries.',
      next: 'Imports and the class declaration follow.'
    });
  }
  if ((m = line.match(/^import\s+(static\s+)?([\w.*]+);/))) {
    return make(P, {
      title: `Import ${m[2].split('.').pop()}`,
      says: `Let this file refer to ${m[2]} by its short name.`,
      runtime: 'Imports are resolved entirely at compile time. They do not load or run anything — the JVM loads a class only the first time code actually uses it.',
      why: 'Saves writing the fully qualified name everywhere.',
      next: 'The imported name is available throughout this file.'
    });
  }
  if ((m = line.match(/^(public\s+|private\s+|protected\s+)?(abstract\s+|final\s+)?(class|interface|record|enum)\s+(\w+)(.*)/))) {
    const [, , , kind, name, rest] = m;
    const ext = rest.match(/extends\s+([\w<>, ]+?)(\s+implements|\s*\{|$)/);
    const impl = rest.match(/implements\s+([\w<>, ]+)/);
    const runtimeByKind = {
      class: `javac compiles this to ${name}.class. The JVM loads it lazily, the first time it is needed, verifies the bytecode and stores the class metadata. Objects created with new ${name}(...) live on the heap.`,
      interface: `An interface declares methods without (usually) implementing them. Any class that implements ${name} must provide them, so callers can depend on ${name} without knowing the concrete class.`,
      record: `A record is a concise immutable data class. The compiler generates the constructor, accessors, equals, hashCode and toString.`,
      enum: `An enum defines a fixed set of constants, each a singleton instance created when the class loads.`
    };
    return make(P, {
      title: `${kind[0].toUpperCase()}${kind.slice(1)} ${name}`,
      says: `Declare ${kind === 'interface' ? 'an interface' : `a ${kind}`} named ${name}${ext ? ` that extends ${ext[1].trim()}` : ''}${impl ? ` and implements ${impl[1].replace(/\{/, '').trim()}` : ''}.`,
      runtime: runtimeByKind[kind],
      why: kind === 'interface' ? 'Interfaces separate what something can do from how it does it.' : 'Classes are the unit of organisation in Java — all code lives inside one.',
      next: 'Its members are declared inside the braces.'
    });
  }
  if (/public\s+static\s+void\s+main\s*\(/.test(line)) {
    return make(P, {
      title: 'The main method — program entry point',
      says: 'Declare the method the JVM calls to start the program.',
      runtime: 'When you run java with this class, the JVM loads it, finds this exact signature, creates the main thread and pushes the first stack frame. args holds the command-line arguments.',
      why: 'Every standalone Java program needs one place to start.',
      next: 'The statements inside run in order on the main thread.'
    });
  }
  if ((m = line.match(/^System\.(out|err)\.(println|print|printf)\((.*)\);/))) {
    return make(P, {
      title: `Printing to standard ${m[1] === 'out' ? 'output' : 'error'}`,
      says: `Write ${truncate(m[3], 50)} to the ${m[1] === 'out' ? 'console' : 'error stream'}.`,
      runtime: `${/\+/.test(m[3]) ? 'The + operator joins the parts into one String first (the compiler turns it into an efficient concatenation). ' : ''}System.${m[1]} is a PrintStream connected to the process’s ${m[1] === 'out' ? 'stdout' : 'stderr'}; the text is written through the operating system.`,
      why: 'The simplest way to see what a program is doing.',
      next: 'Execution continues with the next statement.'
    });
  }
  if ((m = line.match(/^try\s*\((.+)\)\s*\{?/))) {
    return make(P, {
      title: 'try-with-resources',
      says: `Open ${truncate(m[1], 40)} and close it automatically when the block ends.`,
      runtime: 'The resource must implement AutoCloseable. Whether the block finishes normally or throws, the compiler-generated code calls close() — in reverse order of opening — before any catch runs.',
      why: 'Files, streams and connections are never left open, even on errors.',
      next: 'The block runs with the resource available.'
    });
  }
  if (/^try\s*\{?$/.test(line)) {
    return make(P, { title: 'try block', says: 'Run the following code and watch for exceptions.', runtime: 'If an exception is thrown inside, the JVM looks up the method’s exception table and jumps to the first matching catch.', why: 'To handle failure where you can do something useful about it.', next: 'Statements inside run in order.' });
  }
  if ((m = line.match(/catch\s*\(\s*([\w.| ]+)\s+(\w+)\s*\)/))) {
    const checked = /IOException|SQLException|Exception$/.test(m[1]) && !/Runtime/.test(m[1]);
    return make(P, {
      title: `catch ${m[1]}`,
      says: `If a ${m[1]} is thrown in the try block, handle it here as ${m[2]}.`,
      runtime: `The JVM unwinds the stack to this handler and binds the exception object to ${m[2]}.${checked ? ` ${m[1]} is a checked exception: the compiler forces you to handle or declare it.` : ''}`,
      why: 'To recover or report clearly instead of crashing.',
      next: 'After the catch block, execution continues after the try statement.'
    });
  }
  if ((m = line.match(/^throw\s+new\s+(\w+)\((.*)\);/))) {
    return make(P, { title: `Throwing ${m[1]}`, says: `Create a ${m[1]} and throw it.`, runtime: 'The exception object is created on the heap, capturing the current stack trace. The JVM then unwinds frames until it finds a matching catch; if none exists, the thread terminates and the trace is printed.', why: 'To signal an error the caller must deal with.', next: 'No further statements in this block run.' });
  }
  if ((m = line.match(/^return\s*(.*);/))) {
    return make(P, { title: 'Return', says: m[1] ? `End the method and return ${truncate(m[1], 40)}.` : 'End the method.', runtime: 'The return value is placed on the caller’s operand stack and the current frame is popped.', why: 'Hands the result back to the caller.', next: 'Control returns to the caller.' });
  }
  if ((m = line.match(/^if\s*\((.+)\)/))) {
    return make(P, { title: 'Conditional', says: `Run the block only if ${truncate(m[1], 50)} is true.`, runtime: 'Java requires a real boolean here — there is no truthy/falsy conversion. The bytecode compares and jumps past the block when false.', why: 'To choose a path at runtime.', next: 'If false, the block is skipped (or the else runs).' });
  }
  if ((m = line.match(/^for\s*\(\s*(final\s+)?([\w<>[\]]+)\s+(\w+)\s*:\s*(.+)\)/))) {
    return make(P, { title: `Enhanced for over ${m[4]}`, says: `For each ${m[2]} in ${m[4]}, run the block with it as ${m[3]}.`, runtime: `For arrays the compiler generates an index loop; for collections it calls ${m[4]}.iterator() and loops with hasNext()/next(). Modifying the collection while iterating throws ConcurrentModificationException.`, why: 'The clearest way to visit every element.', next: 'The block runs once per element.' });
  }
  if ((m = line.match(/^(?:private|public|protected)?\s*(static\s+)?(final\s+)?([\w<>[\], ?]+?)\s+(\w+)\s*\(([^)]*)\)\s*(throws\s+[\w, ]+)?\s*\{?$/)) && !/^(if|for|while|switch|return|new)\b/.test(line)) {
    const [, isStatic, , type, name, params] = m;
    const isCtor = type.trim() === '' || /^(public|private|protected)$/.test(type.trim());
    const enclosing = enclosingBlocks(ctx.lines, ctx.lineIndex).find((b) => /\b(class|record|enum)\s+\w+/.test(b.text));
    const className = enclosing ? enclosing.text.match(/\b(class|record|enum)\s+(\w+)/)[2] : null;
    if (className && name === className) {
      return make(P, { title: `Constructor ${name}`, says: `Initialise a new ${name}${params ? ` from ${params}` : ''}.`, runtime: 'new allocates the object on the heap with default field values, then runs this constructor to set it up. A final field must be assigned exactly once here.', why: 'Guarantees every object starts in a valid state.', next: 'Statements inside initialise the fields.' });
    }
    if (isCtor) return unknown('Java');
    return make(P, {
      title: `Method ${name}()`,
      says: `Declare ${isStatic ? 'a static method' : 'a method'} ${name} that takes ${params || 'no parameters'} and returns ${type.trim()}.`,
      runtime: isStatic
        ? 'Static methods belong to the class, not to an instance. Each call creates a new stack frame for its parameters and locals.'
        : 'Instance methods run against a specific object (this). Calls are dispatched at runtime to the most specific override — that is how polymorphism works.',
      why: 'Methods name a unit of behaviour.',
      next: 'The body runs each time the method is called.'
    });
  }
  if ((m = line.match(/^(private|public|protected)?\s*(static\s+)?(final\s+)?([\w<>[\], ?]+?)\s+(\w+)\s*(=\s*(.+))?;$/))) {
    const [, access, isStatic, isFinal, type, name, , value] = m;
    if (/^(return|throw)$/.test(type.trim())) return unknown('Java');
    const prim = PRIMITIVES.includes(type.trim());
    const isField = Boolean(access) || /^(private|public|protected)/.test(line);
    const generics = type.match(/<(.+)>/);
    return make(P, {
      title: `${isField ? 'Field' : 'Variable'} ${name}: ${type.trim()}`,
      says: `Declare ${isFinal ? 'an unchangeable ' : ''}${isField ? 'field' : 'local variable'} ${name} of type ${type.trim()}${value ? ` set to ${truncate(value, 40)}` : ''}.`,
      runtime: prim
        ? `${type.trim()} is a primitive: the value itself is stored ${isField ? 'inside the object' : 'directly in the method’s stack frame'}.`
        : `${type.trim()} is a reference type: ${isField ? 'the object stores' : 'the stack frame stores'} a reference, and the object it points to lives on the heap.${generics ? ` The <${generics[1]}> type argument is checked at compile time and erased in bytecode.` : ''}${/new\s+/.test(value || '') ? ' new allocates that object now.' : ''}${/List\.of|Map\.of|Set\.of/.test(value || '') ? ' List.of creates an immutable list — add() would throw.' : ''}`,
      why: isFinal ? 'final prevents reassignment, making the code easier to reason about.' : 'Static typing lets the compiler catch mistakes before the program runs.',
      next: isStatic ? 'Static fields are shared by every instance.' : `${name} can be used from here on.`
    });
  }
  if ((m = line.match(/^this\.(\w+)\s*=\s*(.+);/))) {
    return make(P, { title: `Setting field ${m[1]}`, says: `Store ${m[2]} in this object’s ${m[1]} field.`, runtime: 'this refers to the object being constructed. The parameter (on the stack) is copied into the field (on the heap) so it outlives this call.', why: 'Parameters and fields often share names; this. disambiguates.', next: 'The field keeps the value for the object’s lifetime.' });
  }
  if (/\.(stream|filter|map|forEach|collect|lines)\(/.test(line)) {
    return make(P, { title: 'Stream pipeline', says: 'Process a sequence of elements step by step.', runtime: 'Streams are lazy: intermediate operations like filter and map only describe work. Nothing runs until a terminal operation such as forEach or collect pulls elements through the whole pipeline one at a time.', why: 'Expresses data transformations declaratively.', next: 'The terminal operation produces the result.', tags: /->/.test(line) ? [{ label: 'Lambda', note: 'x -> ... is compiled to an implementation of a functional interface.' }] : /::/.test(line) ? [{ label: 'Method reference', note: 'Class::method is shorthand for a lambda that calls that method.' }] : [] });
  }
  if ((m = line.match(/^(?:public\s+|abstract\s+|default\s+)*([\w<>[\]]+)\s+(\w+)\s*\(([^)]*)\);$/))) {
    return make(P, {
      title: `Abstract method ${m[2]}()`,
      says: `Declare that implementers must provide ${m[2]}(${m[3]}) returning ${m[1]}.`,
      runtime: 'There is no body, so no bytecode for it here. Each implementing class supplies its own version, and the JVM picks the right one at runtime based on the actual object (dynamic dispatch).',
      why: 'Defines a contract that many classes can fulfil in different ways.',
      next: 'Implementations appear in classes that implement this interface.'
    });
  }
  if (/^\}?\s*else\b/.test(line)) {
    return make(P, { title: 'else', says: 'Otherwise, run this block.', runtime: 'Reached only when the preceding condition was false.', why: 'Handles the remaining case.', next: 'Execution continues after the if/else.' });
  }
  if ((m = line.match(/^([\w.]+)\((.*)\);$/))) {
    return make(P, { title: `Calling ${m[1]}()`, says: `Invoke ${m[1]}.`, runtime: 'A new frame is pushed onto the thread’s stack; this line waits for it to return.', why: 'Delegates work to another method.', next: 'Execution continues when it returns.' });
  }
  return unknown('Java');
};
