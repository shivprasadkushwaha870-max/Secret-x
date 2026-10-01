// ============================================
// 💬 CHAT MODULE (v5 - COMPLETE FIXED VERSION)
// ============================================

let activeChatId = null;
let activeChatType = 'direct';
let unsubscribeMessages = null;
let unsubscribeNotifs = null;

const chatListEl = document.getElementById('chat-list');
const noChatEl = document.getElementById('no-chat');
const activeChatEl = document.getElementById('active-chat');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const btnSend = document.getElementById('btn-send');
const chatNameEl = document.getElementById('chat-name');
const chatAvatarEl = document.getElementById('chat-avatar');
const chatStatusEl = document.getElementById('chat-status');
const notifBadge = document.getElementById('notif-badge');
const notifModal = document.getElementById('notif-modal');
const notifList = document.getElementById('notif-list');

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

// ---- Notifications Bell ----
document.getElementById('btn-notifications').addEventListener('click', () => {
  notifModal.classList.remove('hidden');
  loadNotifications();
});

document.getElementById('btn-close-notif').addEventListener('click', () => {
  notifModal.classList.add('hidden');
});

notifModal.addEventListener('click', (e) => {
  if (e.target === notifModal) notifModal.classList.add('hidden');
});

function loadNotifications() {
  if (!currentUser) return;
  if (unsubscribeNotifs) unsubscribeNotifs();

  notifList.innerHTML = '<div class="spinner"></div>';
  let hasNotifs = false;
  let totalUnread = 0;

  const unsubscribe1 = db.collection('chats')
    .where('participants', 'array-contains', currentUser.uid)
    .onSnapshot((snapshot) => {
      notifList.innerHTML = '';
      hasNotifs = false;
      totalUnread = 0;

      snapshot.forEach(doc => {
        const chat = doc.data();
        const unread = chat.unreadCount && chat.unreadCount[currentUser.uid] ? chat.unreadCount[currentUser.uid] : 0;
        totalUnread += unread;

        if (unread > 0) {
          hasNotifs = true;
          const otherUserId = chat.participants.find(p => p !== currentUser.uid);
          const otherUser = chat.participantData ? chat.participantData[otherUserId] : null;
          const name = (otherUser && otherUser.username) ? otherUser.username : 'Unknown';

          const item = document.createElement('div');
          item.className = 'notif-item unread';
          item.innerHTML = `
            <span class="notif-icon">💬</span>
            <div class="notif-content">
              <h4>${escapeHtml(name)}</h4>
              <p>${unread} naye message</p>
            </div>
            <span class="notif-time">${escapeHtml(chat.lastMessage || '')}</span>
          `;
          item.addEventListener('click', () => {
            notifModal.classList.add('hidden');
            openChat(doc.id, 'direct', name);
          });
          notifList.appendChild(item);
        }
      });

      const unsubscribe2 = db.collection('groups')
        .where('members', 'array-contains', currentUser.uid)
        .onSnapshot((groupSnap) => {
          groupSnap.forEach(doc => {
            const group = doc.data();
            const unread = group.unreadCount && group.unreadCount[currentUser.uid] ? group.unreadCount[currentUser.uid] : 0;
            totalUnread += unread;

            if (unread > 0) {
              hasNotifs = true;
              const item = document.createElement('div');
              item.className = 'notif-item unread';
              item.innerHTML = `
                <span class="notif-icon">👥</span>
                <div class="notif-content">
                  <h4>${escapeHtml(group.name)}</h4>
                  <p>${unread} naye messages</p>
                </div>
                <span class="notif-time">${escapeHtml(group.lastMessage || '')}</span>
              `;
              item.addEventListener('click', () => {
                notifModal.classList.add('hidden');
                if (typeof openGroupChat === 'function') openGroupChat(doc.id, group);
              });
              notifList.appendChild(item);
            }
          });

          if (!hasNotifs) {
            notifList.innerHTML = '<p class="empty-msg">Koi notification nahi hai ✅</p>';
          }

          if (totalUnread > 0) {
            notifBadge.textContent = totalUnread > 99 ? '99+' : totalUnread;
            notifBadge.classList.remove('hidden');
          } else {
            notifBadge.classList.add('hidden');
          }
        });

      unsubscribeNotifs = () => {
        unsubscribe1();
        unsubscribe2();
      };
    });
}

