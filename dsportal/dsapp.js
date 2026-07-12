// 1. CONFIGURATION (Replace with yours)
const firebaseConfig = {
  apiKey: "AIzaSyBodqKo6sKRvarwf9jrVNHk0DHZJqQRsSg",
  authDomain: "eng4speak.firebaseapp.com",
  projectId: "eng4speak",
  storageBucket: "eng4speak.firebasestorage.app",
  messagingSenderId: "155511913539",
  appId: "1:155511913539:web:4de93e87e6fce0150d28f6"
};

const ADMIN_UID = "PASTE_YOUR_UID_HERE"; // From Firebase Auth Tab

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// 2. SPA ROUTER
const navigateTo = (hash) => {
    window.location.hash = hash;
};

const router = async () => {
    const hash = window.location.hash || '#home';
    const container = document.getElementById('app-container');
    container.innerHTML = '<div class="loader">Loading...</div>';

    if (hash === '#home') {
        renderFolder('root');
    } else if (hash.startsWith('#folder/')) {
        renderFolder(hash.split('/')[1]);
    } else if (hash.startsWith('#lecture/')) {
        renderLecture(hash.split('/')[1]);
    } else if (hash === '#admin') {
        renderAdmin();
    }
};

window.addEventListener('hashchange', router);
window.onload = router;

// 3. USER VIEWS
async function renderFolder(parentId) {
    const container = document.getElementById('app-container');
    const snapshot = await db.collection('content')
        .where('parentId', '==', parentId)
        .orderBy('order', 'asc').get();

    let html = `<h2 style="margin-bottom:20px">${parentId === 'root' ? 'Categories' : 'Content'}</h2><div class="grid">`;
    
    snapshot.forEach(doc => {
        const item = doc.data();
        const icon = item.type === 'folder' ? 
            `<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>` : 
            `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
        const link = item.type === 'folder' ? `#folder/${doc.id}` : `#lecture/${doc.id}`;
        
        html += `
            <div class="card" onclick="navigateTo('${link}')">
                ${icon}
                <h3>${item.title}</h3>
            </div>`;
    });

    html += `</div>`;
    if (parentId !== 'root') {
        html += `<button onclick="window.history.back()" style="margin-top:20px; background:none; border:none; color:var(--primary); font-weight:700; cursor:pointer;">← Back</button>`;
    }
    container.innerHTML = html;
}

async function renderLecture(id) {
    const container = document.getElementById('app-container');
    const doc = await db.collection('content').doc(id).get();
    const data = doc.data();

    container.innerHTML = `
        <div class="video-wrapper">
            <iframe src="https://www.youtube.com/embed/${data.ytId}" allowfullscreen></iframe>
        </div>
        <h1>${data.title}</h1>
        <p style="color:var(--text-light); margin: 10px 0 20px;">${data.desc || 'No description available.'}</p>
        
        <div class="resource-grid">
            ${data.notes ? `<a href="${data.notes}" class="resource-btn" target="_blank"><svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg> Notes PDF</a>` : ''}
            ${data.dpp ? `<a href="${data.dpp}" class="resource-btn" target="_blank"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg> Daily DPP</a>` : ''}
        </div>
    `;
}

// 4. ADMIN PANEL
async function renderAdmin() {
    const container = document.getElementById('app-container');
    const user = auth.currentUser;

    if (!user || user.uid !== ADMIN_UID) {
        container.innerHTML = `
            <div class="card" style="max-width:400px; margin:auto">
                <h2>Admin Login</h2>
                <input type="email" id="email" placeholder="Email" style="width:100%; padding:10px; margin:10px 0;">
                <input type="password" id="pass" placeholder="Password" style="width:100%; padding:10px; margin:10px 0;">
                <button onclick="login()" class="btn-save" style="width:100%">Login</button>
            </div>`;
        return;
    }

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
            <h2>Control Panel</h2>
            <button onclick="auth.signOut()" class="btn-del">Logout</button>
        </div>
        
        <div class="admin-form">
            <h3>Add New Content</h3>
            <select id="type"><option value="folder">Folder</option><option value="lecture">Lecture</option></select>
            <input type="text" id="title" placeholder="Title">
            <input type="text" id="pId" placeholder="Parent ID (Type 'root' for main page)">
            <input type="text" id="yt" placeholder="YouTube ID (If lecture)">
            <input type="text" id="notes" placeholder="Notes URL (Optional)">
            <input type="text" id="dpp" placeholder="DPP URL (Optional)">
            <button onclick="saveContent()" class="btn-save">Publish</button>
        </div>
        <div id="admin-list"></div>
    `;
    loadAdminList();
}

async function loadAdminList() {
    const list = document.getElementById('admin-list');
    const snap = await db.collection('content').orderBy('order', 'desc').limit(20).get();
    let html = '<h3>Recent Items</h3>';
    snap.forEach(doc => {
        html += `<div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
            <span>${doc.data().title} <small>(${doc.id})</small></span>
            <button onclick="deleteItem('${doc.id}')" class="btn-del">Delete</button>
        </div>`;
    });
    list.innerHTML = html;
}

window.login = () => {
    auth.signInWithEmailAndPassword(document.getElementById('email').value, document.getElementById('pass').value)
        .then(() => router()).catch(e => alert(e.message));
};

window.saveContent = async () => {
    const data = {
        type: document.getElementById('type').value,
        title: document.getElementById('title').value,
        parentId: document.getElementById('pId').value,
        ytId: document.getElementById('yt').value,
        notes: document.getElementById('notes').value,
        dpp: document.getElementById('dpp').value,
        order: Date.now()
    };
    await db.collection('content').add(data);
    alert('Added!');
    router();
};

window.deleteItem = async (id) => {
    if(confirm('Delete this?')) {
        await db.collection('content').doc(id).delete();
        router();
    }
};
