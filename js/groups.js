// ============================================
// 👥 GROUPS MODULE
// ============================================

const groupListEl = document.getElementById('group-list');
const groupModal = document.getElementById('group-modal');

// ---- Open/Close Modal ----
document.getElementById('btn-new-group').addEventListener('click', () => {
  groupModal.classList.remove('hidden');
});

document.getElementById('btn-cancel-group').addEventListener('click', () => {
  groupModal.classList.add('hidden');
  document.getElementById('group-name-input').value = '';
  document.getElementById('group-members-input').value = '';
});

// Close modal on backdrop click
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
    // Parse member emails
    const memberEmails = membersInput
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);

    // Fetch member UIDs
    const memberIds = [currentUser.uid];
    const memberData = {
      [currentUser.uid]: {
        username: currentUserData.username,
        email: currentUserData.email
      }
    };

    for (const email of memberEmails) {
      const userSnap = await db.collection('users').where('email', '==', email).get();
      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        if (!memberIds.includes(userDoc.id)) {
          memberIds.push(userDoc.id);
          memberData[userDoc.id] = {
            username: userDoc.data().username,
            email: userDoc.data().email
          };
        }
      } else {
        console.warn(`User ${email} not found, skipping.`);
      }
    }

    if (memberIds.length < 2) {
      alert('Kam se kam 1 member add karo jo Secret-x pe ho!');
      return;
    }

    // Create group
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

    // Close modal & reset
    groupModal.classList.add('hidden');
    document.getElementById('group-name-input').value = '';
    document.getElementById('group-members-input').value = '';

  } catch (err) {
    console.error('Create group error:', err);
    alert('Group nahi ban paya. Try again!');
  }
});

// ---- Load Groups ----
function loadGroups() {
  if (!currentUser) return;

  db.collection('groups')
    .where('members', 'array-contains', currentUser.uid)
    .orderBy('lastMessageTime', 'desc')
    .onSnapshot((snapshot) => {
      groupListEl.innerHTML = '';

      if (snapshot.empty) {
        groupListEl.innerHTML = '<p class="empty-msg">Koi group nahi hai. Upar 👥 dabao!</p>';
        return;
      }

      snapshot.forEach(doc => {
        const group = doc.data();
        const name = group.name;
        const initial = name.charAt(0).toUpperCase();
        const lastMsg = group.lastMessage || 'Naya group';
        const time = group.lastMessageTime ? formatTime(group.lastMessageTime.toDate()) : '';
        const memberCount = group.members.length;

        const item = document.createElement('div');
        item.className = `chat-item ${activeChatId === doc.id ? 'active' : ''}`;
        item.innerHTML = `
          <div class="avatar" style="background: linear-gradient(135deg, #06d6a0, #7c3aed);">${initial}</div>
          <div class="chat-item-info">
            <h4>${escapeHtml(name)}</h4>
            <p>👥 ${memberCount} members • ${escapeHtml(lastMsg)}</p>
          </div>
          <span class="chat-item-time">${time}</span>
        `;
        item.addEventListener('click', () => openChat(doc.id, 'group', name));
        groupListEl.appendChild(item);
      });
    });
}
