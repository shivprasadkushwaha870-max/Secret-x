// ============================================
// 👥 GROUPS MODULE (v2 - ADMIN + SETTINGS)
// ============================================

const groupListEl = document.getElementById('group-list');
const groupModal = document.getElementById('group-modal');

document.getElementById('btn-new-group').addEventListener('click', () => {
  groupModal.classList.remove('hidden');
});

document.getElementById('btn-cancel-group').addEventListener('click', () => {
  groupModal.classList.add('hidden');
  document.getElementById('group-name-input').value = '';
  document.getElementById('group-members-input').value = '';
});

groupModal.addEventListener('click', (e) => {
  if (e.target === groupModal) groupModal.classList.add('hidden');
});

// ---- Create Group ----
document.getElementById('btn-create-group').addEventListener('click', async () => {
  const groupName = document.getElementById('group-name-input').value.trim();
  const membersInput = document.getElementById('group-members-input').value.trim();

  if (!groupName) { alert('Group ka naam daalo!'); return; }

  try {
    const memberEmails = membersInput.split(',').map(e => e.trim()).filter(e => e.length > 0);
    const memberIds = [currentUser.uid];
    const memberData = {
      [currentUser.uid]: {
        username: currentUserData.username || 'User',
        email: currentUserData.email || '',
        isAdmin: true
      }
    };

    for (const email of memberEmails) {
      const userSnap = await db.collection('users').where('email', '==', email).get();
      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        if (!memberIds.includes(userDoc.id)) {
          memberIds.push(userDoc.id);
          const uData = userDoc.data();
          memberData[userDoc.id] = {
            username: uData.username || uData.email || email,
            email: uData.email || email,
            isAdmin: false
          };
        }
      } else {
        console.warn(`User ${email} not found`);
      }
    }

    if (memberIds.length < 2) {
      alert('Kam se kam 1 member add karo!');
      return;
    }

    await db.collection('groups').add({
      name: groupName,
      createdBy: currentUser.uid,
      members: memberIds,
      memberData: memberData,
      lastMessage: 'Group ban gaya! 🎉',
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      unreadCount: {}
    });

    groupModal.classList.add('hidden');
    document.getElementById('group-name-input').value = '';
    document.getElementById('group-members-input').value = '';
    console.log('✅ Group created');
  } catch (err) {
    console.error('Create group error:', err);
    alert('Group nahi bana: ' + err.message);
  }
});

// ---- Load Groups ----
function loadGroups() {
  if (!currentUser) return;

  db.collection('groups')
    .where('members', 'array-contains', currentUser.uid)
    .onSnapshot((snapshot) => {
      groupListEl.innerHTML = '';

      if (snapshot.empty) {
        groupListEl.innerHTML = '<p class="empty-msg">Koi group nahi hai. Upar  dabao!</p>';
        return;
      }

      const groups = [];
      snapshot.forEach(doc => groups.push({ id: doc.id, data: doc.data() }));

      groups.sort((a, b) => {
        const timeA = a.data.lastMessageTime ? a.data.lastMessageTime.toMillis() : 0;
        const timeB = b.data.lastMessageTime ? b.data.lastMessageTime.toMillis() : 0;
        return timeB - timeA;
      });

      groups.forEach(({ id: docId, data: group }) => {
        const name = group.name || 'Group';
        const initial = name.charAt(0).toUpperCase();
        const lastMsg = group.lastMessage || 'Naya group';
        let time = '';
        if (group.lastMessageTime) {
          try { time = formatTime(group.lastMessageTime.toDate()); } catch(e) {}
        }
        const memberCount = group.members ? group.members.length : 0;

        const item = document.createElement('div');
        item.className = `chat-item ${activeChatId === docId ? 'active' : ''}`;
        item.innerHTML = `
          <div class="avatar" style="background: linear-gradient(135deg, #06d6a0, #7c3aed);">${initial}</div>
          <div class="chat-item-info">
            <h4>${escapeHtml(name)}</h4>
            <p>👥 ${memberCount} members • ${escapeHtml(lastMsg)}</p>
          </div>
          <span class="chat-item-time">${time}</span>
        `;
        item.addEventListener('click', () => openGroupChat(docId, group));
        groupListEl.appendChild(item);
      });
    }, (err) => {
      console.error('Groups error:', err);
      if (err.code === 'permission-denied') {
        groupListEl.innerHTML = '<p class="empty-msg">⚠️ Permission denied!</p>';
      }
    });
}

// ---- Open Group Chat with Settings Button ----
function openGroupChat(groupId, groupData) {
  activeChatId = groupId;
  activeChatType = 'group';

  noChatEl.classList.add('hidden');
  activeChatEl.classList.remove('hidden');
  chatNameEl.textContent = groupData.name;
  chatAvatarEl.textContent = groupData.name.charAt(0).toUpperCase();
  chatStatusEl.textContent = `${groupData.members.length} members`;

  document.getElementById('app-screen').classList.add('chat-open');

  // Add settings button to chat header (only for admin)
  addGroupSettingsButton(groupId, groupData);

  if (unsubscribeMessages) unsubscribeMessages();
  messagesContainer.innerHTML = '<div class="spinner"></div>';

  unsubscribeMessages = db.collection('groups').doc(groupId).collection('messages')
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
        let senderHtml = `<div class="msg-sender">${escapeHtml(msg.senderName || 'Unknown')}</div>`;
        let timeStr = '';
        if (msg.timestamp) { try { timeStr = formatTime(msg.timestamp.toDate()); } catch(e) {} }
        div.innerHTML = `${senderHtml}<div>${escapeHtml(msg.text)}</div><div class="msg-time">${timeStr}</div>`;
        messagesContainer.appendChild(div);
      });
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
}

