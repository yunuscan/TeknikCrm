import { escHtml } from '../utils.js';

let currentCustomerId = null;
let currentCustomerName = '';
let nodes = [];
let edges = [];
let isDragging = false;
let draggedNode = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let connectingNode = null; 

function getAnchorPoint(node, handle) {
    const w = 180;
    const nodeEl = document.querySelector(`.diagram-node[data-id="${node.id}"]`);
    const h = nodeEl ? nodeEl.offsetHeight : 80;
    
    switch (handle) {
        case 'top': return { x: node.x + w / 2, y: node.y };
        case 'bottom': return { x: node.x + w / 2, y: node.y + h };
        case 'left': return { x: node.x, y: node.y + h / 2 };
        case 'right': return { x: node.x + w, y: node.y + h / 2 };
        default: return { x: node.x + w / 2, y: node.y + h / 2 };
    }
}

function getControlPoint(x, y, handle) {
    const offset = 60;
    switch(handle) {
        case 'top': return { cx: x, cy: y - offset };
        case 'bottom': return { cx: x, cy: y + offset };
        case 'left': return { cx: x - offset, cy: y };
        case 'right': return { cx: x + offset, cy: y };
        default: return { cx: x, cy: y };
    }
} 

function initDOM() {
    if (document.getElementById('diagram-modal')) return;
    
    const html = `
        <div id="diagram-modal" class="hidden fixed inset-0 z-[100] bg-slate-900 overflow-hidden flex flex-col font-sans select-none">
            <!-- Grid Background -->
            <div class="absolute inset-0 z-0 opacity-20 pointer-events-none" style="background-image: radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0); background-size: 24px 24px;"></div>
            
            <!-- Toolbar -->
            <div class="relative z-20 flex items-center justify-between px-6 py-3 bg-slate-800/80 backdrop-blur border-b border-slate-700 shadow-sm">
                <div>
                    <h2 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"/></svg>
                        İş Akışı: <span id="diagram-customer-name" class="text-indigo-300 font-medium"></span>
                    </h2>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-xs text-slate-400 mr-2">İki kutuyu bağlamak için bağlantı (link) ikonunu diğer kutuya sürükleyin. Okları silmek için üzerine tıklayın.</span>
                    <button id="btn-diagram-add" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm flex items-center gap-1.5">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                        Kutu Ekle
                    </button>
                    <button id="btn-diagram-clear" class="px-3 py-2 bg-slate-700 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                        Temizle
                    </button>
                    <div class="w-px h-6 bg-slate-600 mx-1"></div>
                    <button id="btn-diagram-close" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                        Kapat
                    </button>
                </div>
            </div>

            <!-- Canvas Area -->
            <div id="diagram-canvas" class="relative flex-1 w-full h-full overflow-hidden cursor-crosshair">
                <svg id="diagram-edges" class="absolute inset-0 w-full h-full pointer-events-none z-10">
                    <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                        </marker>
                        <marker id="arrow-hover" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
                        </marker>
                    </defs>
                </svg>
                <div id="diagram-nodes" class="absolute inset-0 w-full h-full z-20"></div>
                <div id="edge-controls" class="absolute inset-0 w-full h-full z-30 pointer-events-none"></div>
                <!-- Temp line for dragging connections -->
                <svg id="temp-edge-container" class="absolute inset-0 w-full h-full pointer-events-none z-40 hidden">
                    <path id="temp-edge" d="" fill="none" stroke="#818cf8" stroke-width="2" stroke-dasharray="4" marker-end="url(#arrow)"></path>
                </svg>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    attachGlobalEvents();
}

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function loadData() {
    const data = localStorage.getItem(`is_akisi_${currentCustomerId}`);
    if (data) {
        try {
            const parsed = JSON.parse(data);
            nodes = parsed.nodes || [];
            edges = parsed.edges || [];
        } catch (e) {
            nodes = [];
            edges = [];
        }
    } else {
        nodes = [];
        edges = [];
    }
}

function saveData() {
    if (!currentCustomerId) return;
    localStorage.setItem(`is_akisi_${currentCustomerId}`, JSON.stringify({ nodes, edges }));
}

function render() {
    const nodesContainer = document.getElementById('diagram-nodes');
    nodesContainer.innerHTML = '';

    nodes.forEach(node => {
        const div = document.createElement('div');
        div.className = 'absolute bg-slate-800 border-2 border-slate-600 rounded-xl shadow-lg flex flex-col cursor-move hover:border-indigo-500 transition-colors group diagram-node select-none';
        div.style.left = node.x + 'px';
        div.style.top = node.y + 'px';
        div.style.width = '180px';
        div.dataset.id = node.id;

        div.innerHTML = `
            <!-- Anchors -->
            <div class="absolute -top-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-indigo-500 rounded-full border-2 border-slate-800 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity connection-handle shadow-sm z-10 hover:scale-125" data-handle="top"></div>
            <div class="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-indigo-500 rounded-full border-2 border-slate-800 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity connection-handle shadow-sm z-10 hover:scale-125" data-handle="bottom"></div>
            <div class="absolute top-1/2 -left-1.5 transform -translate-y-1/2 w-3 h-3 bg-indigo-500 rounded-full border-2 border-slate-800 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity connection-handle shadow-sm z-10 hover:scale-125" data-handle="left"></div>
            <div class="absolute top-1/2 -right-1.5 transform -translate-y-1/2 w-3 h-3 bg-indigo-500 rounded-full border-2 border-slate-800 cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity connection-handle shadow-sm z-10 hover:scale-125" data-handle="right"></div>
            
            <div class="flex items-center justify-end px-3 py-1.5 border-b border-slate-700 bg-slate-900/50 rounded-t-lg">
                <button class="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 delete-node-btn" title="Kutuyu Sil">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            <div class="p-3 text-sm text-slate-200 outline-none editable-node min-h-[40px] cursor-text" contenteditable="true">${escHtml(node.text)}</div>
        `;

        nodesContainer.appendChild(div);

        // Events for this node
        div.addEventListener('mousedown', onNodeMouseDown);
        
        const delBtn = div.querySelector('.delete-node-btn');
        delBtn.addEventListener('mousedown', (e) => e.stopPropagation());
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            nodes = nodes.filter(n => n.id !== node.id);
            edges = edges.filter(ed => ed.sourceId !== node.id && ed.targetId !== node.id);
            saveData();
            render();
        });

        const editable = div.querySelector('.editable-node');
        editable.addEventListener('mousedown', (e) => e.stopPropagation());
        editable.addEventListener('blur', (e) => {
            node.text = e.target.innerText;
            saveData();
        });

        const handles = div.querySelectorAll('.connection-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                connectingNode = node;
                connectingNode.activeHandle = handle.dataset.handle;
                document.getElementById('temp-edge-container').classList.remove('hidden');
                document.addEventListener('mousemove', onConnectionMouseMove);
                document.addEventListener('mouseup', onConnectionMouseUp);
            });
        });
    });

    drawEdges();
}

function drawEdges() {
    const svg = document.getElementById('diagram-edges');
    const controlsContainer = document.getElementById('edge-controls');
    if (controlsContainer) controlsContainer.innerHTML = '';

    // Clear old edges except defs
    svg.innerHTML = `
        <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
            <marker id="arrow-hover" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
            </marker>
        </defs>
    `;

    edges.forEach((edge, index) => {
        const source = nodes.find(n => n.id === edge.sourceId);
        const target = nodes.find(n => n.id === edge.targetId);
        if (!source || !target) return;

        const sHandle = edge.sourceHandle || 'right';
        const tHandle = edge.targetHandle || 'left';

        const sP = getAnchorPoint(source, sHandle);
        const tP = getAnchorPoint(target, tHandle);

        const sX = sP.x;
        const sY = sP.y;
        let tX = tP.x;
        let tY = tP.y;

        // Ok ucu kutunun icine girmesin diye hedefin kenarina (tHandle) gore ofset veriyoruz
        const offset = 5;
        switch (tHandle) {
            case 'left': tX -= offset; break;
            case 'right': tX += offset; break;
            case 'top': tY -= offset; break;
            case 'bottom': tY += offset; break;
        }

        const scp = getControlPoint(sX, sY, sHandle);
        const tcp = getControlPoint(tX, tY, tHandle);

        const d = `M ${sX} ${sY} C ${scp.cx} ${scp.cy}, ${tcp.cx} ${tcp.cy}, ${tX} ${tY}`;

        // Create an invisible wider path for easier clicking/hovering
        const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitPath.setAttribute('d', d);
        hitPath.setAttribute('fill', 'none');
        hitPath.setAttribute('stroke', 'transparent');
        hitPath.setAttribute('stroke-width', '20');
        hitPath.style.pointerEvents = 'stroke';
        hitPath.style.cursor = 'pointer';

        // Visible path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#94a3b8');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('marker-end', 'url(#arrow)');
        path.style.transition = 'stroke 0.2s';

        svg.appendChild(path);
        svg.appendChild(hitPath);

        // Hover effects
        hitPath.addEventListener('mouseenter', () => {
            path.setAttribute('stroke', '#ef4444');
            path.setAttribute('marker-end', 'url(#arrow-hover)');
        });
        hitPath.addEventListener('mouseleave', () => {
            path.setAttribute('stroke', '#94a3b8');
            path.setAttribute('marker-end', 'url(#arrow)');
        });

        // HTML Controls for the edge
        if (controlsContainer) {
            const p0x = sX, p0y = sY;
            const p1x = scp.cx, p1y = scp.cy;
            const p2x = tcp.cx, p2y = tcp.cy;
            const p3x = tX, p3y = tY;
            const t = 0.5;
            const midX = Math.pow(1-t, 3)*p0x + 3*Math.pow(1-t, 2)*t*p1x + 3*(1-t)*Math.pow(t, 2)*p2x + Math.pow(t, 3)*p3x;
            const midY = Math.pow(1-t, 3)*p0y + 3*Math.pow(1-t, 2)*t*p1y + 3*(1-t)*Math.pow(t, 2)*p2y + Math.pow(t, 3)*p3y;
            
            const btnWrapper = document.createElement('div');
            btnWrapper.className = 'absolute flex gap-1.5 transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto opacity-0 transition-opacity hover:opacity-100 edge-buttons-group';
            btnWrapper.style.left = midX + 'px';
            btnWrapper.style.top = midY + 'px';
            
            hitPath.addEventListener('mouseenter', () => btnWrapper.classList.replace('opacity-0', 'opacity-100'));
            hitPath.addEventListener('mouseleave', () => btnWrapper.classList.replace('opacity-100', 'opacity-0'));
            
            const swapBtn = document.createElement('button');
            swapBtn.className = 'p-1 bg-slate-700 hover:bg-indigo-600 text-white rounded-full shadow-md transition-colors';
            swapBtn.title = 'Yönü Değiştir';
            swapBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>';
            swapBtn.onclick = (e) => {
                e.stopPropagation();
                const tempId = edge.sourceId;
                edge.sourceId = edge.targetId;
                edge.targetId = tempId;
                const tempHandle = edge.sourceHandle;
                edge.sourceHandle = edge.targetHandle;
                edge.targetHandle = tempHandle;
                saveData();
                drawEdges();
            };
            
            const delBtn = document.createElement('button');
            delBtn.className = 'p-1 bg-slate-700 hover:bg-red-600 text-white rounded-full shadow-md transition-colors';
            delBtn.title = 'Bağlantıyı Sil';
            delBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                edges.splice(index, 1);
                saveData();
                drawEdges();
            };
            
            btnWrapper.appendChild(swapBtn);
            btnWrapper.appendChild(delBtn);
            controlsContainer.appendChild(btnWrapper);
        }
    });
}

function onNodeMouseDown(e) {
    if (e.target.closest('.connection-handle') || e.target.closest('.delete-node-btn') || e.target.closest('.editable-node')) return;
    
    const nodeEl = e.currentTarget;
    const id = nodeEl.dataset.id;
    draggedNode = nodes.find(n => n.id === id);
    if (!draggedNode) return;

    isDragging = true;
    
    const canvasRect = document.getElementById('diagram-canvas').getBoundingClientRect();
    const nodeRect = nodeEl.getBoundingClientRect();
    
    dragOffsetX = e.clientX - nodeRect.left;
    dragOffsetY = e.clientY - nodeRect.top;

    nodeEl.classList.add('z-50', 'shadow-2xl', 'border-indigo-400', 'cursor-grabbing');
    nodeEl.classList.remove('cursor-move');
    document.body.classList.add('cursor-grabbing');
    
    document.addEventListener('mousemove', onNodeMouseMove);
    document.addEventListener('mouseup', onNodeMouseUp);
}

function onNodeMouseMove(e) {
    if (!isDragging || !draggedNode) return;
    
    const canvasRect = document.getElementById('diagram-canvas').getBoundingClientRect();
    
    let x = (e.clientX - canvasRect.left) - dragOffsetX;
    let y = (e.clientY - canvasRect.top) - dragOffsetY;
    
    if (x < 0) x = 0;
    if (y < 0) y = 0; 

    draggedNode.x = x;
    draggedNode.y = y;

    const nodeEl = document.querySelector(`.diagram-node[data-id="${draggedNode.id}"]`);
    if (nodeEl) {
        nodeEl.style.left = x + 'px';
        nodeEl.style.top = y + 'px';
    }

    drawEdges();
}

function onNodeMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    
    const nodeEl = document.querySelector(`.diagram-node[data-id="${draggedNode.id}"]`);
    if (nodeEl) {
        nodeEl.classList.remove('z-50', 'shadow-2xl', 'border-indigo-400', 'cursor-grabbing');
        nodeEl.classList.add('cursor-move');
    }
    document.body.classList.remove('cursor-grabbing');

    draggedNode = null;
    saveData();
    
    document.removeEventListener('mousemove', onNodeMouseMove);
    document.removeEventListener('mouseup', onNodeMouseUp);
}

function onConnectionMouseMove(e) {
    if (!connectingNode) return;
    const path = document.getElementById('temp-edge');
    
    const canvasRect = document.getElementById('diagram-canvas').getBoundingClientRect();
    
    const sHandle = connectingNode.activeHandle || 'right';
    const sP = getAnchorPoint(connectingNode, sHandle);
    
    const sX = sP.x;
    const sY = sP.y;
    const tX = e.clientX - canvasRect.left;
    const tY = e.clientY - canvasRect.top;

    const scp = getControlPoint(sX, sY, sHandle);

    const d = `M ${sX} ${sY} C ${scp.cx} ${scp.cy}, ${tX} ${tY}, ${tX} ${tY}`;
    path.setAttribute('d', d);
}

function onConnectionMouseUp(e) {
    document.removeEventListener('mousemove', onConnectionMouseMove);
    document.removeEventListener('mouseup', onConnectionMouseUp);
    
    document.getElementById('temp-edge-container').classList.add('hidden');
    document.getElementById('temp-edge').setAttribute('d', '');

    if (!connectingNode) return;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const targetHandleEl = el?.closest('.connection-handle');
    const targetNodeEl = el?.closest('.diagram-node');

    if (targetNodeEl) {
        const targetId = targetNodeEl.dataset.id;
        if (targetId !== connectingNode.id) {
            let targetHandle = 'left';
            if (targetHandleEl) {
                targetHandle = targetHandleEl.dataset.handle;
            } else {
                const targetNode = nodes.find(n => n.id === targetId);
                if (targetNode) {
                    const canvasRect = document.getElementById('diagram-canvas').getBoundingClientRect();
                    const dropX = e.clientX - canvasRect.left;
                    const dropY = e.clientY - canvasRect.top;
                    
                    const tP = getAnchorPoint(targetNode, 'top');
                    const bP = getAnchorPoint(targetNode, 'bottom');
                    const lP = getAnchorPoint(targetNode, 'left');
                    const rP = getAnchorPoint(targetNode, 'right');

                    const dist = (p) => Math.hypot(p.x - dropX, p.y - dropY);
                    const dists = [
                        { handle: 'top', d: dist(tP) },
                        { handle: 'bottom', d: dist(bP) },
                        { handle: 'left', d: dist(lP) },
                        { handle: 'right', d: dist(rP) }
                    ];
                    dists.sort((a,b) => a.d - b.d);
                    targetHandle = dists[0].handle;
                }
            }

            const exists = edges.some(ed => ed.sourceId === connectingNode.id && ed.targetId === targetId && ed.sourceHandle === connectingNode.activeHandle && ed.targetHandle === targetHandle);
            if (!exists) {
                edges.push({
                    sourceId: connectingNode.id,
                    sourceHandle: connectingNode.activeHandle,
                    targetId: targetId,
                    targetHandle: targetHandle
                });
                saveData();
            }
        }
    }

    connectingNode = null;
    drawEdges();
}

function attachGlobalEvents() {
    document.getElementById('btn-diagram-close').addEventListener('click', () => {
        document.getElementById('diagram-modal').classList.add('hidden');
        currentCustomerId = null;
    });

    document.getElementById('btn-diagram-add').addEventListener('click', () => {
        // Drop it in center of screen
        const w = window.innerWidth;
        const h = window.innerHeight;
        nodes.push({
            id: generateId(),
            text: 'Yeni Adım',
            x: (w / 2) - 90 + (Math.random() * 40 - 20),
            y: (h / 2) - 40 + (Math.random() * 40 - 20)
        });
        saveData();
        render();
    });

    document.getElementById('btn-diagram-clear').addEventListener('click', () => {
        if (confirm('Tüm diyagram silinecek. Emin misiniz?')) {
            nodes = [];
            edges = [];
            saveData();
            render();
        }
    });
}

export function openDiagramModal(customerId, customerName) {
    initDOM();
    currentCustomerId = customerId;
    currentCustomerName = customerName;
    document.getElementById('diagram-customer-name').textContent = customerName;
    
    loadData();
    
    // Auto-create initial node if empty
    if (nodes.length === 0) {
        nodes.push({
            id: generateId(),
            text: 'Başlangıç',
            x: window.innerWidth / 2 - 90,
            y: 100
        });
        saveData();
    }
    
    document.getElementById('diagram-modal').classList.remove('hidden');
    render();
}
