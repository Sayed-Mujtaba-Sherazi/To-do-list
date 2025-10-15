'use strict';

(function(){
	const STORAGE_KEY = 'todo.tasks.v1';

	/** @type {HTMLFormElement} */
	const newTaskForm = document.getElementById('newTaskForm');
	/** @type {HTMLInputElement} */
	const taskInput = document.getElementById('taskInput');
	/** @type {HTMLUListElement} */
	const taskList = document.getElementById('taskList');
	/** @type {HTMLSpanElement} */
	const itemsLeft = document.getElementById('itemsLeft');
	/** @type {HTMLButtonElement} */
	const clearCompletedBtn = document.getElementById('clearCompleted');
	/** @type {HTMLButtonElement} */
	const themeToggle = document.getElementById('themeToggle');
	/** @type {HTMLTemplateElement} */
	const template = document.getElementById('taskItemTemplate');

	/** @typedef {{ id:string, title:string, completed:boolean }} Task */
	/** @type {Task[]} */
	let tasks = [];
	let currentFilter = 'all'; // 'all' | 'active' | 'completed'

	function save(){
		try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }catch(e){ /* ignore quota */ }
	}
	function load(){
		try{
			const raw = localStorage.getItem(STORAGE_KEY);
			if(raw){ tasks = JSON.parse(raw) || []; }
		}catch(e){ tasks = []; }
	}

	function updateItemsLeft(){
		const remaining = tasks.filter(t=>!t.completed).length;
		itemsLeft.textContent = `${remaining} item${remaining!==1?'s':''} left`;
	}

	function createTaskElement(task){
		const li = template.content.firstElementChild.cloneNode(true);
		li.dataset.id = task.id;
		li.classList.toggle('completed', !!task.completed);

		const toggle = li.querySelector('.toggle');
		const title = li.querySelector('.title');
		const edit = li.querySelector('.edit');
		const editBtn = li.querySelector('.edit-btn');
		const deleteBtn = li.querySelector('.delete-btn');

		title.textContent = task.title;
		toggle.checked = !!task.completed;
		edit.value = task.title;

		// Toggle complete
		toggle.addEventListener('change', ()=>{
			task.completed = toggle.checked;
			li.classList.toggle('completed', task.completed);
			save();
			updateItemsLeft();
			applyFilter();
		});

		// Enter editing
		function enterEdit(){
			li.classList.add('editing');
			edit.value = task.title;
			edit.focus();
			edit.setSelectionRange(edit.value.length, edit.value.length);
		}
		title.addEventListener('dblclick', enterEdit);
		editBtn.addEventListener('click', enterEdit);

		// Exit editing (save)
		function commit(){
			const val = edit.value.trim();
			if(!val){ cancel(); return; }
			task.title = val;
			title.textContent = val;
			li.classList.remove('editing');
			save();
		}
		// Exit editing (cancel)
		function cancel(){
			li.classList.remove('editing');
			edit.value = task.title;
		}
		edit.addEventListener('keydown', (e)=>{
			if(e.key==='Enter'){ e.preventDefault(); commit(); }
			else if(e.key==='Escape'){ e.preventDefault(); cancel(); }
		});
		edit.addEventListener('blur', ()=>{ if(li.classList.contains('editing')) commit(); });

		// Delete
		deleteBtn.addEventListener('click', ()=>{
			tasks = tasks.filter(t=>t.id!==task.id);
			li.remove();
			save();
			updateItemsLeft();
		});

		// Drag & drop
		li.addEventListener('dragstart', (e)=>{
			li.classList.add('dragging');
			e.dataTransfer.effectAllowed = 'move';
		});
		li.addEventListener('dragend', ()=>{
			li.classList.remove('dragging');
			restoreOrderFromDOM();
			save();
		});

		return li;
	}

	function render(){
		taskList.innerHTML='';
		const fragment = document.createDocumentFragment();
		const visible = tasks.filter(filterPredicate());
		for(const task of visible){ fragment.appendChild(createTaskElement(task)); }
		taskList.appendChild(fragment);
		updateItemsLeft();
	}

	function filterPredicate(){
		if(currentFilter==='active') return t=>!t.completed;
		if(currentFilter==='completed') return t=>t.completed;
		return ()=>true;
	}
	function applyFilter(){ render(); }

	function restoreOrderFromDOM(){
		const idsInDom = Array.from(taskList.children).map(li=>li.dataset.id);
		tasks.sort((a,b)=> idsInDom.indexOf(a.id) - idsInDom.indexOf(b.id));
	}

	// Add new task
	newTaskForm.addEventListener('submit', (e)=>{
		e.preventDefault();
		const title = taskInput.value.trim();
		if(!title) return;
		const task = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()), title, completed:false };
		tasks.push(task);
		save();
		if(currentFilter==='completed'){ currentFilter='all'; document.getElementById('filter-all').checked=true; }
		render();
		taskInput.value='';
		taskInput.focus();
	});

	// Filters
	const filterInputs = [
		document.getElementById('filter-all'),
		document.getElementById('filter-active'),
		document.getElementById('filter-completed')
	];
	for(const input of filterInputs){
		input.addEventListener('change', ()=>{
			if(input.checked){ currentFilter = input.value; applyFilter(); }
		});
	}

	// Clear completed
	clearCompletedBtn.addEventListener('click', ()=>{
		const hadCompleted = tasks.some(t=>t.completed);
		if(!hadCompleted) return;
		tasks = tasks.filter(t=>!t.completed);
		save();
		render();
	});

	// Theme toggle (persisted separately)
	const THEME_KEY = 'todo.theme.v1';
	function setTheme(mode){
		if(mode==='dark') document.documentElement.classList.add('dark');
		else document.documentElement.classList.remove('dark');
	}
	const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
	setTheme(savedTheme);
	themeToggle.addEventListener('click', ()=>{
		const now = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
		setTheme(now);
		try{ localStorage.setItem(THEME_KEY, now); }catch(e){}
	});

	// Drag container behavior
	taskList.addEventListener('dragover', (e)=>{
		e.preventDefault();
		const dragging = taskList.querySelector('.dragging');
		if(!dragging) return;
		const after = getDragAfterElement(e.clientY);
		if(after==null) taskList.appendChild(dragging); else taskList.insertBefore(dragging, after);
	});
	function getDragAfterElement(y){
		const els = [...taskList.querySelectorAll('.task:not(.dragging)')];
		return els.reduce((closest, child)=>{
			const box = child.getBoundingClientRect();
			const offset = y - box.top - box.height/2;
			if(offset<0 && offset>closest.offset){ return { offset, element: child }; }
			else return closest;
		},{ offset: Number.NEGATIVE_INFINITY, element: null }).element;
	}

	// Initialize
	load();
	render();
})();
