(function registerNotificationsClient() {
  try {
    if (typeof window === 'undefined') return;

    const state = {
      token: null,
      ready: false
    };

    function getFirebase() {
      return typeof window.firebase !== 'undefined' ? window.firebase : null;
    }

    function getAuthedUser() {
      const fb = getFirebase();
      if (!fb || !fb.auth) return null;
      return fb.auth().currentUser || null;
    }

    async function ensureServiceWorker() {
      if (!('serviceWorker' in navigator)) return null;
      try {
        const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        return reg;
      } catch {
        return null;
      }
    }

    async function ensurePermission() {
      if (!('Notification' in window)) return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      const res = await Notification.requestPermission();
      return res === 'granted';
    }

    async function getMessagingToken() {
      const fb = getFirebase();
      if (!fb || !fb.messaging) return null;

      const ok = await ensurePermission();
      if (!ok) return null;

      const swReg = await ensureServiceWorker();
      try {
        const messaging = fb.messaging();
        const token = await messaging.getToken({ serviceWorkerRegistration: swReg });
        return token || null;
      } catch {
        return null;
      }
    }

    async function registerTokenWithBackend(token) {
      if (!token) return;
      const user = getAuthedUser();
      if (!user) return;

      const idToken = await user.getIdToken();
      await fetch('/api/notifications/register-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({ token })
      }).catch(() => {});
    }

    async function initForCurrentUser() {
      const user = getAuthedUser();
      if (!user) return { ok: false, error: 'Not authenticated' };

      const token = await getMessagingToken();
      if (!token) return { ok: false, error: 'No token' };

      state.token = token;
      state.ready = true;
      await registerTokenWithBackend(token);
      return { ok: true, token };
    }

    async function recordArticleRead({ articleId, articleTitle, quizId, url }) {
      const user = getAuthedUser();
      if (!user) return;
      const idToken = await user.getIdToken();

      await fetch('/api/notifications/article-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          articleId,
          articleTitle,
          quizId: quizId || null,
          url: url || null,
          occurredAt: Date.now()
        })
      }).catch(() => {});
    }

    window.NotificationsClient = {
      initForCurrentUser,
      recordArticleRead,
      _state: state
    };

    // auto-init on auth state
    const fb = getFirebase();
    if (fb && fb.auth) {
      fb.auth().onAuthStateChanged((user) => {
        if (user) {
          initForCurrentUser().catch(() => {});
        }
      });
    }
  } catch (e) {
    // ignore
  }
})();
