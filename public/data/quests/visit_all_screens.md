# QUEST_ID: visit_all_screens
# TITLE: Visit All Screens
# DESCRIPTION: Visit all screens from the Menu (click Activate to start tracking)
# REWARD: 100
# TARGET: 7
# SCRIPT:
// Visit All Screens quest script
// Tracks when user visits all 7 menu screens AFTER clicking Activate
// Required screens: home, tree, explore, career, my-hustle, insights, level-up

const REQUIRED_SCREENS = ['home', 'tree', 'explore', 'career', 'my-hustle', 'insights', 'level-up'];

async (uid, questStatus) => {
  const fb = window.firebase;
  if (!fb || !fb.firestore) return false;
  
  // Only track if quest is active
  if (questStatus !== 'in_progress' && questStatus !== 'claimable') {
    return false;
  }
  
  const userRef = fb.firestore().collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) return false;
  
  const data = snap.data() || {};
  const visited = data.stats?.screens_visited || [];
  
  const visitedRequired = REQUIRED_SCREENS.filter(screen => visited.includes(screen));
  return visitedRequired.length >= REQUIRED_SCREENS.length;
}
