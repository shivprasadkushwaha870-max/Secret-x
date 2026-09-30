// ============================================
// 💬 CHAT MODULE
// ============================================

let activeChatId = null;
let activeChatType = 'direct'; // 'direct' or 'group'
let unsubscribeMessages = null;

// DOM Elements
const chatListEl = document.getElementById('chat-list');
const noChatEl = document.getElementById('no-chat');
const activeChatEl = document.getElementById('active-chat');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const btnSend = document.getElementById('btn-send');
const chatNameEl = document.getElementById('chat-name');
const chatAvatarEl = document.getElementById('chat-avatar');
const chatStatusEl = document.getElementById('chat-status');

// ---- Tabs ----
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const tabName = tab.dataset.tab;
    document.getElementById('chat-list').classList.toggle('active-tab-content', tabName === 'chats');
    document.getElementById('group-list').classList.toggle('active-tab-content', tabName === 'groups');
  });
});

// ---- Start New Chat ----
document.getElementById('btn-start-chat').addEventListener('click', async () => {
  const email = document.getElementById('new-chat-email').value.trim();
  if (!email) return;

  if (email === currentUserData.email) {
    alert('Khud se chat nahi kar sakte bhai! 😄');
    return;
  }

  try {
    // Find user by email
    const usersSnap = await db.collection('users').where('email', '==', email).get();

    if (usersSnap.empty) {
      alert('Yeh email Secret-x pe registered nahi hai!');
      return;
    }

    const otherUser = usersSnap.docs[0];
    const otherUserId = otherUser.id;
    const otherUserData = otherUser.data();

    // Create or get chat ID (sorted IDs for consistency)
    const chatId = getChatId(currentUser.uid, otherUserId);

    // Check if chat already exists
    const chatDoc = await db.collection('chats').doc(chatId).get();

    if (!chatDoc.exists) {
      await db.collection('chats').doc(chatId).set({
        participants: [currentUser.uid, otherUserId],
        participantData: {
          [currentUser.uid]: {
            username: currentUserData.username,
            email: currentUserData.email
          },
          [otherUserId]: {
            username: otherUserData.username,
            email: otherUserData.email
          }
        },
        lastMessage: '',
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    document.getElementById('new-chat-email').value = '';
    openChat(chatId, 'direct', otherUserData.username);

  } catch (err) {
    console.error('Start chat error:', err);
    alert('Chat start nahi ho paya. Try again!');
  }
});

// ---- Generate Chat ID ----
function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

// ---- Load Chats ----
function loadChats() {
  if (!currentUser) return;

  db.collection('chats')
    .where('participants', 'array-contains', currentUser.uid)
    .orderBy('lastMessageTime', 'desc')
    .onSnapshot((snapshot) => {
      chatListEl.innerHTML = '';

      if (snapshot.empty) {
        chatListEl.innerHTML = '<p class="empty-msg">Koi chat nahi hai. Neeche se start karo!</p>';
        return;
      }

      snapshot.forEach(doc => {
        const chat = doc.data();
        const otherUserId = chat.participants.find(p => p !== currentUser.uid);
        const otherUser = chat.participantData[otherUserId];
        const name = otherUser ? otherUser.username : 'Unknown';
        const initial = name.charAt(0).toUpperCase();
        const lastMsg = chat.lastMessage || 'Naya chat';
        const time = chat.lastMessageTime ? formatTime(chat.lastMessageTime.toDate()) : '';

        const item = document.createElement('div');
        item.className = `chat-item ${activeChatId === doc.id ? 'active' : ''}`;
        item.innerHTML = `
          <div class="avatar">${initial}</div>
          <div class="chat-item-info">
            <h4>${escapeHtml(name)}</h4>
            <p>${escapeHtml(lastMsg)}</p>
          </div>
          <span class="chat-item-time">${time}</span>
        `;
        item.addEventListener('click', () => openChat(doc.id, 'direct', name));
        chatListEl.appendChild(item);
      });
    });
}

// ---- Open Chat ----
function openChat(chatId, type, name) {
  activeChatId = chatId;
  activeChatType = type;

  // UI
  noChatEl.classList.add('hidden');
  activeChatEl.classList.remove('hidden');
  chatNameEl.textContent = name;
  chatAvatarEl.textContent = name.charAt(0).toUpperCase();
  chatStatusEl.textContent = type === 'direct' ? 'Online' : 'Group';

  // Mobile
  document.getElementById('app-screen').classList.add('chat-open');

  // Unsubscribe previous
  if (unsubscribeMessages) unsubscribeMessages();

  // Load messages
  messagesContainer.innerHTML = '<div class="spinner"></div>';

  const collection = type === 'direct' ? 'chats' : 'groups';
  unsubscribeMessages = db.collection(collection).doc(chatId).collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot((snapshot) => {
      messagesContainer.innerHTML = '';

      if (snapshot.empty) {
        messagesContainer.innerHTML = '<p class="empty-msg">Koi message nahi abhi. Pehla message bhejo! 👋</p>';
        return;
      }

      snapshot.forEach(doc => {
        const msg = doc.data();
        const isSent = msg.senderId === currentUser.uid;
        const div = document.createElement('div');
        div.className = `message ${isSent ? 'sent' : 'received'}`;

        let senderHtml = '';
        if (type === 'group' && !isSent) {
          senderHtml = `<div class="msg-sender">${escapeHtml(msg.senderName)}</div>`;
        }

        div.innerHTML = `
          ${senderHtml}
          <div>${escapeHtml(msg.text)}</div>
          <div class="msg-time">${formatTime(msg.timestamp.toDate())}</div>
        `;
        messagesContainer.appendChild(div);
      });

      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

  // Highlight active in list
  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
}

// ---- Send Message ----
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !activeChatId) return;

  messageInput.value = '';

  const messageData = {
    text: text,
    senderId: currentUser.uid,
    senderName: currentUserData.username,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  const collection = activeChatType === 'direct' ? 'chats' : 'groups';

  try {
    // Add message
    await db.collection(collection).doc(activeChatId).collection('messages').add(messageData);

    // Update last message in chat/group doc
    await db.collection(collection).doc(activeChatId).update({
      lastMessage: text,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error('Send message error:', err);
  }
}

btnSend.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// ---- Mobile Back Button ----
document.getElementById('btn-back').addEventListener('click', () => {
  document.getElementById('app-screen').classList.remove('chat-open');
  activeChatId = null;
  if (unsubscribeMessages) unsubscribeMessages();
});

// ---- Search ----
document.getElementById('search-input').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  document.querySelectorAll('.chat-item').forEach(item => {
    const name = item.querySelector('h4').textContent.toLowerCase();
    item.style.display = name.includes(query) ? 'flex' : 'none';
  });
});

// ---- Utilities ----
function formatTime(date) {
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Abhi';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  return date.toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
