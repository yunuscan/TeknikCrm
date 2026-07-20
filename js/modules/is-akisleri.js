import { showToast } from '../utils.js';

let workflows = [];

function loadData() {
    const data = localStorage.getItem('crm_workflows');
    if (data) {
        try {
            workflows = JSON.parse(data);
            // Backward compatibility / migration for old string steps
            workflows.forEach(wf => {
                if (wf.columns) {
                    wf.columns.forEach(col => {
                        if (col.steps) {
                            col.steps = col.steps.map(step => {
                                if (typeof step === 'string') {
                                    return { text: step, completed: false };
                                }
                                return step;
                            });
                        }
                    });
                }
            });
        } catch (e) {
            workflows = [];
        }
    } else {
        workflows = [];
    }
}

function saveData() {
    localStorage.setItem('crm_workflows', JSON.stringify(workflows));
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

export async function renderIsAkisleri({ profile }) {
    const container = document.getElementById('content-area');
    loadData();

    function render() {
        let html = `
            <div class="mb-6 flex justify-between items-center">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800 dark:text-white">İş Akışları</h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Süreçlerinizi ve iş akış adımlarınızı yönetin</p>
                </div>
                <button id="btn-add-workflow" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    Yeni İş Akışı Ekle
                </button>
            </div>
            <div class="space-y-8 pb-10">
        `;

        if (workflows.length === 0) {
            html += `
                <div class="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
                    <svg class="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                    <p class="text-gray-500 dark:text-gray-400">Henüz hiç iş akışı oluşturulmamış.</p>
                </div>
            `;
        } else {
            workflows.forEach((wf, wfIndex) => {
                html += `
                    <div class="bg-gray-50 dark:bg-slate-900 rounded-2xl p-5 border border-gray-200 dark:border-slate-700">
                        <div class="flex justify-between items-center mb-4 group">
                            <h2 class="text-xl font-bold text-gray-800 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-800 rounded px-2 py-1 -ml-2 transition-colors editable-workflow-title" contenteditable="true" data-wf-idx="${wfIndex}">${wf.title}</h2>
                            <div class="flex items-center gap-2">
                                <button class="btn-add-column text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 px-3 py-1.5 rounded-lg shadow-sm" data-wf-idx="${wfIndex}">+ Kolon Ekle</button>
                                <button class="btn-delete-workflow text-gray-400 hover:text-red-500 transition-colors p-1" data-wf-idx="${wfIndex}" title="İş Akışını Sil">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                            </div>
                        </div>
                        <div class="flex gap-4 overflow-x-auto pb-2 items-start">
                `;

                if (!wf.columns || wf.columns.length === 0) {
                    html += `<p class="text-sm text-gray-400 italic">Henüz kolon yok.</p>`;
                } else {
                    wf.columns.forEach((col, colIndex) => {
                        html += `
                            <div class="flex-shrink-0 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col min-h-[150px]">
                                <div class="p-3 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center group/col">
                                    <h3 class="font-semibold text-gray-700 dark:text-gray-200 text-sm outline-none focus:bg-gray-50 dark:focus:bg-slate-700 rounded px-1 -ml-1 flex-1 editable-col-title" contenteditable="true" data-wf-idx="${wfIndex}" data-col-idx="${colIndex}">${col.title}</h3>
                                    <button class="btn-delete-column text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover/col:opacity-100 p-1" data-wf-idx="${wfIndex}" data-col-idx="${colIndex}" title="Kolonu Sil">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    </button>
                                </div>
                                <div class="p-2 overflow-y-auto flex-1 space-y-2 min-h-[50px]">
                        `;

                        if (col.steps) {
                            col.steps.forEach((stepObj, stepIndex) => {
                                const isCompleted = stepObj.completed;
                                const textClass = isCompleted ? 'line-through opacity-60 text-gray-500' : 'text-gray-700 dark:text-gray-200';
                                
                                html += `
                                    <div class="group/step relative bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 border border-gray-100 dark:border-slate-600 shadow-sm flex items-start gap-2 transition-all">
                                        <div class="mt-0.5 flex-shrink-0 cursor-pointer btn-toggle-step" data-wf-idx="${wfIndex}" data-col-idx="${colIndex}" data-step-idx="${stepIndex}" title="Durumu Değiştir">
                                            ${isCompleted 
                                                ? `<svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>`
                                                : `<div class="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-500 group-hover/step:border-indigo-400 transition-colors"></div>`
                                            }
                                        </div>
                                        <div class="outline-none focus:bg-white dark:focus:bg-slate-600 rounded editable-step whitespace-pre-wrap break-words pr-6 min-h-[1.5rem] flex-1 text-sm ${textClass}" contenteditable="true" data-wf-idx="${wfIndex}" data-col-idx="${colIndex}" data-step-idx="${stepIndex}">${stepObj.text}</div>
                                        <button class="btn-delete-step absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover/step:opacity-100 transition-colors" data-wf-idx="${wfIndex}" data-col-idx="${colIndex}" data-step-idx="${stepIndex}">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                        </button>
                                    </div>
                                `;
                            });
                        }

                        html += `
                                </div>
                                <div class="p-2 border-t border-gray-100 dark:border-slate-700">
                                    <button class="btn-add-step w-full py-1.5 flex justify-center items-center gap-1 text-xs font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 dark:hover:text-indigo-400 rounded-lg transition-colors" data-wf-idx="${wfIndex}" data-col-idx="${colIndex}">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                                        Adım Ekle
                                    </button>
                                </div>
                            </div>
                        `;
                    });
                }

                html += `
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
        container.innerHTML = html;
        attachEvents();
    }

    function attachEvents() {
        document.getElementById('btn-add-workflow')?.addEventListener('click', () => {
            workflows.unshift({
                id: generateId(),
                title: 'Yeni İş Akışı',
                columns: [
                    { id: generateId(), title: 'Analiz', steps: [] },
                    { id: generateId(), title: 'Geliştirme', steps: [] },
                    { id: generateId(), title: 'Test / Canlı', steps: [] }
                ]
            });
            saveData();
            render();
        });

        document.querySelectorAll('.btn-delete-workflow').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (confirm('Bu iş akışını tamamen silmek istediğinize emin misiniz?')) {
                    const idx = e.currentTarget.dataset.wfIdx;
                    workflows.splice(idx, 1);
                    saveData();
                    render();
                }
            });
        });

        document.querySelectorAll('.btn-add-column').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.currentTarget.dataset.wfIdx;
                workflows[idx].columns.push({
                    id: generateId(),
                    title: 'Yeni Kolon',
                    steps: []
                });
                saveData();
                render();
            });
        });

        document.querySelectorAll('.btn-delete-column').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (confirm('Bu kolonu silmek istediğinize emin misiniz?')) {
                    const wfIdx = e.currentTarget.dataset.wfIdx;
                    const colIdx = e.currentTarget.dataset.colIdx;
                    workflows[wfIdx].columns.splice(colIdx, 1);
                    saveData();
                    render();
                }
            });
        });

        document.querySelectorAll('.btn-add-step').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const wfIdx = e.currentTarget.dataset.wfIdx;
                const colIdx = e.currentTarget.dataset.colIdx;
                if (!workflows[wfIdx].columns[colIdx].steps) {
                    workflows[wfIdx].columns[colIdx].steps = [];
                }
                workflows[wfIdx].columns[colIdx].steps.push({ text: 'Yeni Adım', completed: false });
                saveData();
                render();
            });
        });

        document.querySelectorAll('.btn-delete-step').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const wfIdx = e.currentTarget.dataset.wfIdx;
                const colIdx = e.currentTarget.dataset.colIdx;
                const stepIdx = e.currentTarget.dataset.stepIdx;
                workflows[wfIdx].columns[colIdx].steps.splice(stepIdx, 1);
                saveData();
                render();
            });
        });

        // Toggle Step Status
        document.querySelectorAll('.btn-toggle-step').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const wfIdx = e.currentTarget.dataset.wfIdx;
                const colIdx = e.currentTarget.dataset.colIdx;
                const stepIdx = e.currentTarget.dataset.stepIdx;
                workflows[wfIdx].columns[colIdx].steps[stepIdx].completed = !workflows[wfIdx].columns[colIdx].steps[stepIdx].completed;
                saveData();
                render();
            });
        });

        document.querySelectorAll('.editable-workflow-title').forEach(el => {
            el.addEventListener('blur', (e) => {
                const idx = e.currentTarget.dataset.wfIdx;
                workflows[idx].title = e.currentTarget.innerText.trim() || 'İsimsiz Akış';
                saveData();
            });
            el.addEventListener('keydown', (e) => { if(e.key === 'Enter') { e.preventDefault(); el.blur(); } });
        });

        document.querySelectorAll('.editable-col-title').forEach(el => {
            el.addEventListener('blur', (e) => {
                const wfIdx = e.currentTarget.dataset.wfIdx;
                const colIdx = e.currentTarget.dataset.colIdx;
                workflows[wfIdx].columns[colIdx].title = e.currentTarget.innerText.trim() || 'İsimsiz Kolon';
                saveData();
            });
            el.addEventListener('keydown', (e) => { if(e.key === 'Enter') { e.preventDefault(); el.blur(); } });
        });

        document.querySelectorAll('.editable-step').forEach(el => {
            el.addEventListener('blur', (e) => {
                const wfIdx = e.currentTarget.dataset.wfIdx;
                const colIdx = e.currentTarget.dataset.colIdx;
                const stepIdx = e.currentTarget.dataset.stepIdx;
                workflows[wfIdx].columns[colIdx].steps[stepIdx].text = e.currentTarget.innerText.trim();
                saveData();
            });
        });
    }

    render();
}
