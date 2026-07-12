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

// State
let currentFolderId = 'root';
let breadcrumbs = [{ id: 'root', name: 'Home' }];

// --- ROUTER ---
const handleRoute = () => {
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
        breadcrumbs = [{ id: 'root', name: 'Home' }];
        renderUserView();
    }
};

window.addEventListener('hashchange', handleRoute);
window.onload = handleRoute;

// --- USER VIEW ---
function renderUserView() {
    const app = document.getElementById('app-container');
    app.innerHTML = `
        <div style="margin-bottom:15px; font-weight:700; color:var(--primary);" id="bc-container"></div>
        <div class="grid" id="main-grid"></div>
    `;
    
    // Render Breadcrumbs
    document.getElementById('bc-container').innerHTML = breadcrumbs.map((b, i) => 
        `<span style="cursor:pointer" onclick="jumpTo(${i})">${b.name}</span>`
    ).join(' / ');

    // REAL-TIME LISTENER (No Indexing Required for single where query)
    db.collection('content').where('parentId', '==', currentFolderId)
    .onSnapshot(snap => {
        const grid = document.getElementById('main-grid');
        grid.innerHTML = '';
        if(snap.empty) grid.innerHTML = '<p>No content found here.</p>';
        
        snap.forEach(doc => {
            const item = doc.data();
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <svg viewBox="0 0 24 24"><path d="${item.type==='folder'?'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z':'M8 5v14l11-7z'}"/></svg>
                <h3>${item.title}</h3>
            `;
            card.onclick = () => {
                if(item.type === 'folder') {
                    breadcrumbs.push({ id: doc.id, name: item.title });
                    location.hash = `#folder/${doc.id}`;
                } else {
                    location.hash = `#lecture/${doc.id}`;
                }
            };
            grid.appendChild(card);
        });
    });
}

function jumpTo(index) {
    const target = breadcrumbs[index];
    breadcrumbs = breadcrumbs.slice(0, index + 1);
    location.hash = target.id === 'root' ? '#home' : `#folder/${target.id}`;
}

// --- ADMIN PANEL ---
async function renderAdmin() {
    const app = document.getElementById('app-container');
    const user = auth.currentUser;

    if (!user) {
        app.innerHTML = `<div class="card" style="max-width:350px; margin:auto;">
            <h2>Admin Login</h2><br>
            <input type="email" id="email" class="input" placeholder="Email">
            <input type="password" id="pass" class="input" placeholder="Password">
            <button onclick="login()" class="btn-primary">Login</button>
        </div>`;
        return;
    }

    app.innerHTML = `
        <div class="admin-split">
            <div class="form-card">
                <h3>Uploader</h3>
                <p style="font-size:12px; margin-bottom:15px;">Target: <b>${breadcrumbs[breadcrumbs.length-1].name}</b></p>
                <select id="type" class="input" onchange="toggleLec(this.value)">
                    <option value="folder">New Folder</option>
                    <option value="lecture">New Lecture</option>
                </select>
                <input type="text" id="title" class="input" placeholder="Title">
                <div id="lec-only" style="display:none;">
                    <input type="text" id="yt" class="input" placeholder="YouTube Video ID">
                    <input type="text" id="notes" class="input" placeholder="Notes Link">
                    <input type="text" id="dpp" class="input" placeholder="DPP Link">
                </div>
                <button onclick="publish()" class="btn-primary">Publish Now</button>
                <button onclick="auth.signOut()" style="margin-top:10px; background:none; border:none; color:red; cursor:pointer; width:100%;">Logout</button>
            </div>
            <div id="admin-list" class="grid"></div>
        </div>
    `;
    loadAdminItems();
}

function toggleLec(v) { document.getElementById('lec-only').style.display = v==='lecture'?'block':'none'; }

async function publish() {
    const title = document.getElementById('title').value;
    const type = document.getElementById('type').value;
    const parentId = breadcrumbs[breadcrumbs.length - 1].id;

    if(!title) return alert("Title required");

    try {
        await db.collection('content').add({
            title, type, parentId,
            ytId: document.getElementById('yt')?.value || '',
            notes: document.getElementById('notes')?.value || '',
            dpp: document.getElementById('dpp')?.value || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Published Successfully!");
        document.getElementById('title').value = '';
    } catch(e) { alert("Error: " + e.message); }
}

function loadAdminItems() {
    db.collection('content').where('parentId', '==', breadcrumbs[breadcrumbs.length-1].id)
    .onSnapshot(snap => {
        const grid = document.getElementById('admin-list');
        grid.innerHTML = '';
        snap.forEach(doc => {
            const item = doc.data();
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `<b>${item.title}</b><br><button onclick="delDoc(event,'${doc.id}')" style="color:red; border:none; background:none; cursor:pointer; margin-top:10px;">Delete</button>`;
            div.onclick = () => {
                if(item.type === 'folder') {
                    breadcrumbs.push({ id: doc.id, name: item.title });
                    renderAdmin();
                }
            };
            grid.appendChild(div);
        });
    });
}

window.delDoc = async (e, id) => {
    e.stopPropagation();
    if(confirm("Delete this?")) await db.collection('content').doc(id).delete();
}

window.login = () => {
    auth.signInWithEmailAndPassword(document.getElementById('email').value, document.getElementById('pass').value)
    .then(() => handleRoute()).catch(e => alert(e.message));
}

// --- LECTURE PLAYER ---
async function renderLecture(id) {
    const doc = await db.collection('content').doc(id).get();
    const data = doc.data();
    document.getElementById('app-container').innerHTML = `
        <button onclick="window.history.back()" style="margin-bottom:15px; background:none; border:none; color:var(--primary); font-weight:800; cursor:pointer;">← Back</button>
        <div class="video-wrapper">
            <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${data.ytId}" frameborder="0" allowfullscreen></iframe>
        </div>
        <h2>${data.title}</h2><br>
        <div class="resource-box">
            <a href="${data.notes}" target="_blank" class="res-item">Notes PDF</a>
            <a href="${data.dpp}" target="_blank" class="res-item">DPP PDF</a>
        </div>
    `;
}
