# QUEST_ID: linkedin_connect
# TITLE: Connect LinkedIn
# DESCRIPTION: Connect your LinkedIn account for professional profile
# REWARD: 50
# TARGET: 1
# SCRIPT:
// LinkedIn Connect quest script
// Completes when user has linkedin_sub field in their profile

async (uid) => {
  const fb = window.firebase;
  if (!fb || !fb.firestore) return false;
  
  const userRef = fb.firestore().collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) return false;
  
  const data = snap.data() || {};
  return !!data.linkedin_sub;
}
