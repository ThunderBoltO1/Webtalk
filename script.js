// Pusher setup
const pusher = new Pusher('37361f4cd7d0f575faac', { // IMPORTANT: Replace with your Pusher key
    cluster: 'ap1' // IMPORTANT: Replace with your Pusher cluster
});

const channel = pusher.subscribe('watch-party');

async function triggerEvent(event, data) {
    // ใช้ triggerEvent เฉพาะ video-event เท่านั้น
    if (event === 'video-event') {
        // Add username to the data to identify the sender
        const eventData = {
            ...data,
            username: username  // Add current username to the event data
        };
        await fetch('/api/pusher/trigger', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                channel: 'watch-party', 
                event, 
                data: eventData 
            }),
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
    
    // ตรวจสอบว่ามีผู้ใช้ในห้องหรือไม่
    const usersSnap = await db.collection('users').get();
    const isFirstUser = usersSnap.empty;
    
    // ถ้าเป็นคนแรกที่เข้าห้อง ให้เป็น host โดยอัตโนมัติ
    if (isFirstUser) {
        isHost = true;
    }
    
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
    // ตรวจสอบว่ามีผู้ใช้ในห้องหรือไม่
    const usersSnap = await db.collection('users').get();
    const isFirstUser = usersSnap.empty;
    
    // ถ้าเป็นคนแรกที่เข้าห้อง ให้เป็น host โดยอัตโนมัติ
    if (isFirstUser) {
        isHost = true;
    } else {
        // ถ้าไม่ใช่คนแรก ตรวจสอบว่าเคยเป็น host มาก่อนหรือไม่
        const me = await db.collection('users').doc(username).get();
        isHost = me.exists && me.data().canControl === true;
    }
    
    await updateUserOnline();
    updateUserInfoBar();
    updateControlsAccess();
}

// ดึงรายชื่อผู้ใช้ที่ออนไลน์ (lastActive < 1 นาที)
db.collection('users').orderBy('name').onSnapshot(async (snapshot) => {
    const now = Date.now();
    userListDiv.innerHTML = '';
    let foundHost = false;
    
    // เก็บข้อมูลผู้ใช้ทั้งหมดที่ออนไลน์
    const onlineUsers = [];
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const lastActive = data.lastActive && data.lastActive.toDate ? data.lastActive.toDate().getTime() : 0;
        if (now - lastActive < 60000) { // 1 นาที
            onlineUsers.push({
                ...data,
                id: doc.id
            });
            
            // ตรวจสอบว่าตัวเองเป็น host หรือไม่
            if (data.name === username && data.canControl) {
                isHost = true;
                foundHost = true;
            } else if (data.canControl) {
                foundHost = true;
            }
        }
    });
    
    // แสดงรายชื่อผู้ใช้
    onlineUsers.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'flex items-center justify-between gap-2';
        userItem.innerHTML = `
            <span class="${user.canControl ? 'text-green-400 font-bold' : ''}">
                ${escapeHTML(user.name)}
                ${user.canControl ? ' (ผู้ควบคุม)' : ''}
            </span>
        `;
        
        // แสดงปุ่มให้สิทธิ์เฉพาะ host ปัจจุบันเท่านั้น
        if (isHost && user.name !== username) {
            const btn = document.createElement('button');
            btn.textContent = 'ส่งต่อสิทธิ์';
            btn.className = 'bg-purple-500 hover:bg-purple-600 text-white text-xs px-2 py-1 rounded';
            btn.onclick = async () => {
                // ยืนยันการโอนสิทธิ์
                if (confirm(`ยืนยันที่จะมอบสิทธิ์ควบคุมให้กับ ${user.name} ใช่หรือไม่?`)) {
                    // ปิดสิทธิ์ host จากทุกคน
                    const batch = db.batch();
                    onlineUsers.forEach(u => {
                        const userRef = db.collection('users').doc(u.id);
                        batch.update(userRef, { canControl: false });
                    });
                    
                    // มอบสิทธิ์ให้กับผู้ใช้ที่เลือก
                    const newHostRef = db.collection('users').doc(user.id);
                    batch.update(newHostRef, { canControl: true });
                    
                    // บันทึกการเปลี่ยนแปลงทั้งหมด
                    await batch.commit();
                    
                    // อัปเดตสถานะ host ของตัวเอง
                    isHost = false;
                    updateControlsAccess();
                    updateUserInfoBar();
                }
            };
            userItem.appendChild(btn);
        }
        
        userListDiv.appendChild(userItem);
    });
    
    // ถ้าไม่มี host เลย และมีผู้ใช้ในห้อง
    if (!foundHost && onlineUsers.length > 0) {
        // ให้คนแรกในรายการเป็น host
        const firstUser = onlineUsers[0];
        await db.collection('users').doc(firstUser.id).update({ 
            canControl: true 
        });
        
        // ถ้าเป็นเรา ให้อัปเดตสถานะด้วย
        if (firstUser.name === username) {
            isHost = true;
            updateControlsAccess();
        }
    }
    
    // อัปเดต UI ตามสถานะ host ปัจจุบัน
    updateControlsAccess();
    updateUserInfoBar();
});

