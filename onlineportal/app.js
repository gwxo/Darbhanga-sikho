// --- CONFIGURATION ---
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

// --- ROUTER ---
const routes = {
    home: '/',
    online: '/online',
    folder: '/folder/:id',
    lecture: '/lecture/:id',
    admin: '/admin'
};

const appContainer = document.getElementById('app-container');

const navigateTo = (url) => {
    history.pushState(null, null, url);
    router();
};

const router = async () => {
    const path = window.location.pathname;
    appContainer.innerHTML = '<div class="skeleton-loader"></div>';

    if (path === '/' || path === '/online') {
        renderDirectory('root');
    } else if (path.startsWith('/folder/')) {
        const id = path.split('/')[2];
        renderDirectory(id);
    } else if (path.startsWith('/lecture/')) {
        const id = path.split('/')[2];
        renderLecturePage(id);
    } else if (path === '/admin') {
        renderAdminPanel();
    }
};

window.addEventListener("popstate", router);

function route(e) {
    e.preventDefault();
    navigateTo(e.currentTarget.getAttribute('href'));
}

// --- DATA SERVICES ---

// Fetch Folders and Lectures for a specific Parent
async function getContent(parentId) {
    const snapshot = await db.collection('content')
        .where('parentId', '==', parentId)
        .orderBy('order', 'asc')
        .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- UI COMPONENTS ---

async function renderDirectory(parentId) {
    const items = await getContent(parentId);
    
    let html = `<div class="breadcrumbs">${await generateBreadcrumbs(parentId)}</div>`;
    html += `<div class="grid">`;

    if (items.length === 0) {
        html += `<div class="empty-state">No content found here yet.</div>`;
    }

    items.forEach(item => {
        const icon = item.type === 'folder' ? '#icon-folder' : '#icon-play';
        const link = item.type === 'folder' ? `/folder/${item.id}` : `/lecture/${item.id}`;
        
        html += `
            <div class="card" onclick="navigateTo('${link}')">
                <svg class="icon"><use xlink:href="${icon}"></use></svg>
                <h3>${item.title}</h3>
            </div>
        `;
    });

    html += `</div>`;
    appContainer.innerHTML = html;
}

async function renderLecturePage(id) {
    const doc = await db.collection('content').doc(id).get();
    const data = doc.data();

    appContainer.innerHTML = `
        <div class="lecture-view">
            <div class="video-container">
                <iframe src="https://www.youtube.com/embed/${data.youtubeId}" allowfullscreen></iframe>
            </div>
            <h1 style="margin-top:20px">${data.title}</h1>
            <p style="color:var(--text-muted)">${data.description || ''}</p>
            
            <div class="resource-grid">
                ${renderResourceLink('Notes PDF', data.notesUrl, '#icon-file')}
                ${renderResourceLink('DPP Sheet', data.dppUrl, '#icon-file')}
                ${renderResourceLink('PYQ Questions', data.pyqUrl, '#icon-file')}
                ${renderResourceLink('Practice Set', data.practiceUrl, '#icon-file')}
            </div>
        </div>
    `;
}

function renderResourceLink(label, url, icon) {
    if (!url) return '';
    return `
        <a href="${url}" target="_blank" class="resource-card">
            <svg class="icon"><use xlink:href="${icon}"></use></svg>
            <span>${label}</span>
        </a>
    `;
}

async function generateBreadcrumbs(currentId) {
    if (currentId === 'root') return '<span class="breadcrumb-item">Online Classes</span>';
    // Logic to fetch parent chain recursively (requires parent object to store its parent name)
    return `<a href="/online" onclick="route(event)" class="breadcrumb-item">Home</a>`;
}

// --- ADMIN LOGIC ---

async function renderAdminPanel() {
    // 1. Check Auth
    const user = auth.currentUser;
    if (!user) {
        appContainer.innerHTML = `
            <div class="card" style="max-width:400px; margin:auto">
                <h2>Admin Login</h2>
                <input type="email" id="admin-email" placeholder="Email" style="width:100%; margin:10px 0; padding:10px">
                <input type="password" id="admin-password" placeholder="Password" style="width:100%; margin:10px 0; padding:10px">
                <button onclick="adminLogin()" class="home-btn" style="border:none; width:100%; justify-content:center">Login</button>
            </div>
        `;
        return;
    }

    // 2. Render Admin Dashboard
    appContainer.innerHTML = `
        <div class="admin-header">
            <h2>Manage Content</h2>
            <button onclick="showAddModal()" class="home-btn">Add New Item</button>
        </div>
        <div id="admin-list" class="grid" style="margin-top:20px"></div>
    `;
    // Load root items for management...
}

window.adminLogin = async () => {
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-password').value;
    try {
        await auth.signInWithEmailAndPassword(email, pass);
        router();
    } catch (e) { alert(e.message); }
};

// Initial Load
window.onload = router;
window.navigateTo = navigateTo; // Make global for inline onclick
