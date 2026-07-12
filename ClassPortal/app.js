// --- 1. FIREBASE CONFIG ---
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

// --- 2. GLOBAL STATE ---
let currentPath = [{id: 'root', name: 'Home'}];
let lastDoc = null;
const PAGE_SIZE = 12;

// --- 3. ROUTER ---
const handleRoute = () => {
    const hash = window.location.hash || '#home';
    const app = document.getElementById('app-container');
    app.innerHTML = '';
    lastDoc = null; // Reset pagination on route change

    if (hash === '#admin') {
        renderAdmin();
    } else if (hash.startsWith('#folder/')) {
        renderUserView(hash.split('/')[1]);
    } else if (hash.startsWith('#lecture/')) {
        renderLecture(hash.split('/')[1]);
    } else {
        currentPath = [{id: 'root', name: 'Home'}];
        renderUserView('root');
    }
};

window.addEventListener('hashchange', handleRoute);
window.onload = handleRoute;

// --- 4. USER PANEL ---
async function renderUserView(folderId, isMore = false) {
    const app = document.getElementById('app-container');
    if(!isMore) {
        app.innerHTML = `
            <div class="toolbar">
                <div class="bc" id="breadcrumbs"></div>
                <input type="text" id="search" class="search-input" placeholder="Search in this folder..." oninput="filterCards(this.value)">
            </div>
            <div class="grid" id="main-grid"></div>
            <button id="load-more" class="btn-load" style="display:none" onclick="renderUserView('${folderId}', true)">Load More Content</button>
        `;
    }

    renderBC();
    const grid = document.getElementById('main-grid');
    
    let query = db.collection('content').where('parentId', '==', folderId).orderBy('createdAt', 'desc').limit(PAGE_SIZE);
    if(isMore && lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if(snap.empty && !isMore) {
        grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:80px; color:gray;">Empty folder.</p>`;
        return;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    document.getElementById('load-more').style.display = snap.docs.length === PAGE_SIZE ? 'block' : 'none';

    snap.forEach(doc => {
        const item = doc.data();
        const card = document.createElement('div');
        card.className = 'card item-card';
        card.setAttribute('data-title', item.title.toLowerCase());
        const icon = item.type === 'folder' ? 
            `<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>` : 
            `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
        
        card.innerHTML = `${icon} <h3>${item.title}</h3>`;
        card.onclick = () => {
            if(item.type === 'folder') {
                currentPath.push({id: doc.id, name: item.title});
                location.hash = `#folder/${doc.id}`;
            } else location.hash = `#lecture/${doc.id}`;
        };
        grid.appendChild(card);
    });
}

// --- 5. SEARCH MODULE ---
function filterCards(val) {
    const cards = document.querySelectorAll('.item-card');
    const term = val.toLowerCase();
    cards.forEach(c => {
        const title = c.getAttribute('data-title');
        c.style.display = title.includes(term) ? 'block' : 'none';
    });
}

function renderBC() {
    const el = document.getElementById('breadcrumbs');
    if(!el) return;
    el.innerHTML = currentPath.map((p, i) => `
        <span onclick="jumpPath(${i})" style="cursor:pointer">${p.name}</span>
    `).join(' / ');
}

window.jumpPath = (i) => {
    currentPath = currentPath.slice(0, i + 1);
    const target = currentPath[i];
    location.hash = target.id === 'root' ? '#home' : `#folder/${target.id}`;
}

