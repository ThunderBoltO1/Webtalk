// Pusher setup
const pusher = new Pusher('37361f4cd7d0f575faac', { // IMPORTANT: Replace with your Pusher key
    cluster: 'ap1' // IMPORTANT: Replace with your Pusher cluster
});

const channel = pusher.subscribe('watch-party');

async function triggerEvent(event, data) {
    // ใช้ triggerEvent เฉพาะ video-event เท่านั้น
    if (event === 'video-event') {
        await fetch('/api/pusher/trigger', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ channel: 'watch-party', event, data }),
        });
    }
}

// ----------------------
// Username Modal Logic
let username = '';
const nameModal = document.getElementById('name-modal');
const usernameInput = document.getElementById('username-input');
const enterChatBtn = document.getElementById('enter-chat-btn');
const currentUsernameSpan = document.getElementById('current-username');
const changeNameBtn = document.getElementById('change-name-btn');

function updateUserInfoBar() {
    if (username) {
        currentUsernameSpan.textContent = `ชื่อของคุณ: ${username}`;
        changeNameBtn.style.display = '';
    } else {
        currentUsernameSpan.textContent = '';
        changeNameBtn.style.display = 'none';
    }
}

// ฟังก์ชันสำหรับบันทึกชื่อใน localStorage
function saveUsername(name) {
    localStorage.setItem('watchparty-username', name);
}
// ฟังก์ชันสำหรับโหลดชื่อจาก localStorage
function loadUsername() {
    return localStorage.getItem('watchparty-username') || '';
}

function showNameModal() {
    nameModal.style.display = 'flex';
    usernameInput.value = '';
}
function hideNameModal() {
    nameModal.style.display = 'none';
}

const userListDiv = document.getElementById('user-list');
let isHost = false;

// ฟังก์ชันอัปเดต/เพิ่ม user ใน Firestore
async function updateUserOnline() {
    if (!username) return;
    await db.collection('users').doc(username).set({
        name: username,
        lastActive: firebase.firestore.FieldValue.serverTimestamp(),
        canControl: isHost
    }, { merge: true });
}

// อัปเดต lastActive ทุก 30 วินาที
setInterval(updateUserOnline, 30000);

// เมื่อเข้าห้องหรือเปลี่ยนชื่อ
async function onUserEnterOrChangeName() {
    // ตรวจสอบว่ามี host หรือยัง (คนแรกที่เข้าห้องจะเป็น host)
    const usersSnap = await db.collection('users').get();
    if (usersSnap.empty) {
        isHost = true;
    } else {
        // ถ้าเคยเป็น host มาก่อน ให้คงสถานะไว้
        const me = await db.collection('users').doc(username).get();
        isHost = me.exists && me.data().canControl === true;
    }
    await updateUserOnline();
    updateUserInfoBar();
    updateControlsAccess();
}

// ดึงรายชื่อผู้ใช้ที่ออนไลน์ (lastActive < 1 นาที)
db.collection('users').orderBy('name').onSnapshot(snapshot => {
    const now = Date.now();
    userListDiv.innerHTML = '';
    let foundHost = false;
    snapshot.forEach(doc => {
        const data = doc.data();
        const lastActive = data.lastActive && data.lastActive.toDate ? data.lastActive.toDate().getTime() : 0;
        if (now - lastActive < 60000) { // 1 นาที
            // แสดงชื่อและปุ่มมอบสิทธิ์ host (เฉพาะ host เท่านั้นที่เห็นปุ่ม)
            const userItem = document.createElement('div');
            userItem.className = 'flex items-center gap-2';
            userItem.innerHTML = `<span class="${data.canControl ? 'text-green-400 font-bold' : ''}">${escapeHTML(data.name)}</span>`;
            if (isHost && data.name !== username) {
                const btn = document.createElement('button');
                btn.textContent = 'ให้สิทธิ์เลือกคลิป';
                btn.className = 'bg-purple-500 hover:bg-purple-600 text-white text-xs px-2 py-1 rounded';
                btn.onclick = async () => {
                    // มอบสิทธิ์ host ให้ user นี้ และยกเลิกสิทธิ์ตัวเอง
                    await db.collection('users').get().then(snap => {
                        snap.forEach(async d => {
                            await db.collection('users').doc(d.id).update({ canControl: d.id === data.name });
                        });
                    });
                };
                userItem.appendChild(btn);
            }
            if (data.canControl) foundHost = true;
            userListDiv.appendChild(userItem);
        }
    });
    // ถ้าไม่มี host เลย ให้ host คนแรกที่ออนไลน์
    if (!foundHost && username) {
        db.collection('users').doc(username).update({ canControl: true });
        isHost = true;
        updateControlsAccess();
    }
});