// ---- Start New Chat (FIXED) ----
document.getElementById('btn-start-chat').addEventListener('click', async () => {
  const email = document.getElementById('new-chat-email').value.trim().toLowerCase();
  
  if (!email) { 
    alert('Pehle email daalo!'); 
    return; 
  }
  
  if (email === (currentUserData.email || '').toLowerCase()) { 
    alert('Khud se chat nahi kar sakte! 😄'); 
    return; 
  }

  try {
    console.log('🔍 Searching for user:', email);
    
    const usersSnap = await db.collection('users').where('email', '==', email).get();
    
    if (usersSnap.empty) {
      alert(' Yeh email Secret-x pe registered nahi hai!\n\nDusra user pehle register kare.');
      return;
    }

    const otherUser = usersSnap.docs[0];
    const otherUserId = otherUser.id;
    const otherUserData = otherUser.data();
    const otherUsername = otherUserData.username || otherUserData.name || otherUserData.email || email.split('@')[0];

    console.log('✅ User found:', otherUsername, otherUserId);

    const chatId = getChatId(currentUser.uid, otherUserId);
    console.log('📝 Chat ID:', chatId);

    const chatDoc = await db.collection('chats').doc(chatId).get();

    if (!chatDoc.exists) {
      console.log('🆕 Creating new chat...');
      
      await db.collection('chats').doc(chatId).set({
        participants: [currentUser.uid, otherUserId],
        participantData: {
          [currentUser.uid]: {
            username: currentUserData.username || currentUserData.name || 'User',
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
        unreadCount: { 
          [currentUser.uid]: 0, 
          [otherUserId]: 0 
        }
      });
      
      console.log('✅ Chat created successfully!');
    } else {
      console.log('💬 Existing chat opened');
    }

    document.getElementById('new-chat-email').value = '';
    openChat(chatId, 'direct', otherUsername);
    
  } catch (err) {
    console.error('❌ Start chat error:', err);
    alert('Chat start nahi hua: ' + err.message + '\n\nConsole check karo (F12)');
  }
});

function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

// ---- Load Chats ----
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
        const lastMsg = chat.lastMessage || 'Naya chat shuru karo';

        let time = '';
        if (chat.lastMessageTime) {
          try { time = formatTime(chat.lastMessageTime.toDate()); } catch(e) { time = ''; }
        }

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
    });
}

// ---- Open Chat (FIXED - Bell Count Reset) ----
function openChat(chatId, type, name) {
  activeChatId = chatId;
  activeChatType = type;

  noChatEl.classList.add('hidden');
  activeChatEl.classList.remove('hidden');
  chatNameEl.textContent = name;
  chatAvatarEl.textContent = name.charAt(0).toUpperCase();
  chatStatusEl.textContent = type === 'direct' ? 'Online' : 'Group';

  document.getElementById('app-screen').classList.add('chat-open');

  const oldBtn = document.getElementById('btn-group-settings');
  if (oldBtn) oldBtn.remove();

  if (unsubscribeMessages) unsubscribeMessages();

  messagesContainer.innerHTML = '<div class="spinner"></div>';

  // Reset unread count immediately
  resetUnreadCount(chatId, type);

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
    }, (err) => {
      console.error('Messages error:', err);
      messagesContainer.innerHTML = '<p class="empty-msg">Messages load nahi ho rahe</p>';
    });

  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
}

// Reset Unread Count
async function resetUnreadCount(chatId, type) {
  if (!currentUser) return;
  
  const collection = type === 'direct' ? 'chats' : 'groups';
  const fieldPath = `unreadCount.${currentUser.uid}`;
  
  try {
    await db.collection(collection).doc(chatId).update({
      [fieldPath]: 0
    });
    console.log('✅ Unread count reset to 0 for', chatId);
  } catch (err) {
    console.error('❌ Unread count reset error:', err);
  }
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

    if (activeChatType === 'direct') {
      const chatDoc = await db.collection('chats').doc(activeChatId).get();
      const otherUserId = chatDoc.data().participants.find(p => p !== currentUser.uid);
      updateData[`unreadCount.${otherUserId}`] = firebase.firestore.FieldValue.increment(1);
    } else if (activeChatType === 'group') {
      const groupDoc = await db.collection('groups').doc(activeChatId).get();
      const members = groupDoc.data().members || [];
      const unreadUpdates = {};
      members.forEach(memberId => {
        if (memberId !== currentUser.uid) {
          unreadUpdates[`unreadCount.${memberId}`] = firebase.firestore.FieldValue.increment(1);
        }
      });
      Object.assign(updateData, unreadUpdates);
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

console.log('✅ Chat module loaded successfully!');