// --- 6. ADMIN PANEL (With Pagination & Subfolders) ---
async function renderAdmin() {
    const app = document.getElementById('app-container');
    if (!auth.currentUser) {
        app.innerHTML = `<div class="card" style="max-width:380px; margin:50px auto;">
            <h2>Admin Login</h2><br>
            <input type="email" id="adm-email" class="field" style="margin-bottom:10px" placeholder="Email">
            <input type="password" id="adm-pass" class="field" style="margin-bottom:20px" placeholder="Password">
            <button onclick="doLogin()" class="btn-pub">Login to Dashboard</button>
        </div>`;
        return;
    }

    const activeFolder = currentPath[currentPath.length - 1];
    app.innerHTML = `
        <div class="admin-split">
            <div class="admin-sidebar">
                <h3>Uploader</h3>
                <p style="font-size:12px; margin-bottom:15px; color:var(--text-light)">Target: <b>${activeFolder.name}</b></p>
                <div class="input-group">
                    <label>Content Type</label>
                    <select id="type" class="field" onchange="toggleForm(this.value)">
                        <option value="folder">📁 New Sub-Folder</option>
                        <option value="lecture">▶️ New Lecture</option>
                    </select>
                </div>
                <div class="input-group"><label>Title</label><input type="text" id="title" class="field"></div>
                <div id="lec-fields" style="display:none">
                    <div class="input-group"><label>YouTube ID</label><input type="text" id="yt" class="field"></div>
                    <div class="input-group"><label>Notes PDF URL</label><input type="text" id="notes" class="field"></div>
                    <div class="input-group"><label>DPP URL</label><input type="text" id="dpp" class="field"></div>
                </div>
                <button onclick="doPublish()" class="btn-pub">Publish Item</button>
                <button onclick="auth.signOut()" style="background:none; border:none; color:red; margin-top:20px; cursor:pointer; font-weight:700; width:100%">Logout</button>
            </div>
            <div>
                <div style="display:flex; justify-content:space-between; margin-bottom:15px">
                    <h3>Content Manager</h3>
                    <button onclick="jumpPath(0)" class="field" style="width:auto; padding:5px 15px; font-size:12px">Back to Root</button>
                </div>
                <div id="admin-grid" class="grid"></div>
                <button id="admin-load-more" class="btn-load" style="display:none" onclick="loadAdminItems(true)">Load More</button>
            </div>
        </div>
    `;
    loadAdminItems();
}

window.toggleForm = (v) => document.getElementById('lec-fields').style.display = v === 'lecture' ? 'block' : 'none';

async function loadAdminItems(isMore = false) {
    const grid = document.getElementById('admin-grid');
    const folderId = currentPath[currentPath.length - 1].id;
    
    let query = db.collection('content').where('parentId', '==', folderId).orderBy('createdAt', 'desc').limit(PAGE_SIZE);
    if(isMore && lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    lastDoc = snap.docs[snap.docs.length - 1];
    document.getElementById('admin-load-more').style.display = snap.docs.length === PAGE_SIZE ? 'block' : 'none';

    snap.forEach(doc => {
        const item = doc.data();
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div style="font-size:12px; font-weight:800">${item.title}</div>
            <div style="margin-top:10px; display:flex; gap:5px; justify-content:center">
                <button onclick="doDelete(event,'${doc.id}')" style="background:#FEE2E2; border:none; color:red; padding:4px 8px; border-radius:5px; cursor:pointer; font-size:10px">Delete</button>
                ${item.type === 'folder' ? `<button onclick="openFolderInAdmin('${doc.id}', '${item.title}')" style="background:#DCFCE7; border:none; color:green; padding:4px 8px; border-radius:5px; cursor:pointer; font-size:10px">Open</button>` : ''}
            </div>
        `;
        grid.appendChild(div);
    });
}

window.openFolderInAdmin = (id, name) => {
    currentPath.push({id, name});
    renderAdmin();
};

async function doPublish() {
    const title = document.getElementById('title').value;
    const type = document.getElementById('type').value;
    const parentId = currentPath[currentPath.length - 1].id;

    if(!title) return alert("Title required");
    await db.collection('content').add({
        title, type, parentId,
        ytId: document.getElementById('yt')?.value || '',
        notes: document.getElementById('notes')?.value || '',
        dpp: document.getElementById('dpp')?.value || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Published!");
    renderAdmin();
}

window.doDelete = async (e, id) => {
    e.stopPropagation();
    if(confirm("Delete this?")) {
        await db.collection('content').doc(id).delete();
        renderAdmin();
    }
};

window.doLogin = () => {
    const e = document.getElementById('adm-email').value;
    const p = document.getElementById('adm-pass').value;
    auth.signInWithEmailAndPassword(e, p).then(() => renderAdmin()).catch(err => alert(err.message));
};

// --- 7. LECTURE PAGE ---
async function renderLecture(id) {
    const doc = await db.collection('content').doc(id).get();
    const data = doc.data();
    document.getElementById('app-container').innerHTML = `
        <button onclick="window.history.back()" style="background:none; border:none; color:var(--primary); font-weight:800; cursor:pointer; margin-bottom:15px">← Back</button>
        <div class="vid-box">
            <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${data.ytId}" frameborder="0" allowfullscreen></iframe>
        </div>
        <h1 style="font-weight:800">${data.title}</h1><br>
        <div class="res-grid">
            ${data.notes ? `<a href="${data.notes}" target="_blank" class="res-card">📄 Download Notes</a>` : ''}
            ${data.dpp ? `<a href="${data.dpp}" target="_blank" class="res-card">📝 Practice DPP</a>` : ''}
        </div>
    `;
}