// อัปเดตสิทธิ์การค้นหา/เลือกคลิป
function updateControlsAccess() {
    const searchInput = document.getElementById('search-query');
    const searchBtn = document.getElementById('search-btn');
    if (isHost) {
        searchInput.disabled = false;
        searchBtn.disabled = false;
        searchBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        searchInput.disabled = true;
        searchBtn.disabled = true;
        searchBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

enterChatBtn.addEventListener('click', async () => {
    const name = usernameInput.value.trim();
    if (name) {
        username = name;
        saveUsername(name);
        hideNameModal();
        await onUserEnterOrChangeName();
    } else {
        usernameInput.classList.add('ring-2', 'ring-red-500');
    }
});

// เมื่อโหลดหน้าเว็บ ให้เช็ค localStorage
window.addEventListener('DOMContentLoaded', async () => {
    const saved = loadUsername();
    if (saved) {
        username = saved;
        hideNameModal();
        await onUserEnterOrChangeName();
    } else {
        showNameModal();
    }
    updateUserInfoBar();
});

// ปุ่มเปลี่ยนชื่อ
changeNameBtn.addEventListener('click', () => {
    showNameModal();
});

// ----------------------
// Firestore Chat Setup (with username)
const messages = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendMessageBtn = document.getElementById('send-message');

// เพิ่มฟีเจอร์กด Enter เพื่อส่งข้อความ
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        sendMessageBtn.click();
    }
});

sendMessageBtn.addEventListener('click', async () => {
    const text = messageInput.value.trim();
    if (text === '' || !username) return;
    if (typeof db === 'undefined') {
        alert('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณารีเฟรชหน้าเว็บ');
        return;
    }
    try {
        await db.collection('messages').add({
            text: text,
            username: username,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        messageInput.value = '';
    } catch (error) {
        console.error('Error adding message:', error);
        alert('เกิดข้อผิดพลาดในการส่งข้อความ');
    }
});

// Escape HTML เพื่อป้องกัน XSS
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, function(tag) {
        const charsToReplace = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        };
        return charsToReplace[tag] || tag;
    });
}

function renderMessage(doc) {
    const data = doc.data();
    const item = document.createElement('div');
    const name = escapeHTML(data.username || 'ไม่ระบุชื่อ');
    const text = escapeHTML(data.text);
    item.textContent = `${name} : ${text}`;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
}

function clearMessages() {
    messages.innerHTML = '';
}

if (typeof db !== 'undefined') {
    db.collection('messages').orderBy('timestamp').onSnapshot(snapshot => {
        clearMessages();
        snapshot.forEach(doc => {
            renderMessage(doc);
        });
    }, err => {
        console.error('Firestore listen error:', err);
        alert('ไม่สามารถเชื่อมต่อฐานข้อมูลแบบเรียลไทม์ได้');
    });
} else {
    alert('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณารีเฟรชหน้าเว็บ');
}

// YouTube Player
let player;
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '360',
        width: '640',
        videoId: 'M7lc1UVf-VE', // Default video
        events: {
            'onStateChange': onPlayerStateChange
        }
    });
}

const YOUTUBE_API_KEY = 'AIzaSyDC80-0eP7mC4kFBRlcIsLqq82yYoH2osw'; // IMPORTANT: Replace with your YouTube Data API key

const searchInput = document.getElementById('search-query');
const searchBtn = document.getElementById('search-btn');
const searchResultsContainer = document.getElementById('search-results');

searchBtn.addEventListener('click', () => {
    const query = searchInput.value;
    if (query) {
        searchYouTube(query);
        searchInput.value = '';
    }
});

async function searchYouTube(query) {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&key=${YOUTUBE_API_KEY}`);
    const data = await response.json();
    displaySearchResults(data.items);
    // searchInput.value = ''; // ไม่ต้องล้างซ้ำตรงนี้ เพราะล้างใน click handler แล้ว
}

function displaySearchResults(videos) {
    searchResultsContainer.innerHTML = '';
    videos.forEach(video => {
        const result = document.createElement('div');
        result.className = 'search-result bg-gray-800 p-2 rounded-lg flex items-center gap-4 cursor-pointer hover:bg-gray-700';
        result.innerHTML = `
            <img src="${video.snippet.thumbnails.default.url}" alt="${video.snippet.title}" class="w-32 h-18 object-cover rounded">
            <p class="flex-grow">${video.snippet.title}</p>
        `;
        result.addEventListener('click', () => {
            const videoId = video.id.videoId;
            player.loadVideoById(videoId);
            triggerEvent('video-event', { type: 'load', videoId });
            searchResultsContainer.innerHTML = ''; // Clear results
        });
        searchResultsContainer.appendChild(result);
    });
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        triggerEvent('video-event', { type: 'play', currentTime: player.getCurrentTime() });
    } else if (event.data === YT.PlayerState.PAUSED) {
        triggerEvent('video-event', { type: 'pause' });
    }
}

// (ลบหรือคอมเมนต์ channel.bind('chat-message', ...); ออก เพราะไม่ใช้ Pusher กับแชท)

// ตัวอย่างทดสอบ YouTube API (สามารถลบออกได้หลังทดสอบ)
// (ลบออก)
