// Dark/Light Mode Toggle
const themeToggleBtn = document.getElementById('theme-toggle');
const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

// Check for saved user preference, if any, on load
const savedTheme = localStorage.getItem('color-theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

// Apply the saved theme
if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
    themeToggleLightIcon.classList.remove('hidden');
} else {
    document.documentElement.classList.remove('dark');
    themeToggleDarkIcon.classList.remove('hidden');
}

// Toggle theme when button is clicked
themeToggleBtn.addEventListener('click', () => {
    // Toggle icons
    themeToggleDarkIcon.classList.toggle('hidden');
    themeToggleLightIcon.classList.toggle('hidden');
    
    // Toggle theme
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('color-theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('color-theme', 'dark');
    }
});

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

// ตัวแปรเก็บข้อความล่าสุด
let lastRenderedMessage = null;

function renderMessage(doc) {
    const data = doc.data();
    const item = document.createElement('div');
    item.className = 'message-container mb-1';
    
    const name = escapeHTML(data.username || 'ไม่ระบุชื่อ');
    const text = escapeHTML(data.text);
    
    // Format timestamp
    let timestamp = new Date();
    if (data.timestamp && data.timestamp.toDate) {
        timestamp = data.timestamp.toDate();
    } else if (data.timestamp?.seconds) {
        timestamp = new Date(data.timestamp.seconds * 1000);
    }
    
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Format วันที่และเวลา
    const currentDate = new Date();
    let timeString = '';
    
    // ตรวจสอบว่าเป็นวันเดียวกันหรือไม่
    if (timestamp.toDateString() === currentDate.toDateString()) {
        // ถ้าวันนี้ แสดงแค่เวลา
        timeString = timestamp.toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } else {
        // ถ้าไม่ใช่วันนี้ แสดงวันที่และเวลา
        timeString = `${timestamp.toLocaleDateString('th-TH', {
            month: 'short',
            day: 'numeric'
        })} ${timestamp.toLocaleTimeString('th-TH', { 
            hour: '2-digit', 
            minute: '2-digit' 
        })}`;
    }
    
    item.innerHTML = `
        <div class="message-bubble inline-block max-w-xs lg:max-w-md bg-gray-700 rounded-xl px-4 py-2">
            ${data.username !== username ? `<div class="font-bold text-sm text-pink-300">${name}</div>` : ''}
            <div class="message-text text-white">${text}</div>
            <div class="text-right">
                <span class="text-xs text-gray-400">${timeString}</span>
            </div>
        </div>
    `;
    
    // Add different styling for current user's messages
    if (data.username === username) {
        item.classList.add('text-right');
        item.querySelector('.message-bubble').classList.add('ml-auto', 'bg-blue-600');
        item.querySelector('.message-text').classList.add('text-white');
    }
    
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    
    // Hide the empty message placeholder if it exists
    const emptyMsg = document.getElementById('messages-empty');
    if (emptyMsg) emptyMsg.style.display = 'none';
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
let player;
let playerReady = false;
let pendingVideoEvent = null;
let currentVideoId = 'M7lc1UVf-VE'; // Default video ID
let isSyncing = false; // ป้องกันการวนลูป sync

// ฟังก์ชันสำหรับสร้าง YouTube Player
function createYouTubePlayer(videoId) {
    console.log('Creating YouTube player with videoId:', videoId);
    
    // ตรวจสอบว่ามี element นี้จริงๆ
    const playerElement = document.getElementById('player');
    if (!playerElement) {
        console.error('player element not found!');
        return;
    }
    
    console.log('Player element found, creating player...');
    
    // ใช้ domain ที่เป็น privacy-enhanced mode
    player = new YT.Player('player', {
        height: '360',
        width: '640',
        videoId: videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
            'origin': window.location.origin,
            'enablejsapi': 1,
            'widget_referrer': window.location.href,
            'rel': 0,
            'modestbranding': 1, // ซ่อนโลโก้ YouTube
            'playsinline': 1
        },
        events: {
            'onReady': function(event) {
                console.log('YouTube Player is ready');
                if (typeof onPlayerReady === 'function') {
                    onPlayerReady(event);
                }
            },
            'onStateChange': function(event) {
                console.log('Player state changed:', event.data);
                if (typeof onPlayerStateChange === 'function') {
                    onPlayerStateChange(event);
                }
            },
            'onError': function(error) {
                console.error('YouTube Player Error:', error);
                if (typeof onPlayerError === 'function') {
                    onPlayerError(error);
                }
            }
        }
    });
}

