// --- INITIALIZE FIREBASE ---
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

const ADMIN_UID = "8tnLMzCLXkYw6w2vXDOSM4iO0f82"; // Paste your UID here

// --- STATE MANAGEMENT ---
let currentPath = [{id: 'root', title: 'Home'}];
let lastDoc = null; // For pagination

// --- ROUTER ---
const navigateTo = (pathId, title, type = 'folder') => {
    if(pathId === 'root') {
        currentPath = [{id: 'root', title: 'Home'}];
    } else if(type === 'folder') {
        currentPath.push({id: pathId, title: title});
    }
    
    if(type === 'lecture') {
        renderLecture(pathId);
    } else {
        renderDirectory(pathId);
    }
};

// --- CORE UI RENDERING ---
async function renderDirectory(parentId, append = false) {
    const container = document.getElementById('app-container');
    if(!append) {
        container.innerHTML = `
            <div class="toolbar">
                <div class="breadcrumbs" id="breadcrumb-links"></div>
                <input type="text" class="search-box" placeholder="Search folders or lectures..." oninput="searchItems(this.value)">
            </div>
            <div class="grid" id="main-grid"></div>
            <button id="load-more" class="btn-load" style="display:none;" onclick="loadMore('${parentId}')">Load More</button>
        `;
    }

    updateBreadcrumbs();
    
    let query = db.collection('content')
        .where('parentId', '==', parentId)
        .orderBy('createdAt', 'desc')
        .limit(10);

    if(append && lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    const grid = document.getElementById('main-grid');
    
    if(snapshot.empty && !append) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px;">No content here yet. Use Admin to add some!</div>`;
        return;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    document.getElementById('load-more').style.display = snapshot.docs.length === 10 ? 'block' : 'none';

    snapshot.forEach(doc => {
        const item = doc.data();
        const card = document.createElement('div');
        card.className = 'card';
        const icon = item.type === 'folder' ? 
            `<svg class="icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>` :
            `<svg class="icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
        
        card.innerHTML = `
            ${auth.currentUser ? `
                <div class="card-actions">
                    <button class="action-btn" onclick="deleteItem(event, '${doc.id}')">🗑️</button>
                    <button class="action-btn" onclick="editItem(event, '${doc.id}')">✏️</button>
                </div>
            ` : ''}
            ${icon}
            <h3>${item.title}</h3>
            <p>${item.type === 'folder' ? 'Folder' : 'Video Lecture'}</p>
        `;
        card.onclick = () => navigateTo(doc.id, item.title, item.type);
        grid.appendChild(card);
    });
}

function updateBreadcrumbs() {
    const bc = document.getElementById('breadcrumb-links');
    bc.innerHTML = currentPath.map((p, index) => `
        <span onclick="jumpToPath(${index})" style="cursor:pointer">${p.title}</span>
        ${index < currentPath.length - 1 ? '<span>/</span>' : ''}
    `).join('');
}

window.jumpToPath = (index) => {
    const target = currentPath[index];
    currentPath = currentPath.slice(0, index + 1);
    renderDirectory(target.id);
};

// --- LECTURE PAGE ---
async function renderLecture(id) {
    const container = document.getElementById('app-container');
    const doc = await db.collection('content').doc(id).get();
    const data = doc.data();

    container.innerHTML = `
        <div class="player-container">
            <button onclick="window.history.back()" class="btn-load" style="margin:0 0 20px 0; padding:5px 15px;">← Back</button>
            <div class="video-box">
                <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${data.ytId}" frameborder="0" allowfullscreen></iframe>
            </div>
            <h1>${data.title}</h1>
            <p style="margin:10px 0 30px; color:var(--text-light)">${data.desc || 'No description provided.'}</p>
            <div class="res-grid">
                <a href="${data.notes || '#'}" class="res-card">📄 Notes PDF</a>
                <a href="${data.dpp || '#'}" class="res-card">📝 DPP Sheet</a>
            </div>
        </div>
    `;
}

// --- ADMIN SYSTEM ---
window.renderAdmin = () => {
    const container = document.getElementById('app-container');
    const user = auth.currentUser;

    if (!user) {
        container.innerHTML = `
            <div class="card" style="max-width:400px; margin:50px auto;">
                <h2>Admin Login</h2><br>
                <input type="email" id="adm-email" class="admin-input" placeholder="Email">
                <input type="password" id="adm-pass" class="admin-input" placeholder="Password">
                <button onclick="adminLogin()" class="btn-primary">Login to Dashboard</button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="admin-grid">
            <div class="admin-sidebar">
                <h3>Add Content</h3><br>
                <p>Current Parent ID: <br><strong id="active-parent">${currentPath[currentPath.length-1].id}</strong></p><br>
                
                <select id="item-type" class="admin-input" onchange="toggleAdminFields(this.value)">
                    <option value="folder">New Folder</option>
                    <option value="lecture">New Lecture</option>
                </select>
                <input type="text" id="item-title" class="admin-input" placeholder="Title">
                
                <div id="lecture-fields" style="display:none;">
                    <input type="text" id="item-yt" class="admin-input" placeholder="YouTube Video ID">
                    <input type="text" id="item-notes" class="admin-input" placeholder="Notes URL">
                    <input type="text" id="item-dpp" class="admin-input" placeholder="DPP URL">
                </div>

                <button onclick="saveItem()" class="btn-primary">Save Content</button>
                <button onclick="auth.signOut()" class="btn-load" style="width:100%; border-color:red; color:red;">Logout</button>
            </div>
            <div id="admin-preview">
                <h3>Current Level Items</h3><br>
                <div class="grid" id="main-grid"></div>
            </div>
        </div>
    `;
    renderDirectory(currentPath[currentPath.length-1].id, false);
};

window.toggleAdminFields = (val) => {
    document.getElementById('lecture-fields').style.display = val === 'lecture' ? 'block' : 'none';
};

window.saveItem = async () => {
    const title = document.getElementById('item-title').value;
    const type = document.getElementById('item-type').value;
    const parentId = currentPath[currentPath.length-1].id;

    if(!title) return alert("Title is required");

    const data = {
        title,
        type,
        parentId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        ytId: document.getElementById('item-yt').value || "",
        notes: document.getElementById('item-notes').value || "",
        dpp: document.getElementById('item-dpp').value || ""
    };

    await db.collection('content').add(data);
    alert("Saved Successfully!");
    renderAdmin();
};

window.deleteItem = async (e, id) => {
    e.stopPropagation();
    if(confirm("Are you sure? This cannot be undone.")) {
        await db.collection('content').doc(id).delete();
        renderDirectory(currentPath[currentPath.length-1].id);
    }
};

window.adminLogin = async () => {
    const e = document.getElementById('adm-email').value;
    const p = document.getElementById('adm-pass').value;
    try {
        await auth.signInWithEmailAndPassword(e, p);
        renderAdmin();
    } catch(err) { alert(err.message); }
};

// --- INITIAL LOAD ---
window.onload = () => {
    const hash = window.location.hash;
    if(hash === '#admin') renderAdmin();
    else renderDirectory('root');
};
