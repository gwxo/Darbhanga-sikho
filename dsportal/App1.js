// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBodqKo6sKRvarwf9jrVNHk0DHZJqQRsSg",
  authDomain: "eng4speak.firebaseapp.com",
  projectId: "eng4speak",
  storageBucket: "eng4speak.firebasestorage.app",
  messagingSenderId: "155511913539",
  appId: "1:155511913539:web:4de93e87e6fce0150d28f6"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// --- 2. STATE MANAGEMENT ---
let currentFolderId = 'root';
let pathStack = [{id: 'root', name: 'Home'}];

// --- 3. ROUTER ---
const router = () => {
    const hash = window.location.hash || '#home';
    const app = document.getElementById('app-container');
    app.innerHTML = ''; 

    if (hash === '#admin') {
        renderAdmin();
    } else if (hash.startsWith('#folder/')) {
        currentFolderId = hash.split('/')[1];
        renderUserView();
    } else if (hash.startsWith('#lecture/')) {
        renderLecture(hash.split('/')[1]);
    } else {
        currentFolderId = 'root';
        pathStack = [{id: 'root', name: 'Home'}];
        renderUserView();
    }
};

window.addEventListener('hashchange', router);
auth.onAuthStateChanged(() => router()); // Re-run router on login/logout

// --- 4. USER INTERFACE ---
async function renderUserView() {
    const app = document.getElementById('app-container');
    app.innerHTML = `
        <div class="toolbar animate">
            <div class="breadcrumbs" id="bc">Home</div>
            <input type="text" class="search-input" placeholder="Search lectures..." oninput="search(this.value)">
        </div>
        <div class="grid" id="main-grid"></div>
    `;
    
    renderBreadcrumbs();
    const grid = document.getElementById('main-grid');
    const snap = await db.collection('content').where('parentId', '==', currentFolderId).orderBy('title').get();

    if (snap.empty) {
        grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:100px; color:gray;">This folder is empty.</p>`;
        return;
    }

    snap.forEach((doc, i) => {
        const item = doc.data();
        const card = document.createElement('div');
        card.className = 'card animate';
        card.style.animationDelay = `${i * 0.05}s`;
        
        const icon = item.type === 'folder' ? 
            `<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>` : 
            `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;

        card.innerHTML = `${icon} <h3>${item.title}</h3>`;
        card.onclick = () => {
            if(item.type === 'folder') {
                pathStack.push({id: doc.id, name: item.title});
                window.location.hash = `#folder/${doc.id}`;
            } else {
                window.location.hash = `#lecture/${doc.id}`;
            }
        };
        grid.appendChild(card);
    });
}

function renderBreadcrumbs() {
    const bc = document.getElementById('bc');
    bc.innerHTML = pathStack.map((p, i) => `
        <span style="cursor:pointer" onclick="jumpTo(${i})">${p.name}</span>
    `).join(' <span style="color:#ddd; margin:0 5px;">/</span> ');
}

window.jumpTo = (index) => {
    const target = pathStack[index];
    pathStack = pathStack.slice(0, index + 1);
    window.location.hash = target.id === 'root' ? '#home' : `#folder/${target.id}`;
};

// --- 5. ADMIN PANEL ---
async function renderAdmin() {
    const app = document.getElementById('app-container');
    const user = auth.currentUser;

    if (!user) {
        app.innerHTML = `
            <div class="card animate" style="max-width:400px; margin:auto;">
                <h2 style="margin-bottom:20px;">Admin Login</h2>
                <input type="email" id="email" class="field" style="margin-bottom:10px;" placeholder="Email">
                <input type="password" id="pass" class="field" style="margin-bottom:20px;" placeholder="Password">
                <button onclick="login()" class="btn-pub">Login to Dashboard</button>
            </div>`;
        return;
    }

    app.innerHTML = `
        <div class="admin-layout animate">
            <div class="sidebar">
                <h2 style="color:var(--primary-dark); margin-bottom:10px;">Uploader</h2>
                <p style="font-size:12px; margin-bottom:20px;">Targeting: <b id="target-name">${pathStack[pathStack.length-1].name}</b></p>
                
                <div class="input-group">
                    <label>Content Type</label>
                    <select id="type" class="field" onchange="toggleFields(this.value)">
                        <option value="folder">📁 New Folder</option>
                        <option value="lecture">▶️ New Lecture</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>Title</label>
                    <input type="text" id="title" class="field" placeholder="e.g. Kinematics L1">
                </div>
                <div id="lecture-only" style="display:none;">
                    <div class="input-group"><label>YouTube Video ID</label><input type="text" id="yt" class="field" placeholder="e.g. dQw4w9WgXcQ"></div>
                    <div class="input-group"><label>Notes PDF URL</label><input type="text" id="notes" class="field"></div>
                    <div class="input-group"><label>DPP URL</label><input type="text" id="dpp" class="field"></div>
                </div>
                <button onclick="publish()" class="btn-pub">Publish to App</button>
                <button onclick="auth.signOut()" style="margin-top:20px; background:none; border:none; color:red; cursor:pointer; font-weight:700; width:100%;">Logout</button>
            </div>
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3>Contents in this level</h3>
                    <button onclick="jumpTo(0)" class="search-input" style="width:auto; cursor:pointer;">Back to Root</button>
                </div>
                <div id="admin-grid" class="grid"></div>
            </div>
        </div>
    `;
    loadAdminGrid();
}

