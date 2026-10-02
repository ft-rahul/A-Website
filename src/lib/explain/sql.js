import { S, make, unknown, blank, truncate } from './shared';

const P = S.PATTERN;

const insideCreateTable = (lines, idx) => {
  for (let i = idx - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (/^\);?$/.test(t)) return null;
    const m = t.match(/^CREATE TABLE\s+(\w+)/i);
    if (m) return m[1];
  }
  return null;
};

const CLAUSES = [
  [/^SELECT\b(.*)/i, (m) => ({
    title: 'SELECT — choose the output columns',
    says: `Return ${truncate(m[1].trim() || 'columns', 60)}.`,
    runtime: 'Although written first, SELECT is evaluated late: the database first works out the rows (FROM, JOIN, WHERE, GROUP BY, HAVING), then computes these output expressions, then sorts and limits. That is why column aliases defined here cannot be used in WHERE.',
    why: 'Asking only for the columns you need reduces data read and sent.',
    next: 'FROM tells it where the rows come from.'
  })],
  [/^FROM\s+(\w+)(\s+\w+)?/i, (m) => ({
    title: `FROM ${m[1]}`,
    says: `Read rows from the ${m[1]} table${m[2] ? `, referred to as ${m[2].trim()}` : ''}.`,
    runtime: 'The query planner decides how to read the table — a full sequential scan or an index scan — based on statistics about the data and the filters below.',
    why: 'Every query starts from a set of rows.',
    next: 'Joins and filters narrow or extend that set.'
  })],
  [/^(INNER\s+|LEFT\s+|RIGHT\s+|FULL\s+)?(OUTER\s+)?JOIN\s+(\w+)(\s+\w+)?\s+ON\s+(.+)/i, (m) => ({
    title: `${(m[1] || 'INNER ').trim().toUpperCase()} JOIN ${m[3]}`,
    says: `Combine each row with rows from ${m[3]} where ${m[5].replace(/;$/, '')}.`,
    runtime: `The planner picks a join algorithm — nested loop, hash join or merge join — depending on table sizes and indexes.${/LEFT/i.test(m[1] || '') ? ' A LEFT JOIN keeps every row from the left side; where no match exists the right-side columns are NULL.' : ' An inner join keeps only rows that have a match on both sides.'}`,
    why: 'Related data lives in separate tables; joins bring it back together.',
    next: 'WHERE then filters the combined rows.'
  })],
  [/^WHERE\s+(.+)/i, (m) => ({
    title: 'WHERE — filter rows',
    says: `Keep only rows where ${truncate(m[1].replace(/;$/, ''), 60)}.`,
    runtime: `Applied before grouping. If an index covers the column being compared, the database can jump straight to matching rows instead of checking every one.${/LIKE\s+'%/i.test(m[1]) ? ' A pattern starting with % cannot use a normal B-tree index, so this filter scans.' : ''}`,
    why: 'Filtering in the database avoids sending unnecessary rows to the application.',
    next: 'Remaining rows move on to grouping, ordering or output.'
  })],
  [/^GROUP BY\s+(.+)/i, (m) => ({ title: 'GROUP BY', says: `Collapse rows that share ${m[1]} into one row per group.`, runtime: 'The database sorts or hashes rows by the grouping key, then aggregate functions like COUNT and SUM are computed once per group.', why: 'Turns detailed rows into summaries.', next: 'HAVING can filter the groups.' })],
  [/^HAVING\s+(.+)/i, (m) => ({ title: 'HAVING — filter groups', says: `Keep only groups where ${m[1]}.`, runtime: 'Runs after grouping, so — unlike WHERE — it can use aggregate results.', why: 'To filter on totals and counts.', next: 'Then the output columns are computed.' })],
  [/^ORDER BY\s+(.+)/i, (m) => ({ title: 'ORDER BY', says: `Sort the results by ${m[1].replace(/;$/, '')}.`, runtime: 'Without ORDER BY, SQL guarantees no particular order. Sorting large results may spill to disk unless an index already provides the order.', why: 'Predictable results for users and pagination.', next: 'LIMIT may cut the sorted list short.' })],
  [/^LIMIT\s+(\d+)/i, (m) => ({ title: `LIMIT ${m[1]}`, says: `Return at most ${m[1]} rows.`, runtime: 'Combined with ORDER BY and an index, the database can stop early instead of producing every row.', why: 'Keeps responses small.', next: 'The query ends.' })],
  [/^CREATE TABLE\s+(\w+)/i, (m) => ({ title: `CREATE TABLE ${m[1]}`, says: `Define a new table called ${m[1]}.`, runtime: 'The database records the table’s structure in its system catalog and allocates storage. Constraints declared here are enforced on every future insert and update.', why: 'The schema is the contract every row must satisfy.', next: 'Column definitions follow inside the parentheses.' })],
  [/^CREATE\s+(UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+(\w+)\s*\((.+)\)/i, (m) => ({ title: `Index ${m[2]}`, says: `Build an index on ${m[3]}(${m[4]}).`, runtime: 'The database builds a B-tree sorted by the column, so lookups take logarithmic time instead of scanning the table. The cost: every insert or update also updates the index.', why: 'Speeds up the WHERE clauses and joins that filter on this column.', next: 'The planner may now choose an index scan.' })],
  [/^INSERT INTO\s+(\w+)\s*\(([^)]*)\)/i, (m) => ({ title: `INSERT INTO ${m[1]}`, says: `Add a row to ${m[1]}, setting ${m[2]}.`, runtime: 'Constraints are checked (NOT NULL, UNIQUE, foreign keys), defaults fill omitted columns, the row is written, and every index on the table is updated. Values are always better passed as parameters from application code to prevent SQL injection.', why: 'Stores new data.', next: 'Unless inside an explicit transaction, the insert commits immediately.' })],
  [/^UPDATE\s+(\w+)/i, (m) => ({ title: `UPDATE ${m[1]}`, says: `Change existing rows in ${m[1]}.`, runtime: 'Without a WHERE clause every row is updated. Most databases write a new row version and keep the old one until no transaction needs it.', why: 'Modifies stored data.', next: 'SET lists the new values.' })],
  [/^DELETE FROM\s+(\w+)/i, (m) => ({ title: `DELETE FROM ${m[1]}`, says: `Remove rows from ${m[1]}.`, runtime: 'Foreign keys referencing these rows are checked first. Without WHERE, every row is deleted.', why: 'Removes data.', next: 'WHERE limits which rows.' })],
  [/^(BEGIN|COMMIT|ROLLBACK)\b/i, (m) => ({ title: m[1].toUpperCase(), says: { BEGIN: 'Start a transaction.', COMMIT: 'Make the transaction’s changes permanent.', ROLLBACK: 'Discard the transaction’s changes.' }[m[1].toUpperCase()], runtime: 'Statements between BEGIN and COMMIT succeed or fail together; other sessions do not see the changes until commit.', why: 'Keeps related changes consistent.', next: '' })]
];