// อัปเดตสิทธิ์การค้นหา/เลือกคลิป
function updateControlsAccess() {
    const searchInput = document.getElementById('search-query');
    const searchBtn = document.getElementById('search-btn');
    
    if (isHost) {
        searchInput.disabled = false;
        searchBtn.disabled = false;
        searchInput.placeholder = 'ค้นหาวิดีโอ...';
        searchBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        searchInput.disabled = true;
        searchBtn.disabled = true;
        searchInput.placeholder = 'เฉพาะผู้ควบคุมเท่านั้นที่สามารถค้นหาได้';
        searchBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    
    // อัปเดตปุ่มเปลี่ยนชื่อ
    const changeNameBtn = document.getElementById('change-name-btn');
    if (changeNameBtn) {
        changeNameBtn.style.display = username ? 'block' : 'none';
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
let playerReady = false;
let pendingVideoEvent = null;

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '360',
        width: '640',
        videoId: 'M7lc1UVf-VE', // Default video
        events: {
            'onReady': () => {
                playerReady = true;
                // ถ้ามี event ที่รอไว้ ให้ execute เลย
                if (pendingVideoEvent) {
                    handleVideoEvent(pendingVideoEvent);
                    pendingVideoEvent = null;
                }
            },
            'onStateChange': onPlayerStateChange
        }
    });
}

// ฟังก์ชันนี้ใช้สำหรับ handle event จาก Pusher
function handleVideoEvent(data) {
    if (!playerReady) {
        pendingVideoEvent = data;
        return;
    }
    switch (data.type) {
        case 'load':
            // ถ้า videoId เดียวกับที่เล่นอยู่แล้ว ไม่ต้อง load ซ้ำ
            if (player.getVideoData && player.getVideoData().video_id === data.videoId) return;
            player.loadVideoById(data.videoId);
            break;
        case 'play':
            // sync play เฉพาะเมื่อ player ไม่ได้เล่นอยู่
            if (player && typeof player.seekTo === 'function') {
                if (player.getPlayerState && player.getPlayerState() !== YT.PlayerState.PLAYING) {
                    player.seekTo(data.currentTime, true);
                    player.playVideo();
                }
            }
            break;
        case 'pause':
            // sync pause เฉพาะเมื่อ player กำลังเล่น
            if (player && typeof player.pauseVideo === 'function') {
                if (player.getPlayerState && player.getPlayerState() === YT.PlayerState.PLAYING) {
                    player.pauseVideo();
                }
            }
            break;
    }
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

// Listen for video events from other clients
channel.bind('video-event', function(data) {
    if (data && data.type) {
        // Only handle the event if it's not from the current user
        if (data.username !== username) {
            handleVideoEvent(data);
        }
    }
});

// ตัวอย่างทดสอบ YouTube API (สามารถลบออกได้หลังทดสอบ)
// (ลบออก)

// Popup รายชื่อผู้เข้าร่วม
const userListPopupBtn = document.getElementById('user-list-popup-btn');
const userListPopup = document.getElementById('user-list-popup');
const closeUserListPopup = document.getElementById('close-user-list-popup');

userListPopupBtn.addEventListener('click', () => {
    userListPopup.classList.remove('hidden');
});
closeUserListPopup.addEventListener('click', () => {
    userListPopup.classList.add('hidden');
});