async function loadAdminGrid() {
    const grid = document.getElementById('admin-grid');
    const snap = await db.collection('content').where('parentId', '==', pathStack[pathStack.length-1].id).orderBy('title').get();
    
    snap.forEach(doc => {
        const item = doc.data();
        const div = document.createElement('div');
        div.className = 'card';
        div.style.padding = '20px';
        div.innerHTML = `
            <p style="font-weight:800; font-size:14px;">${item.title}</p>
            <div style="margin-top:15px; display:flex; gap:10px; justify-content:center;">
                <button onclick="deleteDoc('${doc.id}')" style="border:none; background:#FEE2E2; color:#EF4444; padding:5px 10px; border-radius:8px; cursor:pointer; font-size:12px;">Delete</button>
                ${item.type === 'folder' ? `<button onclick="enter('${doc.id}', '${item.title}')" style="border:none; background:#DCFCE7; color:#059669; padding:5px 10px; border-radius:8px; cursor:pointer; font-size:12px;">Open</button>` : ''}
            </div>
        `;
        grid.appendChild(div);
    });
}

window.toggleFields = (v) => document.getElementById('lecture-only').style.display = v === 'lecture' ? 'block' : 'none';

window.enter = (id, name) => {
    pathStack.push({id, name});
    renderAdmin();
};

window.publish = async () => {
    const title = document.getElementById('title').value;
    const type = document.getElementById('type').value;
    const parentId = pathStack[pathStack.length-1].id;

    if(!title) return alert("Title is required!");

    await db.collection('content').add({
        title, type, parentId,
        ytId: document.getElementById('yt').value || '',
        notes: document.getElementById('notes').value || '',
        dpp: document.getElementById('dpp').value || '',
        createdAt: Date.now()
    });
    alert("Published Successfully!");
    renderAdmin();
};

window.deleteDoc = async (id) => {
    if(confirm("Are you sure?")) {
        await db.collection('content').doc(id).delete();
        renderAdmin();
    }
};

window.login = () => {
    const e = document.getElementById('email').value;
    const p = document.getElementById('pass').value;
    auth.signInWithEmailAndPassword(e, p).catch(err => alert(err.message));
};

// --- 6. LECTURE PLAYER ---
async function renderLecture(id) {
    const app = document.getElementById('app-container');
    const doc = await db.collection('content').doc(id).get();
    const data = doc.data();

    app.innerHTML = `
        <div class="animate">
            <button onclick="window.history.back()" style="margin-bottom:20px; border:none; background:none; color:var(--primary); font-weight:800; cursor:pointer;">← Back to Course</button>
            <div class="vid-container">
                <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${data.ytId}" frameborder="0" allowfullscreen></iframe>
            </div>
            <h1 style="font-weight:800; margin-bottom:10px;">${data.title}</h1>
            <p style="color:var(--text-light); margin-bottom:30px;">Premium Video Lecture • Darbhanga Sikho</p>
            
            <div class="res-grid">
                ${data.notes ? `<a href="${data.notes}" target="_blank" class="res-link">📄 Study Notes (PDF)</a>` : ''}
                ${data.dpp ? `<a href="${data.dpp}" target="_blank" class="res-link">📝 Practice DPP (PDF)</a>` : ''}
            </div>
        </div>
    `;
}

// --- INITIAL LOAD ---
window.onload = router;
