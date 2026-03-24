# QUEST_ID: bubble_bounce
# TITLE: Bubble Bounce
# DESCRIPTION: Bounce tag bubbles 25 times in the Explorer screen to discover new topics.
# REWARD: 150
# TARGET: 25
# SCRIPT:
async (uid) => {
  const fb = window.firebase;
  if (!fb || !fb.firestore) return false;
  const userRef = fb.firestore().collection('users').doc(uid);
  const snap = await userRef.get();
  const data = snap.data() || {};
  const bounces = Number(data.stats?.bubble_bounces) || 0;
  return bounces >= 25;
}
