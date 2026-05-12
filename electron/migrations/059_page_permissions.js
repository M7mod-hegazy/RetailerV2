function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function up(db) {
  // Add page_permissions column to users table (nullable, defaults to NULL)
  addColumnIfMissing(db, "users", "page_permissions", "TEXT");

  // Add default_user_permissions column to settings table
  addColumnIfMissing(db, "settings", "default_user_permissions", "TEXT DEFAULT '{\"pos\":[\"view\",\"add\"]}'");
}

module.exports = { up };