// ---- Group Settings Button (Admin Only) ----
function addGroupSettingsButton(groupId, groupData) {
  // Remove old button if exists
  const oldBtn = document.getElementById('btn-group-settings');
  if (oldBtn) oldBtn.remove();

  const isMember = groupData.memberData && groupData.memberData[currentUser.uid];
  const isAdmin = isMember && isMember.isAdmin;

  if (isAdmin) {
    const settingsBtn = document.createElement('button');
    settingsBtn.id = 'btn-group-settings';
    settingsBtn.className = 'icon-btn';
    settingsBtn.innerHTML = '⚙️';
    settingsBtn.title = 'Group Settings';
    settingsBtn.style.marginLeft = 'auto';
    settingsBtn.addEventListener('click', () => openGroupSettings(groupId, groupData));
    document.querySelector('.chat-header').appendChild(settingsBtn);
  }
}

// ---- Group Settings Modal ----
function openGroupSettings(groupId, groupData) {
  // Remove old modal if exists
  const oldModal = document.getElementById('settings-modal');
  if (oldModal) oldModal.remove();

  const modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.className = 'modal';
  
  let membersHtml = '';
  if (groupData.memberData) {
    Object.entries(groupData.memberData).forEach(([uid, data]) => {
      const isMe = uid === currentUser.uid;
      const isCreator = uid === groupData.createdBy;
      const isAdmin = data.isAdmin;
      const role = isCreator ? '👑 Creator' : (isAdmin ? '⭐ Admin' : '👤 Member');
      
      membersHtml += `
        <div class="member-item" style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--border);">
          <div class="avatar" style="width:32px;height:32px;font-size:14px;">${(data.username||'U').charAt(0).toUpperCase()}</div>
          <div style="flex:1;">
            <div style="font-weight:600;">${escapeHtml(data.username||'Unknown')} ${isMe?'(You)':''}</div>
            <div style="font-size:12px;color:var(--text-muted);">${role}</div>
          </div>
          ${!isMe && !isCreator ? `
            <button class="btn btn-small" onclick="toggleAdmin('${groupId}','${uid}',${!isAdmin})">
              ${isAdmin ? 'Remove Admin' : 'Make Admin'}
            </button>
            <button class="btn btn-small" style="background:var(--danger);" onclick="removeMember('${groupId}','${uid}')">
              Remove
            </button>
          ` : ''}
        </div>
      `;
    });
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-height:80vh;overflow-y:auto;">
      <h3>⚙️ Group Settings</h3>
      
      <div class="input-group">
        <label style="font-size:12px;color:var(--text-muted);">Group Name</label>
        <input type="text" id="settings-group-name" value="${escapeHtml(groupData.name)}" />
      </div>
      
      <div class="input-group">
        <label style="font-size:12px;color:var(--text-muted);">Group Logo URL (optional)</label>
        <input type="text" id="settings-group-logo" placeholder="https://example.com/logo.png" />
      </div>

      <h4 style="margin:16px 0 8px;font-size:14px;">👥 Members (${groupData.members.length})</h4>
      <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;">
        ${membersHtml}
      </div>

      <div class="modal-actions" style="margin-top:16px;">
        <button id="btn-save-settings" class="btn btn-primary">Save Changes</button>
        <button id="btn-close-settings" class="btn btn-secondary">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('btn-close-settings').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const newName = document.getElementById('settings-group-name').value.trim();
    const newLogo = document.getElementById('settings-group-logo').value.trim();
    
    if (!newName) { alert('Name khaali nahi ho sakta!'); return; }
    
    const updateData = { name: newName };
    if (newLogo) updateData.logo = newLogo;
    
    try {
      await db.collection('groups').doc(groupId).update(updateData);
      alert('✅ Settings saved!');
      modal.remove();
      // Refresh
      if (typeof loadGroups === 'function') loadGroups();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });
}

// ---- Global Functions (called from inline onclick) ----
window.toggleAdmin = async function(groupId, uid, makeAdmin) {
  if (!confirm(makeAdmin ? 'Isse admin banana hai?' : 'Admin se remove karna hai?')) return;
  try {
    await db.collection('groups').doc(groupId).update({
      [`memberData.${uid}.isAdmin`]: makeAdmin
    });
    alert(makeAdmin ? '✅ Admin ban gaya!' : 'Admin removed');
    location.reload();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.removeMember = async function(groupId, uid) {
  if (!confirm('Is member ko group se remove karna hai?')) return;
  try {
    const groupDoc = await db.collection('groups').doc(groupId).get();
    const data = groupDoc.data();
    const newMembers = data.members.filter(m => m !== uid);
    const newMemberData = { ...data.memberData };
    delete newMemberData[uid];
    
    await db.collection('groups').doc(groupId).update({
      members: newMembers,
      memberData: newMemberData
    });
    alert('✅ Member removed');
    location.reload();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

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
