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

function showNameModal() {
    nameModal.style.display = 'flex';
}
function hideNameModal() {
    nameModal.style.display = 'none';
}

enterChatBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name) {
        username = name;
        hideNameModal();
    } else {
        usernameInput.classList.add('ring-2', 'ring-red-500');
    }
});

// ป้องกันการใช้งานแชทก่อนกรอกชื่อ
window.addEventListener('DOMContentLoaded', showNameModal);

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
