# QUEST_ID: curious
# TITLE: Curious Explorer
# DESCRIPTION: Open all of the 9 core tiles in the Tree map to understand the foundations.
# REWARD: 50
# TARGET: 9
# SCRIPT:
async (uid) => {
  const fb = window.firebase;
  if (!fb || !fb.firestore) return false;
  const userRef = fb.firestore().collection('users').doc(uid);
  const snap = await userRef.get();
  const data = snap.data() || {};
  const opened = data.stats?.opened_core_tiles || [];
  return opened.length >= 9;
}
