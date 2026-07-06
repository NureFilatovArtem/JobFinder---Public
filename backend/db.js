// Database setup and initialization for SQLite
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const DB_PATH = process.env.DATABASE_URL || './jobfinder.db';

// Initialize database
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');

      // Create tables
      db.serialize(() => {
        // Vacatures table
        db.run(`
          CREATE TABLE IF NOT EXISTS vacatures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            company TEXT,
            location TEXT,
            description TEXT,
            link TEXT,
            source TEXT,
            motivation TEXT,
            status TEXT DEFAULT 'gevonden',
            job_type TEXT,
            postcode TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            console.error('Error creating vacatures table:', err);
            reject(err);
          } else {
            console.log('Vacatures table ready');
            // Add status column if it doesn't exist (for existing databases)
            db.run(`
              ALTER TABLE vacatures ADD COLUMN status TEXT DEFAULT 'gevonden'
            `, () => {
              // Ignore error if column already exists
            });
            db.run(`
              ALTER TABLE vacatures ADD COLUMN job_type TEXT
            `, () => {
              // Ignore error if column already exists
            });
            db.run(`
              ALTER TABLE vacatures ADD COLUMN postcode TEXT
            `, () => {
              // Ignore error if column already exists
            });
          }
        });

        // Profile table
        db.run(`
          CREATE TABLE IF NOT EXISTS profile (
            id INTEGER PRIMARY KEY,
            skills TEXT,
            personality TEXT,
            availability TEXT,
            name TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            console.error('Error creating profile table:', err);
            reject(err);
          } else {
            console.log('Profile table ready');
            // Add tags column if it doesn't exist (for tag-based system)
            db.run(`
              ALTER TABLE profile ADD COLUMN tags TEXT
            `, () => {
              // Ignore error if column already exists
            });
            // Create unique constraint for profile (only one profile allowed)
            db.run(`
              CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_id ON profile(id)
            `, (err) => {
              if (err) {
                console.error('Error creating profile index:', err);
              }
              resolve(db);
            });
          }
        });
      });
    });
  });
}

// Get database instance
function getDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(db);
      }
    });
  });
}

// Helper functions for database operations
const dbHelpers = {
  // Vacatures
  getAllVacatures: () => {
    return new Promise((resolve, reject) => {
      getDatabase().then(db => {
        db.all('SELECT * FROM vacatures ORDER BY created_at DESC', (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
          db.close();
        });
      }).catch(reject);
    });
  },

  getVacatureById: (id) => {
    return new Promise((resolve, reject) => {
      getDatabase().then(db => {
        db.get('SELECT * FROM vacatures WHERE id = ?', [id], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
          db.close();
        });
      }).catch(reject);
    });
  },

  createVacature: (vacature) => {
    return new Promise((resolve, reject) => {
      getDatabase().then(db => {
        const { title, company, location, description, link, source, status, job_type, postcode } = vacature;
        db.run(
          'INSERT INTO vacatures (title, company, location, description, link, source, status, job_type, postcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [title, company, location, description, link, source, status || 'gevonden', job_type || '', postcode || ''],
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({ id: this.lastID, ...vacature });
            }
            db.close();
          }
        );
      }).catch(reject);
    });
  },

  createMultipleVacatures: (vacatures) => {
    return new Promise((resolve, reject) => {
      getDatabase().then(db => {
        const stmt = db.prepare('INSERT INTO vacatures (title, company, location, description, link, source, status, job_type, postcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const results = [];

        vacatures.forEach(vacature => {
          const { title, company, location, description, link, source, status, job_type, postcode } = vacature;
          stmt.run([title, company, location, description, link, source, status || 'gevonden', job_type || '', postcode || ''], function (err) {
            if (!err) {
              results.push({ id: this.lastID, ...vacature });
            }
          });
        });

        stmt.finalize((err) => {
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }
          db.close();
        });
      }).catch(reject);
    });
  },

  getVacaturesByStatus: (status) => {
    return new Promise((resolve, reject) => {
      getDatabase().then(db => {
        db.all('SELECT * FROM vacatures WHERE status = ? ORDER BY created_at DESC', [status], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
          db.close();
        });
      }).catch(reject);
    });
  },

  updateVacatureStatus: (id, status) => {
    return new Promise((resolve, reject) => {
      getDatabase().then(db => {
        db.run(
          'UPDATE vacatures SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [status, id],
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({ id, status });
            }
            db.close();
          }
        );
      }).catch(reject);
    });
  },

  updateVacatureMotivation: (id, motivation) => {
    return new Promise((resolve, reject) => {
      getDatabase().then(db => {
        db.run(
          'UPDATE vacatures SET motivation = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [motivation, id],
          function (err) {
            if (err) {
              reject(err);
            } else {
              resolve({ id, motivation });
            }
            db.close();
          }
        );
      }).catch(reject);
    });
  },

  updateMultipleVacatureMotivations: (updates) => {
    return new Promise((resolve, reject) => {
      getDatabase().then(db => {
        const stmt = db.prepare('UPDATE vacatures SET motivation = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        const results = [];

        updates.forEach(({ id, motivation }) => {
          stmt.run([motivation, id], function (err) {
            if (!err) {
              results.push({ id, motivation });
            }
          });
        });

        stmt.finalize((err) => {
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }
          db.close();
        });
      }).catch(reject);
    });
  },

  // Profile
  getProfile: () => {
    return new Promise((resolve, reject) => {
      getDatabase().then(db => {
        db.get('SELECT * FROM profile WHERE id = 1', (err, row) => {
          if (err) {
            reject(err);
          } else {
            const profile = row || {
              id: 1,
              skills: '',
              tags: [],
              personality: '',
              availability: 'vrijdag, zaterdag, zondag (8:00–19:00)',
              name: ''
            };

            // Parse tags from JSON string if present
            if (profile.tags && typeof profile.tags === 'string') {
              try {
                profile.tags = JSON.parse(profile.tags);
              } catch (e) {
                profile.tags = [];
              }
            } else if (!profile.tags) {
              profile.tags = [];
            }

            resolve(profile);
          }
          db.close();
        });
      }).catch(reject);
    });
  }
};

module.exports = { initializeDatabase, getDatabase, dbHelpers };