function onPlayerReady(event) {
    console.log('YouTube Player is ready');
    playerReady = true;
    
    // ถ้ามี event ที่รออยู่ ให้ execute เลย
    if (pendingVideoEvent) {
        handleVideoEvent(pendingVideoEvent);
        pendingVideoEvent = null;
    }
    
    // แจ้งให้ผู้ใช้ทราบถ้าเป็น host
    if (isHost) {
        console.log('คุณเป็นผู้ควบคุมการเล่นวิดีโอ');
    }
}

function onPlayerError(error) {
    console.error('YouTube Player Error:', error);
}

// ฟังก์ชันนี้ใช้สำหรับ handle event จาก Pusher
function handleVideoEvent(data) {
    if (!playerReady) {
        pendingVideoEvent = data;
        return;
    }
    
    // ตรวจสอบว่าเป็น event จากตัวเองหรือไม่
    if (data.username === username) return;
    
    // ตั้งค่าสถานะกำลัง sync
    isSyncing = true;
    
    try {
        switch (data.type) {
            case 'load':
                // ตรวจสอบว่าเป็นวิดีโอใหม่หรือไม่
                if (player.getVideoData && player.getVideoData().video_id !== data.videoId) {
                    console.log('Loading new video:', data.videoId);
                    currentVideoId = data.videoId;
                    player.loadVideoById(data.videoId);
                }
                break;
                
            case 'play':
                if (player && typeof player.seekTo === 'function') {
                    const currentState = player.getPlayerState();
                    if (currentState !== YT.PlayerState.PLAYING) {
                        console.log('Syncing play at time:', data.currentTime);
                        player.seekTo(data.currentTime, true);
                        setTimeout(() => {
                            player.playVideo();
                        }, 100);
                    }
                }
                break;
                
            case 'pause':
                if (player && typeof player.pauseVideo === 'function') {
                    const currentState = player.getPlayerState();
                    if (currentState === YT.PlayerState.PLAYING) {
                        console.log('Syncing pause');
                        player.pauseVideo();
                    }
                }
                break;
                
            case 'seek':
                if (player && typeof player.seekTo === 'function') {
                    console.log('Syncing seek to:', data.currentTime);
                    player.seekTo(data.currentTime, true);
                }
                break;
        }
    } catch (error) {
        console.error('Error handling video event:', error);
    } finally {
        // รีเซ็ตสถานะ sync
        setTimeout(() => {
            isSyncing = false;
        }, 500);
    }
}

// ฟังก์ชันสำหรับส่ง event ไปยังผู้ใช้คนอื่น
async function broadcastVideoEvent(eventType, data = {}) {
    if (isSyncing) return; // ไม่ต้องส่ง event ถ้ากำลัง sync อยู่
    
    const eventData = {
        type: eventType,
        username: username,
        videoId: currentVideoId,
        ...data
    };
    
    await triggerEvent('video-event', eventData);
}

function onPlayerStateChange(event) {
    if (!isHost || isSyncing) return; // ไม่ต้องทำอะไรถ้าไม่ใช่ host หรือกำลัง sync อยู่
    console.log('Player state changed:', event.data);
    
    const currentTime = player.getCurrentTime();
    const now = Date.now();
    
    // ตรวจสอบว่า state เปลี่ยนหรือไม่
    if (event.data !== lastState) {
        console.log('Player state changed:', getStateName(event.data));
        lastState = event.data;
        
        switch (event.data) {
            case YT.PlayerState.PLAYING:
                broadcastVideoEvent('play', { currentTime: currentTime });
                break;
                
            case YT.PlayerState.PAUSED:
                broadcastVideoEvent('pause', { currentTime: currentTime });
                break;
                
            case YT.PlayerState.ENDED:
                broadcastVideoEvent('pause', { currentTime: 0 });
                break;
        }
    }
    
    // อัปเดตเวลาเล่นทุก 1 วินาที
    if (now - lastTimeUpdate > 1000 && event.data === YT.PlayerState.PLAYING) {
        lastTimeUpdate = now;
        broadcastVideoEvent('seek', { currentTime: currentTime });
    }
}

