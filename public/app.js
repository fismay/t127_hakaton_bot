
(function(){

  const ROOT = document.getElementById('app-root');

  function html(template){
    const tmp = document.createElement('div');
    tmp.innerHTML = template.trim();
    return tmp.firstChild;
  }

  const HasWebApp = typeof window.WebApp !== 'undefined';
  const WebApp = window.WebApp || {
    ready: ()=>console.log('[WebApp MOCK] ready() called'),
    DeviceStorage: {
      getItem: (k)=>localStorage.getItem(k),
      setItem: (k,v)=>localStorage.setItem(k,v),
      removeItem: (k)=>localStorage.removeItem(k),
      clear: ()=>localStorage.clear()
    },
    user: { first_name: 'Гость' },
    platform: 'web'
  };

  try { if (WebApp && typeof WebApp.ready === 'function') WebApp.ready(); } catch(e){ console.warn(e); }

  const STORAGE_KEY = 't127_miniapp_data_v2';

  const LEVELS = [0,10,50,100,200,500,1000];

  function defaultState(){
    return {
      profile: null,
      schedule: {},
      tasks: [],
      tags: ['работа/учеба','творчество','отдых','курсы','мероприятия'],
      stats: { done:0, overdue:0 },
      xp: 0
    };
  }

  function load(){
    try {
      const raw = WebApp.DeviceStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return JSON.parse(raw);
    } catch(e){
      console.error('load error', e);
      return defaultState();
    }
  }
  function save(state){
    WebApp.DeviceStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getLevel(xp){
    let lvl = 0;
    let next = null;
    for (let i=0;i<LEVELS.length;i++){
      if (xp >= LEVELS[i]) lvl = i;
      if (LEVELS[i] > xp && next === null) next = LEVELS[i];
    }
    return { level: lvl, nextThreshold: next};
  }

  function treeForLevel(level){
    const arr = ['🌱','🌿','🌳','🌲','🌴','🎄','🌳🌟'];
    return arr[Math.min(level, arr.length-1)];
  }

  function renderLayout(){
    ROOT.innerHTML = '';
    const node = html(`
      <div class="app">
        <div class="header">
          <div class="brand">
            <div class="logo">t127</div>
            <div>
              <div class="title">t127_hakaton_bot</div>
              <div class="subtitle">Мини-приложение для продуктивности — уровни, дерево и задачи</div>
            </div>
          </div>
          <div class="row">
            <button class="button" id="nav_start">Главная</button>
            <button class="button secondary" id="nav_tasks">Задачи</button>
            <button class="button secondary" id="nav_schedule">Расписание</button>
            <button class="button secondary" id="nav_tags">Метки</button>
            <button class="button secondary" id="nav_profile">Профиль</button>
          </div>
        </div>

        <div class="grid">
          <div id="main" >
            <!-- сюда встанут страницы -->
          </div>
          <div class="sidebar">
            <div class="card" id="sidebar_card"></div>
            <div class="card" id="debug_box"></div>
          </div>
        </div>
      </div>
    `);
    ROOT.appendChild(node);

   
    document.getElementById('nav_start').onclick = renderHome;
    document.getElementById('nav_tasks').onclick = ()=>renderTasks('week');
    document.getElementById('nav_schedule').onclick = renderSchedule;
    document.getElementById('nav_tags').onclick = renderTags;
    document.getElementById('nav_profile').onclick = renderProfile;

    renderSidebar();
    renderDebug();
  }

  function renderSidebar(){
    const state = load();
    const sb = document.getElementById('sidebar_card');
    const lvl = getLevel(state.xp);
    const today = new Date().toISOString().slice(0,10);
    const tasksToday = state.tasks.filter(t => t.deadline && t.deadline === today && !t.done).length;
    sb.innerHTML = `
      <div class="col">
        <div class="tree-big card center">${treeForLevel(lvl.level)}</div>
        <div class="card">
          <div><strong>Уровень:</strong> ${lvl.level}</div>
          <div class="small">Опыт: ${state.xp}${lvl.nextThreshold ? ' / ' + lvl.nextThreshold : ' (макс)'}</div>
          <div style="margin-top:8px;"><span class="badge">Задач сегодня: ${tasksToday}</span></div>
        </div>
        <div class="card">
          <div class="row">
            <button class="button" id="sb_add_task">Добавить задачу</button>
            <button class="button secondary" id="sb_week">На неделю</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('sb_add_task').onclick = renderAddTask;
    document.getElementById('sb_week').onclick = ()=>renderTasks('week');
  }

  function renderDebug(){
    const db = document.getElementById('debug_box');
    const state = load();
    let size = 0;
    try { size = JSON.stringify(state).length; } catch(e){}
    db.innerHTML = `<div class="small"><strong>Средства отладки</strong></div>
      <div class="small">WebApp: <strong>${HasWebApp ? 'YES' : 'NO (fallback)'}</strong></div>
      <div class="small">Platform: ${WebApp.platform || 'unknown'}</div>
      <div class="small">Storage size: ${size} bytes</div>
      <div style="margin-top:8px"><button class="button secondary" id="db_export">Экспорт данных</button>
      <button class="button secondary" id="db_reset">Сброс</button></div>
    `;
    document.getElementById('db_export').onclick = ()=>{
      const data = JSON.stringify(load(), null, 2);
      const blob = new Blob([data],{type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 't127_export.json'; a.click();
      URL.revokeObjectURL(url);
    };
    document.getElementById('db_reset').onclick = ()=>{
      if (!confirm('Очистить все данные приложения?')) return;
      save(defaultState());
      renderHome();
      renderSidebar();
      renderDebug();
    };
  }

  function renderHome(){
    const main = document.getElementById('main');
    const state = load();
    const lvl = getLevel(state.xp);
    main.innerHTML = `
      <div class="card">
        <div class="row" style="justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:18px;font-weight:700">Привет! Давай повысим твою продуктивность</div>
            <div class="small">t127 — уровни, дерево и задачи</div>
          </div>
          <div>
            <button class="button" id="start_create">Создать профиль</button>
            <button class="button secondary" id="start_open">Открыть профиль</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="font-size:40px">${treeForLevel(lvl.level)}</div>
          <div>
            <div><strong>Уровень ${lvl.level}</strong></div>
            <div class="small">Опыт: ${state.xp}${lvl.nextThreshold ? ' / ' + lvl.nextThreshold : ''}</div>
            <div class="small">Задач всего: ${state.tasks.length}</div>
          </div>
        </div>
      </div>

      <div id="home_quick" class="card">
        <div class="row">
          <button class="button" id="hq_add_task">Добавить задачу</button>
          <button class="button secondary" id="hq_week">Задачи на неделю</button>
          <button class="button secondary" id="hq_schedule">Расписание</button>
          <button class="button secondary" id="hq_tags">Метки</button>
        </div>
      </div>

      <div id="home_list"></div>
    `;

    document.getElementById('start_create').onclick = ()=>renderCreateProfile();
    document.getElementById('start_open').onclick = renderProfile;
    document.getElementById('hq_add_task').onclick = renderAddTask;
    document.getElementById('hq_week').onclick = ()=>renderTasks('week');
    document.getElementById('hq_schedule').onclick = renderSchedule;
    document.getElementById('hq_tags').onclick = renderTags;

    const homeList = document.getElementById('home_list');
    const recent = state.tasks.slice().sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,6);
    if (recent.length === 0){
      homeList.innerHTML = `<div class="card small">У вас пока нет задач — добавьте первую!</div>`;
    } else {
      const items = recent.map((t, i)=>`
        <div class="item">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong>${t.title}</strong><div class="meta">${t.tag || ''} — ${t.deadline || 'без дедлайна'}</div></div>
            <div>
              ${t.done ? '<span class="small">✔</span>' : `<button class="button secondary" data-id="${t.id}" data-idx="${i}" onclick="(function(){/*noop*/})();">Выполнить</button>`}
            </div>
          </div>
        </div>
      `).join('');
      homeList.innerHTML = `<div class="card"><div class="small">Последние задачи</div>${items}</div>`;
      const buttons = homeList.querySelectorAll('button[data-id]');
      buttons.forEach(b=>{
        b.onclick = ()=> {
          const id = Number(b.getAttribute('data-id'));
          finishTaskById(id);
        };
      });
    }

    renderSidebar();
    renderDebug();
  }

  function renderCreateProfile(){
    const main = document.getElementById('main');
    const state = load();
    const profile = state.profile || {};
    main.innerHTML = `
      <div class="card">
        <div style="font-weight:700">Создать / редактировать профиль</div>
        <div class="small">Введите имя и выберите роль</div>
        <div style="margin-top:12px">
          <label class="small">Имя</label>
          <input id="pf_name" class="input" value="${profile.name ? escapeHtml(profile.name) : (WebApp.user && WebApp.user.first_name ? escapeHtml(WebApp.user.first_name) : '')}" />
        </div>
        <div style="margin-top:10px">
          <label class="small">Роль</label>
          <div class="row">
            <button class="button" data-role="school">Школьник</button>
            <button class="button" data-role="student">Студент</button>
            <button class="button" data-role="teacher">Преподаватель</button>
            <button class="button" data-role="worker">Сотрудник</button>
          </div>
        </div>
        <div style="margin-top:12px">
          <button class="button" id="pf_save">Сохранить профиль</button>
          <button class="button secondary" id="pf_cancel">Отмена</button>
        </div>
      </div>
    `;
    let picked = profile.role || null;
    function mark(){
      document.querySelectorAll('[data-role]').forEach(b=>{
        b.style.opacity = (b.getAttribute('data-role') === picked) ? '0.7' : '1';
      });
    }
    mark();
    document.querySelectorAll('[data-role]').forEach(b=>{
      b.onclick = ()=>{ picked = b.getAttribute('data-role'); mark(); };
    });

    document.getElementById('pf_save').onclick = ()=>{
      const name = document.getElementById('pf_name').value.trim() || 'Аноним';
      if (!picked) { alert('Выберите роль'); return; }
      state.profile = { name, role: picked, createdAt: new Date().toISOString() };
      state.schedule = {};
      save(state);
      renderHome();
      renderSidebar();
    };
    document.getElementById('pf_cancel').onclick = renderHome;
  }

  function renderProfile(){
    const main = document.getElementById('main');
    const state = load();
    const p = state.profile;
    if (!p){
      main.innerHTML = `<div class="card">Профиль не создан. <button class="button" id="goto_create">Создать</button></div>`;
      document.getElementById('goto_create').onclick = renderCreateProfile;
      return;
    }
    const lvl = getLevel(state.xp);
    main.innerHTML = `
      <div class="card">
        <div style="font-weight:700">${escapeHtml(p.name)}</div>
        <div class="small">Роль: ${escapeHtml(p.role)}</div>
        <div style="margin-top:8px">Уровень: <strong>${lvl.level}</strong></div>
        <div class="small">Опыт: ${state.xp} ${lvl.nextThreshold ? '/ ' + lvl.nextThreshold : ''}</div>
        <div style="margin-top:10px" class="small">Статистика: выполнено ${state.stats.done} / просрочено ${state.stats.overdue}</div>
        <div style="margin-top:12px">
          <button class="button" id="edit_profile">Редактировать</button>
          <button class="button secondary" id="back_home">Назад</button>
        </div>
      </div>
    `;
    document.getElementById('edit_profile').onclick = ()=>renderCreateProfile();
    document.getElementById('back_home').onclick = renderHome;
  }

  function renderTasks(mode='week'){
    const main = document.getElementById('main');
    const state = load();
    const tasks = state.tasks.slice().sort((a,b)=> (a.deadline||'').localeCompare(b.deadline||''));
    let groups = {};
    tasks.forEach(t=>{
      const key = t.deadline || 'без дедлайна';
      groups[key] = groups[key] || [];
      groups[key].push(t);
    });

    let groupsHtml = Object.keys(groups).map(k=>{
      const items = groups[k].map((t, i)=>`
        <div class="item">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong>${escapeHtml(t.title)}</strong><div class="meta">${t.tag || ''} — ${t.deadline || 'без дедлайна'}</div></div>
            <div>
              ${t.done ? '<span class="small">✔</span>' : `<button class="button" data-id="${t.id}">Выполнить</button>`}
            </div>
          </div>
        </div>
      `).join('');
      return `<div class="card"><div class="small"><strong>${k}</strong></div>${items}</div>`;
    }).join('');

    main.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><strong>Задачи — ${mode === 'week' ? 'на неделю' : 'на день'}</strong></div>
          <div><button class="button" id="add_task_btn">Добавить</button></div>
        </div>
      </div>

      ${groupsHtml || '<div class="card small">Задач нет</div>'}
    `;

    document.getElementById('add_task_btn').onclick = renderAddTask;
    const btns = main.querySelectorAll('button[data-id]');
    btns.forEach(b=>{
      b.onclick = ()=> {
        const id = Number(b.getAttribute('data-id'));
        finishTaskById(id);
      };
    });
  }

  function finishTaskById(id){
    const state = load();
    const idx = state.tasks.findIndex(t=>t.id === id);
    if (idx === -1) { alert('Такой задачи нет'); return; }
    if (state.tasks[idx].done){ alert('Задача уже отмечена'); return; }
    state.tasks[idx].done = true;
    state.stats.done = (state.stats.done || 0) + 1;
    state.xp = (state.xp || 0) + 10; 
    save(state);
    alert('Поздравляю — задача выполнена! +10 опыта');
    renderTasks();
    renderSidebar();
    renderDebug();
  }

  function renderAddTask(){
    const main = document.getElementById('main');
    const state = load();
    const tags = state.tags.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    main.innerHTML = `
      <div class="card">
        <div style="font-weight:700">Добавить задачу</div>
        <div class="small">Заполните название, дедлайн и метку</div>
        <div style="margin-top:10px">
          <label class="small">Дедлайн (дд.мм.гггг или гггг-мм-дд)</label>
          <input id="task_deadline" class="input" placeholder="2025-11-12 или 12.11.2025" />
        </div>
        <div style="margin-top:10px">
          <label class="small">Что нужно сделать?</label>
          <textarea id="task_title" class="input"></textarea>
        </div>
        <div style="margin-top:10px">
          <label class="small">Метка</label>
          <select id="task_tag" class="input">${tags}</select>
        </div>
        <div style="margin-top:12px">
          <button class="button" id="task_save">Сохранить</button>
          <button class="button secondary" id="task_cancel">Отмена</button>
        </div>
      </div>
    `;
    document.getElementById('task_save').onclick = ()=>{
      const rawDl = document.getElementById('task_deadline').value.trim();
      const title = document.getElementById('task_title').value.trim();
      const tag = document.getElementById('task_tag').value;
      if (!title){ alert('Опишите задачу'); return; }
      let iso = null;
      if (rawDl){
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(rawDl)){
          const [d,m,y] = rawDl.split('.');
          iso = `${y}-${m}-${d}`;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDl)){
          iso = rawDl;
        } else {
          const dt = new Date(rawDl);
          if (!isNaN(dt)) iso = dt.toISOString().slice(0,10);
        }
      }
      const state = load();
      const id = Date.now() + Math.floor(Math.random()*1000);
      state.tasks.push({ id, title, deadline: iso, tag, done:false, createdAt: new Date().toISOString() });
      state.xp = (state.xp || 0) + 10;
      save(state);
      alert('Задача добавлена. +10 опыта');
      renderTasks('week');
      renderSidebar();
      renderDebug();
    };
    document.getElementById('task_cancel').onclick = renderTasks;
  }

  function renderTags(){
    const main = document.getElementById('main');
    const state = load();
    const list = state.tags.map((t,i)=>`<div class="item">${escapeHtml(t)} <button class="button secondary" data-del="${i}">Удалить</button></div>`).join('');
    main.innerHTML = `
      <div class="card">
        <div style="font-weight:700">Метки</div>
        <div class="small">Добавляйте метки для задач</div>
        <div style="margin-top:10px">
          <input id="new_tag" class="input" placeholder="Название метки" />
          <div style="margin-top:8px"><button class="button" id="add_tag_btn">Добавить метку</button></div>
        </div>
      </div>
      <div class="card">
        ${list || '<div class="small">Метки не заданы</div>'}
      </div>
    `;
    document.getElementById('add_tag_btn').onclick = ()=>{
      const v = document.getElementById('new_tag').value.trim();
      if (!v) { alert('Введите название метки'); return; }
      const st = load();
      if (!st.tags.includes(v)) st.tags.push(v);
      save(st);
      renderTags();
    };
    const dels = main.querySelectorAll('[data-del]');
    dels.forEach(b=> b.onclick = ()=>{
      const idx = Number(b.getAttribute('data-del'));
      const st = load();
      st.tags.splice(idx,1);
      save(st);
      renderTags();
    });
  }

  function renderSchedule(){
    const main = document.getElementById('main');
    const state = load();
    const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    const rows = days.map(d=>{
      const arr = state.schedule[d] || [];
      if (!arr.length) return `<div class="card"><strong>${d}</strong><div class="small">Нет занятий</div></div>`;
      const items = arr.map(it=>`<div>${it.from} - ${it.to} — <strong>${escapeHtml(it.subject)}</strong><div class="small">${escapeHtml(it.comment||'')}</div></div>`).join('');
      return `<div class="card"><strong>${d}</strong>${items}</div>`;
    }).join('');

    main.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><strong>Расписание</strong></div>
          <div>
            <button class="button" id="set_schedule">Задать расписание</button>
            <button class="button secondary" id="clear_schedule">Очистить</button>
          </div>
        </div>
      </div>
      ${rows}
    `;
    document.getElementById('set_schedule').onclick = renderSetSchedule;
    document.getElementById('clear_schedule').onclick = ()=>{
      if (!confirm('Удалить текущее расписание?')) return;
      const st = load();
      st.schedule = {};
      save(st);
      renderSchedule();
    };
  }

  function renderSetSchedule(){
    const main = document.getElementById('main');
    const days = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    let state = load();
    let schedule = {}; 
    let dayIdx = 0;

    function step(){
      const day = days[dayIdx];
      const entries = schedule[day] || [];
      main.innerHTML = `
        <div class="card">
          <div style="font-weight:700">Задать расписание — ${day}</div>
          <div class="small">Добавляйте занятия по очереди. Нажмите "Следующий день" чтобы перейти.</div>
          <div style="margin-top:10px">${entries.map((e,i)=>`<div class="item">${i+1}. ${e.from}-${e.to} ${escapeHtml(e.subject)} <div class="meta">${escapeHtml(e.comment||'')}</div></div>`).join('')}</div>
          <div style="margin-top:8px">
            <label class="small">Время (пример 09:00-10:10)</label>
            <input id="sch_time" class="input" placeholder="09:00-10:10" />
            <label class="small" style="margin-top:6px">Предмет</label>
            <input id="sch_subject" class="input" />
            <label class="small" style="margin-top:6px">Комментарий</label>
            <input id="sch_comment" class="input" />
            <div style="margin-top:10px">
              <button class="button" id="add_entry">Добавить занятие</button>
              <button class="button secondary" id="next_day">Следующий день</button>
              <button class="button secondary" id="cancel_sched">Отмена</button>
            </div>
          </div>
        </div>
      `;
      document.getElementById('add_entry').onclick = ()=>{
        const time = document.getElementById('sch_time').value.trim();
        const subj = document.getElementById('sch_subject').value.trim();
        const comm = document.getElementById('sch_comment').value.trim();
        if (!time || !subj) { alert('Укажите время и предмет'); return; }
        const parts = time.split('-').map(s=>s.trim());
        if (parts.length < 2) { alert('Время в формате 09:00-10:10'); return; }
        const entry = { from: parts[0], to: parts[1], subject: subj, comment: comm };
        schedule[day] = schedule[day] || [];
        schedule[day].push(entry);
        step();
      };
      document.getElementById('next_day').onclick = ()=>{
        dayIdx++;
        if (dayIdx >= days.length){
          state.schedule = schedule;
          save(state);
          alert('Расписание сохранено');
          renderSchedule();
          renderSidebar();
          renderDebug();
        } else step();
      };
      document.getElementById('cancel_sched').onclick = renderSchedule;
    }

    step();
  }

  function escapeHtml(s){ if (!s) return ''; return String(s).replace(/[&<>"']/g, (m)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

  function start(){
    renderLayout();
    const state = load();
    if (!state.profile) {
      renderHome();
    } else {
      renderHome();
    }
  }

  window.__t127 = { load, save, start, getLevel };

  start();

})();
