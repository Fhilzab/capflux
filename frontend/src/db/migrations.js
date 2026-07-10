import db from './localDb';

export async function migrate() {
  const currentVersion = await db.verno;

  if (currentVersion < 1) {
    await db.open();
  }

  return db;
}
