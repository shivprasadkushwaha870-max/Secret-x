// ============================================
// 💬 CHAT MODULE (v2 - FIXED + NOTIFICATIONS)
// ============================================

let activeChatId = null;
let activeChatType = 'direct';
let unsubscribeMessages = null;
let unreadCount = 0;

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
  if (!email) { alert('Email daalo!'); return; }
  if (email === currentUserData.email) { alert('Khud se chat nahi kar sakte! '); return; }

  try {
    const usersSnap = await db.collection('users').where('email', '==', email).get();
    if (usersSnap.empty) { alert('Yeh email registered nahi hai!'); return; }

    const otherUser = usersSnap.docs[0];
    const otherUserId = otherUser.id;
    const otherUserData = otherUser.data();
    const otherUsername = otherUserData.username || otherUserData.email || email.split('@')[0];

    const chatId = getChatId(currentUser.uid, otherUserId);
    const chatDoc = await db.collection('chats').doc(chatId).get();

    if (!chatDoc.exists) {
      await db.collection('chats').doc(chatId).set({
        participants: [currentUser.uid, otherUserId],
        participantData: {
          [currentUser.uid]: {
            username: currentUserData.username || 'User',
            email: currentUserData.email || ''
          },
          [otherUserId]: {
            username: otherUsername,
            email: otherUserData.email || email
          }
        },
        lastMessage: '',
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        unreadCount: { [currentUser.uid]: 0, [otherUserId]: 0 }
      });
    }

    document.getElementById('new-chat-email').value = '';
    openChat(chatId, 'direct', otherUsername);
  } catch (err) {
    console.error('Start chat error:', err);
    alert('Chat start nahi hua: ' + err.message);
  }
});

function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

// ---- Load Chats (FIXED null toDate) ----
function loadChats() {
  if (!currentUser) return;

  db.collection('chats')
    .where('participants', 'array-contains', currentUser.uid)
    .onSnapshot((snapshot) => {
      chatListEl.innerHTML = '';

      if (snapshot.empty) {
        chatListEl.innerHTML = '<p class="empty-msg">Koi chat nahi hai. Neeche email daalke start karo!</p>';
        return;
      }

      const chats = [];
      snapshot.forEach(doc => chats.push({ id: doc.id, data: doc.data() }));

      chats.sort((a, b) => {
        const timeA = a.data.lastMessageTime ? a.data.lastMessageTime.toMillis() : 0;
        const timeB = b.data.lastMessageTime ? b.data.lastMessageTime.toMillis() : 0;
        return timeB - timeA;
      });

      chats.forEach(({ id: docId, data: chat }) => {
        const otherUserId = chat.participants.find(p => p !== currentUser.uid);
        const otherUser = chat.participantData ? chat.participantData[otherUserId] : null;
        const name = (otherUser && otherUser.username) ? otherUser.username : 'Unknown';
        const initial = name.charAt(0).toUpperCase();
        const lastMsg = chat.lastMessage || 'Naya chat';

        // Safe time formatting
        let time = '';
        if (chat.lastMessageTime) {
          try { time = formatTime(chat.lastMessageTime.toDate()); } catch(e) { time = ''; }
        }

        // Unread count
        const unread = chat.unreadCount && chat.unreadCount[currentUser.uid] ? chat.unreadCount[currentUser.uid] : 0;
        const unreadBadge = unread > 0 ? `<span class="unread-badge">${unread}</span>` : '';

        const item = document.createElement('div');
        item.className = `chat-item ${activeChatId === docId ? 'active' : ''}`;
        item.innerHTML = `
          <div class="avatar">${initial}</div>
          <div class="chat-item-info">
            <h4>${escapeHtml(name)} ${unreadBadge}</h4>
            <p>${escapeHtml(lastMsg)}</p>
          </div>
          <span class="chat-item-time">${time}</span>
        `;
        item.addEventListener('click', () => openChat(docId, 'direct', name));
        chatListEl.appendChild(item);
      });
    }, (err) => {
      console.error('Chats load error:', err);
      if (err.code === 'permission-denied') {
        chatListEl.innerHTML = '<p class="empty-msg">⚠️ Permission denied. Firestore Rules check karo!</p>';
      }
    });
}

// ---- Open Chat ----
function openChat(chatId, type, name) {
  activeChatId = chatId;
  activeChatType = type;

  noChatEl.classList.add('hidden');
  activeChatEl.classList.remove('hidden');
  chatNameEl.textContent = name;
  chatAvatarEl.textContent = name.charAt(0).toUpperCase();
  chatStatusEl.textContent = type === 'direct' ? 'Online' : 'Group';

  document.getElementById('app-screen').classList.add('chat-open');

  if (unsubscribeMessages) unsubscribeMessages();

  messagesContainer.innerHTML = '<div class="spinner"></div>';

  const collection = type === 'direct' ? 'chats' : 'groups';

  unsubscribeMessages = db.collection(collection).doc(chatId).collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot((snapshot) => {
      messagesContainer.innerHTML = '';

      if (snapshot.empty) {
        messagesContainer.innerHTML = '<p class="empty-msg">Koi message nahi. Pehla message bhejo! 👋</p>';
        return;
      }

      snapshot.forEach(doc => {
        const msg = doc.data();
        const isSent = msg.senderId === currentUser.uid;
        const div = document.createElement('div');
        div.className = `message ${isSent ? 'sent' : 'received'}`;

        let senderHtml = '';
        if (type === 'group' && !isSent) {
          senderHtml = `<div class="msg-sender">${escapeHtml(msg.senderName || 'Unknown')}</div>`;
        }

        let timeStr = '';
        if (msg.timestamp) {
          try { timeStr = formatTime(msg.timestamp.toDate()); } catch(e) {}
        }

        div.innerHTML = `
          ${senderHtml}
          <div>${escapeHtml(msg.text)}</div>
          <div class="msg-time">${timeStr}</div>
        `;
        messagesContainer.appendChild(div);
      });

      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      // Reset unread count
      if (type === 'direct') {
        db.collection('chats').doc(chatId).update({
          [`unreadCount.${currentUser.uid}`]: 0
        }).catch(() => {});
      }
    }, (err) => {
      console.error('Messages error:', err);
      messagesContainer.innerHTML = '<p class="empty-msg">Messages load nahi ho rahe</p>';
    });

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
    senderName: currentUserData.username || 'User',
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  const collection = activeChatType === 'direct' ? 'chats' : 'groups';

  try {
    await db.collection(collection).doc(activeChatId).collection('messages').add(messageData);

    const updateData = {
      lastMessage: text,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Increment unread for other participants
    if (activeChatType === 'direct') {
      const chatDoc = await db.collection('chats').doc(activeChatId).get();
      const otherUserId = chatDoc.data().participants.find(p => p !== currentUser.uid);
      updateData[`unreadCount.${otherUserId}`] = firebase.firestore.FieldValue.increment(1);
    }

    await db.collection(collection).doc(activeChatId).update(updateData);
  } catch (err) {
    console.error('Send error:', err);
    messageInput.value = text;
  }
}

btnSend.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

document.getElementById('btn-back').addEventListener('click', () => {
  document.getElementById('app-screen').classList.remove('chat-open');
  activeChatId = null;
  if (unsubscribeMessages) unsubscribeMessages();
});

document.getElementById('search-input').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  document.querySelectorAll('.chat-item').forEach(item => {
    const name = item.querySelector('h4').textContent.toLowerCase();
    item.style.display = name.includes(query) ? 'flex' : 'none';
  });
});

// ---- Utilities ----
function formatTime(date) {
  if (!date) return '';
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
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