// ฟังก์ชันช่วยแปลง state เป็นชื่อ
function getStateName(state) {
    const states = {
        [-1]: 'UNSTARTED',
        0: 'ENDED',
        1: 'PLAYING',
        2: 'PAUSED',
        3: 'BUFFERING',
        5: 'VIDEO_CUED'
    };
    return states[state] || 'UNKNOWN';
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
        result.addEventListener('click', async () => {
            if (!isHost) return; // ตรวจสอบสิทธิ์การควบคุม
            
            function loadVideo(videoId) {
                console.log('loadVideo called with videoId:', videoId);
                if (!videoId) {
                    console.error('No videoId provided');
                    return;
                }
                
                currentVideoId = videoId;
                
                // ส่ง event ไปยังผู้ใช้คนอื่น
                console.log('Broadcasting load event for video:', videoId);
                broadcastVideoEvent('load', { 
                    videoId: videoId,
                    timestamp: new Date().toISOString()
                });
                
                // โหลดวิดีโอในเครื่องตัวเอง
                if (player) {
                    console.log('Loading video in existing player');
                    player.loadVideoById(videoId);
                } else {
                    // ถ้ายังไม่มี player ให้สร้างใหม่
                    console.log('Creating new YouTube player');
                    createYouTubePlayer(videoId);
                }
            }
            
            const videoId = video.id.videoId;
            loadVideo(videoId);
            
            // ล้างผลการค้นหา
            searchResultsContainer.innerHTML = '';
            searchInput.value = '';
            
            // แจ้งเตือนผู้ใช้
            alert('กำลังโหลดวิดีโอใหม่ กรุณารอสักครู่...');
        });
        searchResultsContainer.appendChild(result);
    });
}

// ตัวแปรสำหรับติดตามสถานะการเล่นวิดีโอ
let lastState = -1;
let lastTimeUpdate = 0;

// ฟังก์ชันหลักสำหรับจัดการการเปลี่ยนแปลงสถานะวิดีโอ
function onPlayerStateChange(event) {
    if (!isHost || isSyncing) return; // ไม่ต้องทำอะไรถ้าไม่ใช่ host หรือกำลัง sync อยู่
    
    const currentTime = player.getCurrentTime();
    const now = Date.now();
    
    // ตรวจสอบว่า state เปลี่ยนหรือไม่
    if (event.data !== lastState) {
        console.log('Player state changed:', getStateName(event.data));
        lastState = event.data;
        
        switch (event.data) {
            case YT.PlayerState.PLAYING:
                broadcastVideoEvent('play', { currentTime: currentTime });
                break;
                
            case YT.PlayerState.PAUSED:
                broadcastVideoEvent('pause', { currentTime: currentTime });
                break;
                
            case YT.PlayerState.ENDED:
                broadcastVideoEvent('pause', { currentTime: 0 });
                break;
        }
    }
    
    // อัปเดตเวลาเล่นทุก 1 วินาที
    if (now - lastTimeUpdate > 1000 && event.data === YT.PlayerState.PLAYING) {
        lastTimeUpdate = now;
        broadcastVideoEvent('seek', { currentTime: currentTime });
    }
}

// ฟังก์ชันช่วยแปลง state เป็นชื่อ
function getStateName(state) {
    const states = {
        [-1]: 'UNSTARTED',
        0: 'ENDED',
        1: 'PLAYING',
        2: 'PAUSED',
        3: 'BUFFERING',
        5: 'VIDEO_CUED'
    };
    return states[state] || 'UNKNOWN';
}

// ฟังก์ชันสำหรับส่ง event ไปยังผู้ใช้คนอื่น
async function broadcastVideoEvent(eventType, data = {}) {
    if (isSyncing) return; // ไม่ต้องส่ง event ถ้ากำลัง sync อยู่
    
    const eventData = {
        type: eventType,
        username: username,
        videoId: currentVideoId,
        ...data
    };
    
    await triggerEvent('video-event', eventData);
}

// ฟังก์ชันสำหรับจัดการ event จากผู้ใช้คนอื่น
function setupVideoEventListeners() {
    channel.bind('video-event', function(data) {
        if (data && data.type) {
            // ตรวจสอบว่าเป็น event จากคนอื่นเท่านั้น
            if (data.username !== username) {
                console.log('Received video event:', data.type, 'from:', data.username);
                handleVideoEvent(data);
            }
        }
    });
}

// เรียกใช้งานฟังก์ชันตั้งค่า event listeners
setupVideoEventListeners();

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
