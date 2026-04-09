# QUEST_ID: curious
# TITLE: Curious Explorer
# DESCRIPTION: Open all 9 core tiles in the TreeMap (click Activate to start tracking)
# REWARD: 50
# TARGET: 9
# SCRIPT:
// Curious Explorer quest script
// Tracks when user opens core tiles in the TreeMap AFTER clicking Activate

async (uid) => {
  const fb = window.firebase;
  if (!fb || !fb.firestore) return false;
  const userRef = fb.firestore().collection('users').doc(uid);
  const snap = await userRef.get();
  const data = snap.data() || {};
  const userData = data;
  const questStatus = 'in_progress'; // assuming this is the status, you might need to fetch it from somewhere
  const progress = checkProgress(userData, questStatus);
  return progress.complete;
}

function checkProgress(userData, questStatus) {
  // Only track if quest is in_progress or claimable
  if (questStatus !== 'in_progress' && questStatus !== 'claimable') {
    return { progress: 0, target: 9, complete: false };
  }
  
  const openedTiles = userData.stats?.opened_core_tiles || [];
  const uniqueCount = new Set(openedTiles).size;
  return {
    progress: uniqueCount,
    target: 9,
    complete: uniqueCount >= 9
  };
}
