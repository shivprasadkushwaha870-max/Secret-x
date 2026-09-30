// ============================================
//  GROUPS MODULE (FIXED)
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
  if (e.target === groupModal) {
    groupModal.classList.add('hidden');
  }
});

// ---- Create Group ----
document.getElementById('btn-create-group').addEventListener('click', async () => {
  const groupName = document.getElementById('group-name-input').value.trim();
  const membersInput = document.getElementById('group-members-input').value.trim();

  if (!groupName) {
    alert('Group ka naam daalo!');
    return;
  }

  try {
    const memberEmails = membersInput
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);

    const memberIds = [currentUser.uid];
    const memberData = {
      [currentUser.uid]: {
        username: currentUserData.username || 'User',
        email: currentUserData.email || ''
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
            email: uData.email || email
          };
        }
      } else {
        console.warn(`User ${email} not found`);
      }
    }

    if (memberIds.length < 2) {
      alert('Kam se kam 1 member add karo jo Secret-x pe ho!');
      return;
    }

    const groupRef = await db.collection('groups').add({
      name: groupName,
      createdBy: currentUser.uid,
      members: memberIds,
      memberData: memberData,
      lastMessage: 'Group ban gaya! 🎉',
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Group created:', groupRef.id);
    groupModal.classList.add('hidden');
    document.getElementById('group-name-input').value = '';
    document.getElementById('group-members-input').value = '';

  } catch (err) {
    console.error('Create group error:', err);
    alert('Group nahi ban paya: ' + err.message);
  }
});

// ---- Load Groups (FIXED - No orderBy) ----
function loadGroups() {
  if (!currentUser) return;

  db.collection('groups')
    .where('members', 'array-contains', currentUser.uid)
    .onSnapshot((snapshot) => {
      groupListEl.innerHTML = '';

      if (snapshot.empty) {
        groupListEl.innerHTML = '<p class="empty-msg">Koi group nahi hai. Upar 👥 dabao!</p>';
        return;
      }

      const groups = [];
      snapshot.forEach(doc => {
        groups.push({ id: doc.id, data: doc.data() });
      });

      groups.sort((a, b) => {
        const timeA = a.data.lastMessageTime ? a.data.lastMessageTime.toMillis() : 0;
        const timeB = b.data.lastMessageTime ? b.data.lastMessageTime.toMillis() : 0;
        return timeB - timeA;
      });

      groups.forEach(({ id: docId, data: group }) => {
        const name = group.name || 'Group';
        const initial = name.charAt(0).toUpperCase();
        const lastMsg = group.lastMessage || 'Naya group';
        const time = group.lastMessageTime ? formatTime(group.lastMessageTime.toDate()) : '';
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
        item.addEventListener('click', () => {
          if (typeof openChat === 'function') openChat(docId, 'group', name);
        });
        groupListEl.appendChild(item);
      });
    }, (err) => {
      console.error('Groups load error:', err);
    });
}

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
