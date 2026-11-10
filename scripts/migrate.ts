import { migrate, db } from '../apps/api/src/infrastructure/database.js';
await migrate();
console.log('Migrations applied');
await db.destroy();
