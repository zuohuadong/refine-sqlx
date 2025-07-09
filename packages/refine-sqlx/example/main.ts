import { createRefineSQLite, detectSQLite } from 'refine-sqlx';

const db = detectSQLite(':memory:');
const provider = createRefineSQLite(db);

provider.getOne({ resource: 'users', id: 1 });
