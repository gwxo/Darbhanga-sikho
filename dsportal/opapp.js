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

// --- STATE MANAGEMENT ---
let currentPath = [{id: 'root', title: 'Home'}];
let lastDoc = null; 

// --- ROUTER & AUTH OBSERVER ---
// This is the secret fix: It waits for Firebase to confirm the user before rendering
auth.onAuthStateChanged((user) => {
    handleRouting();
});

window.addEventListener('hashchange', () => {
    handleRouting();
});

function handleRouting() {
    const hash = window.location.hash;
    const container = document.getElementById('app-container');
    container.innerHTML = '<div class="loader">Loading...</div>';

    if (hash === '#admin') {
        renderAdmin();
    } else if (hash.startsWith('#lecture/')) {
        const id = hash.split('/')[1];
        renderLecture(id);
    } else if (hash.startsWith('#folder/')) {
        const id = hash.split('/')[1];
        // Note: Title management for folders usually requires a fetch or state
        renderDirectory(id);
    } else {
        renderDirectory('root');
    }
}

const navigateTo = (pathId, title, type = 'folder') => {
    if (type === 'lecture') {
        window.location.hash = `#lecture/${pathId}`;
    } else {
        // Build the path trail for breadcrumbs
        if(pathId === 'root') currentPath = [{id: 'root', title: 'Home'}];
        else currentPath.push({id: pathId, title: title});
        window.location.hash = `#folder/${pathId}`;
    }
};

