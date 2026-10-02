export const java = {
  id: 'java-development',
  title: 'Java Development',
  subtitle: 'From Fundamentals to Backend',
  category: 'Backend',
  level: 'Beginner → Intermediate',
  hours: 38,
  price: 8999, // INR
  skills: ['Java', 'OOP', 'Spring Boot', 'SQL', 'REST APIs'],
  summary:
    'Learn Java properly — types, objects, collections and exceptions — then use it to build a Spring Boot backend.',
  description:
    'The course starts with how the JVM runs your code and how Java organises programs into classes. You then work through collections, error handling, files and modern language features before building a REST API with Spring Boot that talks to a real database.',
  outcomes: [
    'Explain how source code becomes bytecode and runs on the JVM.',
    'Model problems with classes, interfaces and records.',
    'Choose the right collection and handle errors with exceptions.',
    'Use streams, lambdas and other modern Java features where they help.',
    'Build and test a Spring Boot REST API backed by a relational database.'
  ],
  audience: [
    'Beginners who want a strongly typed first language.',
    'Developers from other languages preparing for Java backend roles.',
    'Students who know Java syntax but have not built a real service.'
  ],
  projects: [
    { title: 'Library manager (console)', description: 'Classes, collections and file persistence without frameworks.' },
    { title: 'Bookstore REST API', description: 'Spring Boot, Spring Data JPA and PostgreSQL with validation and error handling.' }
  ],
  sandbox: {
    mode: 'read',
    prompt: 'Scratch file. Java runs on the JVM, so Monklogy explains it line by line rather than executing it.',
    files: [{ id: 'java', name: 'Scratch.java', language: 'java', code: 'public class Scratch {\n  public static void main(String[] args) {\n    System.out.println("Hello");\n  }\n}' }]
  },
  modules: [
    {
      id: 'jv-m1',
      title: 'Java fundamentals',
      lessons: [
        {
          id: 'jv-01',
          title: 'How Java runs: source, bytecode and the JVM',
          duration: '16 min',
          preview: true,
          summary: 'What javac produces, what the JVM loads, and why Java code runs the same on every operating system.',
          workspace: {
            mode: 'read',
            prompt: 'Move through the program line by line. Each line explains what the compiler and the JVM do.',
            files: [
              { id: 'java', name: 'Main.java', language: 'java', code: 'package com.monklogy.intro;\n\nimport java.util.List;\n\npublic class Main {\n  public static void main(String[] args) {\n    int count = 3;\n    String name = "Ada";\n    List<String> tags = List.of("java", "jvm");\n    System.out.println(name + " has " + count + " tags: " + tags);\n  }\n}' }
            ]
          }
        },
        {
          id: 'jv-02',
          title: 'Classes, objects and interfaces',
          duration: '24 min',
          summary: 'Encapsulation, constructors, interfaces and when to reach for a record.',
          workspace: {
            mode: 'read',
            prompt: 'Read how an interface describes behaviour and a class provides it.',
            files: [
              { id: 'java', name: 'Shapes.java', language: 'java', code: 'public interface Shape {\n  double area();\n}\n\npublic class Circle implements Shape {\n  private final double radius;\n\n  public Circle(double radius) {\n    this.radius = radius;\n  }\n\n  @Override\n  public double area() {\n    return Math.PI * radius * radius;\n  }\n}' }
            ]
          }
        },
        {
          id: 'jv-03',
          title: 'Collections and generics',
          duration: '22 min',
          summary: 'List, Set and Map, what each guarantees, and how generics keep them type-safe.'
        },
        {
          id: 'jv-04',
          title: 'Exceptions and file handling',
          duration: '20 min',
          summary: 'Checked and unchecked exceptions, try-with-resources, and reading and writing files.',
          workspace: {
            mode: 'read',
            prompt: 'Read how try-with-resources closes the file even when something fails.',
            files: [
              { id: 'java', name: 'ReadConfig.java', language: 'java', code: 'import java.io.IOException;\nimport java.nio.file.Files;\nimport java.nio.file.Path;\n\npublic class ReadConfig {\n  public static void main(String[] args) {\n    try (var lines = Files.lines(Path.of("config.txt"))) {\n      lines.filter(l -> !l.isBlank()).forEach(System.out::println);\n    } catch (IOException e) {\n      System.err.println("Could not read config: " + e.getMessage());\n    }\n  }\n}' }
            ]
          }
        },
        {
          id: 'jv-05',
          title: 'Modern Java: records, streams and lambdas',
          duration: '22 min',
          summary: 'Write less boilerplate and express data transformations clearly.'
        }
      ]
    },
    {
      id: 'jv-m2',
      title: 'Backend development with Spring Boot',
      lessons: [
        {
          id: 'jv-06',
          title: 'Your first Spring Boot REST API',
          duration: '28 min',
          summary: 'Controllers, request mapping, dependency injection and JSON serialisation.',
          workspace: {
            mode: 'read',
            prompt: 'Read how Spring routes an HTTP request to a method and turns the return value into JSON.',
            files: [
              { id: 'java', name: 'BookController.java', language: 'java', code: '@RestController\n@RequestMapping("/api/books")\npublic class BookController {\n\n  private final BookService service;\n\n  public BookController(BookService service) {\n    this.service = service;\n  }\n\n  @GetMapping("/{id}")\n  public Book findOne(@PathVariable Long id) {\n    return service.findById(id);\n  }\n\n  @PostMapping\n  public Book create(@RequestBody Book book) {\n    return service.save(book);\n  }\n}' }
            ]
          }
        },
        {
          id: 'jv-07',
          title: 'Persistence with Spring Data JPA',
          duration: '26 min',
          summary: 'Map entities to tables, write repository queries and manage transactions.'
        },
        {
          id: 'jv-08',
          title: 'Validation, errors and testing',
          duration: '24 min',
          summary: 'Reject bad input early, return useful error responses and test controllers and services.'
        }
      ]
    }
  ]
};
