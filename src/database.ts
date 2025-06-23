import { Client } from 'pg';

export async function pgTableExists(schema: string, table: string) {
  const client = new Client({
    user: process.env.OPEN_SGID_PASSWORD,
    password: process.env.OPEN_SGID_PASSWORD,
    host: 'opensgid.agrc.utah.gov',
    database: 'opensgid',
    port: 5432,
  });

  await client.connect();

  try {
    const response = await client.query(
      `
    select exists (
      select 1
      from information_schema.tables
      where table_schema = $1::text
      and table_name = $2::text
    );
`,
      [schema, table],
    );

    return response.rows[0].exists;
  } catch (err) {
    return false;
  } finally {
    await client.end();
  }
}
