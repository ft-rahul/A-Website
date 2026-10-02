export const databases = {
  id: 'databases-sql',
  title: 'Databases and SQL',
  subtitle: 'Model, Query and Protect Your Data',
  category: 'Backend',
  level: 'Beginner → Intermediate',
  hours: 20,
  price: 6499, // INR
  skills: ['SQL', 'Data modelling'],
  summary: 'Design relational schemas, write the queries applications need and understand what the database does with them.',
  description:
    'You learn to model data in tables, connect it with keys, and query it with joins and aggregates. Then you look under the hood: indexes, query plans, transactions and the constraints that keep data correct.',
  outcomes: [
    'Model a domain as tables with primary and foreign keys.',
    'Write joins, aggregates and subqueries with confidence.',
    'Read a query plan and add the index that fixes a slow query.',
    'Use transactions to keep related changes consistent.'
  ],
  audience: [
    'Developers who use an ORM and want to know what it generates.',
    'Beginners who need SQL for backend or data work.'
  ],
  projects: [
    { title: 'Online shop schema', description: 'Customers, orders and products with constraints and realistic queries.' },
    { title: 'Slow query clinic', description: 'Diagnose and fix slow queries using EXPLAIN and indexes.' }
  ],
  sandbox: {
    mode: 'read',
    prompt: 'Scratch SQL file, explained line by line.',
    files: [{ id: 'sql', name: 'scratch.sql', language: 'sql', code: 'SELECT * FROM users;' }]
  },
  modules: [
    {
      id: 'db-m1',
      title: 'Relational modelling and SQL',
      lessons: [
        {
          id: 'db-01',
          title: 'Tables, keys and relationships',
          duration: '18 min',
          preview: true,
          summary: 'Primary keys, foreign keys and the constraints that stop bad data getting in.',
          workspace: {
            mode: 'read',
            prompt: 'Read the schema and see what each constraint makes the database enforce.',
            files: [
              { id: 'sql', name: 'shop.sql', language: 'sql', code: 'CREATE TABLE customers (\n  id SERIAL PRIMARY KEY,\n  email TEXT NOT NULL UNIQUE\n);\n\nCREATE TABLE orders (\n  id SERIAL PRIMARY KEY,\n  customer_id INTEGER NOT NULL REFERENCES customers(id),\n  total_cents INTEGER NOT NULL,\n  created_at TIMESTAMP DEFAULT now()\n);\n\nINSERT INTO customers (email) VALUES (\'ada@example.com\');' }
            ]
          }
        },
        {
          id: 'db-02',
          title: 'Querying: filters, joins and aggregates',
          duration: '24 min',
          summary: 'Combine tables and summarise data with GROUP BY.',
          workspace: {
            mode: 'read',
            prompt: 'Read the query in the order the database evaluates it.',
            files: [
              { id: 'sql', name: 'report.sql', language: 'sql', code: 'SELECT c.email, COUNT(o.id) AS orders, SUM(o.total_cents) AS spent\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE c.email LIKE \'%@example.com\'\nGROUP BY c.email\nHAVING COUNT(o.id) > 0\nORDER BY spent DESC\nLIMIT 10;' }
            ]
          }
        }
      ]
    },
    {
      id: 'db-m2',
      title: 'Under the hood',
      lessons: [
        { id: 'db-03', title: 'Indexes and query plans', duration: '20 min', summary: 'How B-tree indexes work and how to read EXPLAIN output.' },
        { id: 'db-04', title: 'Transactions and consistency', duration: '18 min', summary: 'ACID, isolation levels and avoiding lost updates.' },
        { id: 'db-05', title: 'Using databases from application code', duration: '16 min', summary: 'Parameterised queries, connection pools and migrations.' }
      ]
    }
  ]
};
