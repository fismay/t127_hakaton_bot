const express = require('express');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data.db');
const db = new Database(DB_FILE);

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      role TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      exp INTEGER DEFAULT 0,
      tasks_done INTEGER DEFAULT 0,
      tasks_overdue INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER,
      name TEXT,
      UNIQUE(profile_id, name)
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER,
      title TEXT,
      note TEXT,
      due INTEGER,
      done INTEGER DEFAULT 0,
      tag_id INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER,
      day TEXT,
      start_time TEXT,
      end_time TEXT,
      subject TEXT,
      note TEXT
    );
  `);
}

initDb();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.json({ok: true}));

app.post('/api/profile', (req, res) => {
  const {name, role} = req.body;
  if(!name || !role) return res.status(400).json({error: 'name and role required'});
  const existing = db.prepare('SELECT * FROM profiles WHERE id = 1').get();
  if(existing){
    db.prepare('UPDATE profiles SET name=?, role=? WHERE id=1').run(name, role);
    return res.json({ok: true, profile: db.prepare('SELECT * FROM profiles WHERE id=1').get()});
  } else {
    const info = db.prepare('INSERT INTO profiles (id, name, role) VALUES (1, ?, ?)').run(name, role);
    return res.json({ok: true, profile: db.prepare('SELECT * FROM profiles WHERE id=1').get()});
  }
});

app.get('/api/profile', (req,res)=>{
  const p = db.prepare('SELECT * FROM profiles WHERE id = 1').get();
  if(!p) return res.status(404).json({error:'no profile'});
  const thresholds = [0,10,50,100,200,500,1000];
  let level = 0;
  for(let i=0;i<thresholds.length;i++){ if(p.exp >= thresholds[i]) level = i; }
  let next = thresholds[level+1] || null;
  p.level = level;
  p.next_threshold = next;
  res.json({profile: p});
});

app.post('/api/tags', (req,res)=>{
  const {name} = req.body;
  if(!name) return res.status(400).json({error:'name required'});
  const existing = db.prepare('SELECT * FROM tags WHERE profile_id=1 AND name = ?').get(name);
  if(existing) return res.json({tag: existing});
  const info = db.prepare('INSERT INTO tags (profile_id, name) VALUES (1, ?)').run(name);
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(info.lastInsertRowid);
  res.json({tag});
});
app.get('/api/tags', (req,res)=>{
  const tags = db.prepare('SELECT * FROM tags WHERE profile_id=1').all();
  res.json({tags});
});

app.post('/api/tasks', (req,res)=>{
  const {title, note, due, tag_id} = req.body;
  if(!title) return res.status(400).json({error:'title required'});
  const info = db.prepare('INSERT INTO tasks (profile_id, title, note, due, tag_id) VALUES (1,?,?,?,?,?)').run(title||'', note||'', due||null, tag_id||null);

});
app.post('/api/tasks', (req,res)=>{}); 
app._router.stack.pop();
app.post('/api/tasks', (req,res)=>{
  const {title, note, due, tag_id} = req.body;
  if(!title) return res.status(400).json({error:'title required'});
  const info = db.prepare('INSERT INTO tasks (profile_id, title, note, due, tag_id) VALUES (1, ?, ?, ?, ?)').run(title, note||'', due||null, tag_id||null);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.json({task});
});

app.get('/api/tasks', (req,res)=>{
  const day = req.query.day;
  let rows;
  if(day){
    const start = Math.floor(new Date(day + 'T00:00:00').getTime()/1000);
    const end = Math.floor(new Date(day + 'T23:59:59').getTime()/1000);
    rows = db.prepare('SELECT * FROM tasks WHERE profile_id=1 AND due BETWEEN ? AND ?').all(start, end);
  } else {
    rows = db.prepare('SELECT * FROM tasks WHERE profile_id=1').all();
  }
  res.json({tasks: rows});
});

app.post('/api/tasks/:id/finish', (req,res)=>{
  const id = req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if(!task) return res.status(404).json({error:'task not found'});
  if(task.done){
    return res.json({ok:true, task});
  }
  db.prepare('UPDATE tasks SET done = 1 WHERE id = ?').run(id);
  db.prepare('UPDATE profiles SET exp = exp + 10, tasks_done = tasks_done + 1 WHERE id = 1').run();
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json({ok:true, task: updated});
});

app.delete('/api/tasks/:id', (req,res)=>{
  const id = req.params.id;
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ok:true});
});

app.post('/api/schedule', (req,res)=>{
  const {items} = req.body; 
  if(!Array.isArray(items)) return res.status(400).json({error:'items array required'});
  const del = db.prepare('DELETE FROM schedules WHERE profile_id = 1').run();
  const ins = db.prepare('INSERT INTO schedules (profile_id, day, start_time, end_time, subject, note) VALUES (1, ?, ?, ?, ?, ?)');
  const info = db.transaction((rows)=>{
    for(const r of rows){
      ins.run(r.day, r.start_time, r.end_time, r.subject, r.note||'');
    }
  });
  info(items);
  const rows = db.prepare('SELECT * FROM schedules WHERE profile_id = 1').all();
  res.json({schedule: rows});
});

app.get('/api/schedule', (req,res)=>{
  const rows = db.prepare('SELECT * FROM schedules WHERE profile_id = 1').all();
  res.json({schedule: rows});
});

app.get('/api/stats', (req,res)=>{
  const p = db.prepare('SELECT * FROM profiles WHERE id = 1').get();
  if(!p) return res.status(404).json({error:'no profile'});
  const tasks_today = db.prepare('SELECT COUNT(*) as c FROM tasks WHERE profile_id=1 AND due BETWEEN ? AND ?').get(
    Math.floor(new Date().setHours(0,0,0,0)/1000),
    Math.floor(new Date().setHours(23,59,59,999)/1000)
  ).c;
  res.json({profile: p, tasks_today});
});

app.get('/', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, ()=> console.log(`Server listening on 0.0.0.0:${PORT}`));