// --- USER UI ---
async function renderDirectory(parentId, append = false) {
    const container = document.getElementById('app-container');
    if (!append) {
        container.innerHTML = `
            <div class="toolbar">
                <div class="breadcrumbs" id="breadcrumb-links"></div>
                <input type="text" class="search-box" placeholder="Search..." oninput="searchItems(this.value)">
            </div>
            <div class="grid" id="main-grid"></div>
            <center><button id="load-more" class="btn-load" style="display:none;" onclick="renderDirectory('${parentId}', true)">Load More</button></center>
        `;
    }

    updateBreadcrumbs();
    
    let query = db.collection('content')
        .where('parentId', '==', parentId)
        .orderBy('createdAt', 'desc')
        .limit(12);

    if (append && lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    const grid = document.getElementById('main-grid');
    
    if (snapshot.empty && !append) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px;">Folder is empty.</div>`;
        return;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    document.getElementById('load-more').style.display = snapshot.docs.length === 12 ? 'block' : 'none';

    snapshot.forEach(doc => {
        const item = doc.data();
        const card = document.createElement('div');
        card.className = 'card';
        const icon = item.type === 'folder' ? '📁' : '▶️';
        
        card.innerHTML = `
            <div style="font-size:40px; margin-bottom:10px;">${icon}</div>
            <h3 style="font-size:16px;">${item.title}</h3>
            <p style="font-size:12px; color:gray;">${item.type.toUpperCase()}</p>
        `;
        card.onclick = () => navigateTo(doc.id, item.title, item.type);
        grid.appendChild(card);
    });
}

function updateBreadcrumbs() {
    const bc = document.getElementById('breadcrumb-links');
    if(!bc) return;
    bc.innerHTML = currentPath.map((p, index) => `
        <span onclick="jumpToPath(${index})" style="cursor:pointer; color:#10B981;">${p.title}</span>
        ${index < currentPath.length - 1 ? ' / ' : ''}
    `).join('');
}

window.jumpToPath = (index) => {
    currentPath = currentPath.slice(0, index + 1);
    const target = currentPath[index];
    window.location.hash = target.id === 'root' ? '#home' : `#folder/${target.id}`;
};

// --- ADMIN UI ---
window.renderAdmin = async () => {
    const container = document.getElementById('app-container');
    const user = auth.currentUser;

    // Fix: If no user, show login. If user, show dashboard.
    if (!user) {
        container.innerHTML = `
            <div class="card" style="max-width:400px; margin:50px auto; padding:30px; text-align:center;">
                <h2 style="color:#10B981">Admin Portal</h2><br>
                <input type="email" id="adm-email" class="admin-input" placeholder="Admin Email" style="width:100%; padding:12px; margin-bottom:10px; border:1px solid #ddd; border-radius:8px;">
                <input type="password" id="adm-pass" class="admin-input" placeholder="Password" style="width:100%; padding:12px; margin-bottom:20px; border:1px solid #ddd; border-radius:8px;">
                <button onclick="adminLogin()" class="btn-primary" style="width:100%; background:#10B981; color:white; padding:12px; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">Login</button>
            </div>
        `;
        return;
    }

    // Admin Dashboard UI
    const activeParent = currentPath[currentPath.length - 1];
    container.innerHTML = `
        <div class="admin-grid" style="display:grid; grid-template-columns: 350px 1fr; gap:20px;">
            <div class="admin-sidebar" style="background:#f9f9f9; padding:20px; border-radius:15px; border:1px solid #eee;">
                <h3 style="color:#10B981">Systematic Uploader</h3>
                <p style="font-size:13px; margin:10px 0;">Adding to: <b>${activeParent.title}</b></p>
                <hr style="margin:15px 0; border:0; border-top:1px solid #ddd;">
                
                <label style="font-size:12px; font-weight:bold;">Type</label>
                <select id="item-type" class="admin-input" onchange="toggleAdminFields(this.value)" style="width:100%; padding:10px; margin-bottom:15px;">
                    <option value="folder">📁 New Folder</option>
                    <option value="lecture">▶️ New Lecture (Video)</option>
                </select>

                <label style="font-size:12px; font-weight:bold;">Title</label>
                <input type="text" id="item-title" class="admin-input" placeholder="Name (e.g. Physics)" style="width:100%; padding:10px; margin-bottom:15px; border:1px solid #ddd; border-radius:5px;">
                
                <div id="lecture-fields" style="display:none; background:#fff; padding:10px; border-radius:10px; border:1px solid #eee; margin-bottom:15px;">
                    <input type="text" id="item-yt" class="admin-input" placeholder="YouTube Video ID" style="width:100%; margin-bottom:10px;">
                    <input type="text" id="item-notes" class="admin-input" placeholder="Notes Link (PDF)">
                    <input type="text" id="item-dpp" class="admin-input" placeholder="DPP Link (PDF)">
                </div>

                <button onclick="saveItem()" class="btn-primary" style="width:100%; padding:12px; background:#10B981; color:white; border:none; border-radius:8px; cursor:pointer;">Publish Now</button>
                <button onclick="auth.signOut()" style="width:100%; margin-top:10px; background:none; border:none; color:red; cursor:pointer; font-size:12px;">Logout</button>
            </div>

            <div id="admin-preview">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3>Content in ${activeParent.title}</h3>
                    <button onclick="navigateTo('root','Home')" style="font-size:12px; background:#eee; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">Go to Root</button>
                </div>
                <div class="grid" id="admin-grid-view" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:15px;"></div>
            </div>
        </div>
    `;
    loadAdminItems(activeParent.id);
};

async function loadAdminItems(parentId) {
    const grid = document.getElementById('admin-grid-view');
    const snapshot = await db.collection('content').where('parentId', '==', parentId).orderBy('createdAt', 'desc').get();
    
    if(snapshot.empty) {
        grid.innerHTML = `<p style="color:gray; font-size:13px;">No items here. Add one from the left.</p>`;
        return;
    }

    snapshot.forEach(doc => {
        const item = doc.data();
        const div = document.createElement('div');
        div.style = "background:white; border:1px solid #eee; padding:15px; border-radius:10px; text-align:center; position:relative; cursor:pointer;";
        div.innerHTML = `
            <div style="position:absolute; top:5px; right:5px;">
                <button onclick="deleteItem(event, '${doc.id}')" style="background:none; border:none; cursor:pointer;">🗑️</button>
            </div>
            <div style="font-size:24px;">${item.type === 'folder' ? '📁' : '▶️'}</div>
            <div style="font-size:12px; font-weight:bold; margin-top:5px;">${item.title}</div>
        `;
        div.onclick = () => {
            if(item.type === 'folder') {
                currentPath.push({id: doc.id, title: item.title});
                renderAdmin(); // Refresh admin view to go inside folder
            }
        };
        grid.appendChild(div);
    });
}

window.adminLogin = async () => {
    const e = document.getElementById('adm-email').value;
    const p = document.getElementById('adm-pass').value;
    try {
        await auth.signInWithEmailAndPassword(e, p);
        // Auth observer will automatically trigger renderAdmin
    } catch(err) { alert("Login Failed: " + err.message); }
};

window.saveItem = async () => {
    const title = document.getElementById('item-title').value;
    const type = document.getElementById('item-type').value;
    const parentId = currentPath[currentPath.length - 1].id;

    if(!title) return alert("Please enter a title");

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
    document.getElementById('item-title').value = ""; // Clear input
    renderAdmin(); // Refresh view
};

window.deleteItem = async (e, id) => {
    e.stopPropagation();
    if(confirm("Delete this item?")) {
        await db.collection('content').doc(id).delete();
        renderAdmin();
    }
};

window.toggleAdminFields = (val) => {
    document.getElementById('lecture-fields').style.display = val === 'lecture' ? 'block' : 'none';
};

async function renderLecture(id) {
    const container = document.getElementById('app-container');
    const doc = await db.collection('content').doc(id).get();
    const data = doc.data();

    container.innerHTML = `
        <div style="max-width:800px; margin:auto;">
            <button onclick="window.history.back()" style="margin-bottom:15px; border:none; background:none; color:#10B981; font-weight:bold; cursor:pointer;">← Back to Lectures</button>
            <div style="width:100%; aspect-ratio:16/9; background:#000; border-radius:15px; overflow:hidden;">
                <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${data.ytId}" frameborder="0" allowfullscreen></iframe>
            </div>
            <h2 style="margin-top:20px;">${data.title}</h2>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:20px;">
                <a href="${data.notes}" target="_blank" style="padding:15px; background:#f0fdf4; border:1px solid #10B981; border-radius:10px; text-align:center; text-decoration:none; color:#059669; font-weight:bold;">📄 View Notes</a>
                <a href="${data.dpp}" target="_blank" style="padding:15px; background:#f0fdf4; border:1px solid #10B981; border-radius:10px; text-align:center; text-decoration:none; color:#059669; font-weight:bold;">📝 View DPP</a>
            </div>
        </div>
    `;
}