export const explainSql = (line, ctx) => {
  if (!line) return blank();
  if (/^--/.test(line)) return make(S.STRUCTURE, { title: 'Comment', says: truncate(line.slice(2).trim(), 80), runtime: 'Ignored by the SQL parser.', why: '', next: '' });
  if (/^\);?$/.test(line)) return make(S.STRUCTURE, { title: 'End of definition', says: 'Closes the column list.', runtime: 'The statement is complete and is sent to the database as one unit when the semicolon is reached.', why: '', next: 'The next statement begins.' });

  for (const [re, build] of CLAUSES) {
    const m = line.match(re);
    if (m) return make(P, build(m));
  }

  const table = insideCreateTable(ctx.lines, ctx.lineIndex);
  const col = line.match(/^(\w+)\s+(\w+(?:\(\d+\))?)(.*?),?$/);
  if (table && col) {
    const [, name, type, rest] = col;
    const tags = [];
    if (/PRIMARY KEY/i.test(rest)) tags.push({ label: 'PRIMARY KEY', note: 'Uniquely identifies each row; the database creates a unique index automatically.' });
    if (/NOT NULL/i.test(rest)) tags.push({ label: 'NOT NULL', note: 'Inserts or updates without a value are rejected.' });
    if (/UNIQUE/i.test(rest)) tags.push({ label: 'UNIQUE', note: 'Backed by an index; duplicate values are rejected.' });
    if (/REFERENCES\s+(\w+)/i.test(rest)) tags.push({ label: 'Foreign key', note: `Every value must exist in ${rest.match(/REFERENCES\s+(\w+)/i)[1]}; the database blocks orphaned rows.` });
    if (/DEFAULT\s+(.+)/i.test(rest)) tags.push({ label: 'DEFAULT', note: 'Used when an insert does not provide this column.' });
    const typeNote = {
      SERIAL: 'SERIAL is an integer filled automatically from a sequence: 1, 2, 3…',
      TEXT: 'TEXT stores strings of any length.',
      INTEGER: 'INTEGER stores whole numbers in 4 bytes.',
      BOOLEAN: 'BOOLEAN stores true, false or NULL.',
      TIMESTAMP: 'TIMESTAMP stores a date and time.'
    }[type.toUpperCase()] || `${type} defines what values the column accepts.`;
    return make(P, {
      title: `Column ${table}.${name}`,
      says: `Define the column ${name} with type ${type}${rest.trim() ? ` and ${truncate(rest.trim(), 50)}` : ''}.`,
      runtime: `${typeNote} The constraints on this line are checked on every write to ${table}.`,
      why: 'Types and constraints let the database reject bad data before your code ever sees it.',
      next: 'The next column, or the end of the table definition.',
      tags
    });
  }
  if (/^SET\s+(.+)/i.test(line)) {
    return make(P, { title: 'SET', says: `Assign new values: ${line.slice(3).trim()}.`, runtime: 'Applied to every row matched by the WHERE clause.', why: '', next: '' });
  }
  if (/^VALUES\s*\(/i.test(line)) {
    return make(P, { title: 'VALUES', says: 'The values for the new row, in column order.', runtime: 'Each value is converted to the column’s type; a mismatch is an error.', why: '', next: '' });
  }
  return unknown('SQL');
};
