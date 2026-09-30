// ============================================
//  CHAT MODULE (FIXED)
// ============================================

let activeChatId = null;
let activeChatType = 'direct';
let unsubscribeMessages = null;

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
  if (!email) {
    alert('Email daalo pehle!');
    return;
  }

  if (email === currentUserData.email) {
    alert('Khud se chat nahi kar sakte bhai! ');
    return;
  }

  try {
    // Find user by email
    const usersSnap = await db.collection('users').where('email', '==', email).get();

    if (usersSnap.empty) {
      alert('Yeh email Secret-x pe registered nahi hai!\n\nPehle usse register karne bolo.');
      return;
    }

    const otherUser = usersSnap.docs[0];
    const otherUserId = otherUser.id;
    const otherUserData = otherUser.data();
    
    // Safe username (fallback)
    const otherUsername = (otherUserData.username || otherUserData.email || email.split('@')[0]);

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
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Chat created:', chatId);
    }

    document.getElementById('new-chat-email').value = '';
    openChat(chatId, 'direct', otherUsername);

  } catch (err) {
    console.error(' Start chat error:', err);
    alert('Chat start nahi ho paya: ' + err.message);
  }
});

// ---- Generate Chat ID ----
function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

// ---- Load Chats (FIXED - No orderBy) ----
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

      // Sort client-side
      const chats = [];
      snapshot.forEach(doc => {
        chats.push({ id: doc.id, data: doc.data() });
      });
      
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
        const lastMsg = chat.lastMessage || 'Naya chat shuru karo';
        const time = chat.lastMessageTime ? formatTime(chat.lastMessageTime.toDate()) : '';

        const item = document.createElement('div');
        item.className = `chat-item ${activeChatId === docId ? 'active' : ''}`;
        item.innerHTML = `
          <div class="avatar">${initial}</div>
          <div class="chat-item-info">
            <h4>${escapeHtml(name)}</h4>
            <p>${escapeHtml(lastMsg)}</p>
          </div>
          <span class="chat-item-time">${time}</span>
        `;
        item.addEventListener('click', () => openChat(docId, 'direct', name));
        chatListEl.appendChild(item);
      });
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
          senderHtml = `<div class="msg-sender">${escapeHtml(msg.senderName || 'Unknown')}</div>`;
        }

        div.innerHTML = `
          ${senderHtml}
          <div>${escapeHtml(msg.text)}</div>
          <div class="msg-time">${formatTime(msg.timestamp.toDate())}</div>
        `;
        messagesContainer.appendChild(div);
      });

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, (err) => {
      console.error('Messages load error:', err);
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

    await db.collection(collection).doc(activeChatId).update({
      lastMessage: text,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error('Send error:', err);
    messageInput.value = text; // Restore message on error
  }
}

btnSend.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// ---- Mobile Back ----
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
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
