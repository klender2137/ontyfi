// Account Settings Module - UI and logic for account settings screen

const AccountSettings = {
  eventHandlers: [],
  _busy: false,
  
  // Initialize settings screen with user data
  init(container, userAccount, onClose) {
    this.container = container;
    this.userAccount = userAccount;
    this.onClose = onClose;
    this.cleanup();
    this.render();
  },

  _getFirebaseUser() {
    try {
      if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function') return null;
      const auth = firebase.auth();
      return auth?.currentUser || null;
    } catch {
      return null;
    }
  },

  async _saveProfileToFirebase() {
    if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function') {
      throw new Error('Firebase not available');
    }

    const u = this._getFirebaseUser();
    if (!u?.uid) {
      throw new Error('You must be signed in to save settings');
    }

    const local = this.userAccount.getUserData();
    const profilePatch = {
      uid: u.uid,
      email: u.email || null,
      display_name: local.username || u.displayName || (u.email ? u.email.split('@')[0] : 'user'),
      username: local.username || u.displayName || (u.email ? u.email.split('@')[0] : 'user'),
      pfp: local.pfp ?? null,
      role: local.role || 'user',
      preferences: {
        defaultScreen: local.preferences?.defaultScreen || 'home',
        language: local.preferences?.language || 'en',
        preferredDomain: local.preferences?.preferredDomain || '',
        investingCapital: Number(local.preferences?.investingCapital || 0),
        yearsOfExperience: local.preferences?.yearsOfExperience || 'newcomer',
        highlightKeywords: Array.isArray(local.preferences?.highlightKeywords) ? local.preferences.highlightKeywords : [],
      },
      activities: {
        lastActiveDate: local.activities?.lastActiveDate || new Date().toISOString(),
        streakDays: Number(local.activities?.streakDays || 0),
        totalArticlesRead: Number(local.activities?.totalArticlesRead || 0),
        lastArticleRead: local.activities?.lastArticleRead || null,
        todaysFocus: local.activities?.todaysFocus || null,
      },
      personalInfo: {
        joinDate: local.personalInfo?.joinDate || new Date().toISOString(),
      },
      last_active: new Date(),
      updated_at: new Date(),
    };

    const db = firebase.firestore();
    await db.collection('users').doc(u.uid).set(profilePatch, { merge: true });
  },

  async _handleLogout() {
    if (this._busy) return;
    this._busy = true;
    try {
      if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function') {
        throw new Error('Firebase not available');
      }
      await firebase.auth().signOut();
      try {
        window.localStorage.removeItem('cryptoExplorer.userId');
        window.localStorage.removeItem('cryptoExplorer.guestSession');
      } catch {}
      this.cleanup();
      this.onClose();
      window.location.hash = '#home';
      window.location.reload();
    } finally {
      this._busy = false;
    }
  },

  async _handleDeleteAccount() {
    if (this._busy) return;
    const ok = window.confirm('Delete account? This will remove your profile document and your sign-in credentials. This cannot be undone.');
    if (!ok) return;
    this._busy = true;
    try {
      const u = this._getFirebaseUser();
      if (!u?.uid) throw new Error('No authenticated user');

      if (typeof firebase !== 'undefined' && typeof firebase.firestore === 'function') {
        try {
          await firebase.firestore().collection('users').doc(u.uid).delete();
        } catch (e) {
          console.warn('[AccountSettings] Failed to delete user doc:', e);
        }
      }

      try {
        await u.delete();
      } catch (e) {
        if (e?.code === 'auth/requires-recent-login') {
          throw new Error('Please sign in again, then retry deleting your account (Firebase requires a recent login).');
        }
        throw e;
      }

      try {
        window.localStorage.removeItem('cryptoExplorer.userId');
        window.localStorage.removeItem('cryptoExplorer.guestSession');
        window.localStorage.removeItem('cryptoExplorer.userAccount');
      } catch {}

      this.cleanup();
      this.onClose();
      window.location.hash = '#home';
      window.location.reload();
    } finally {
      this._busy = false;
    }
  },

  // Cleanup event handlers
  cleanup() {
    this.eventHandlers.forEach(({ element, event, handler }) => {
      if (element && element.removeEventListener) {
        element.removeEventListener(event, handler);
      }
    });
    this.eventHandlers = [];
  },

  // Add tracked event listener
  addEventHandler(element, event, handler) {
    if (element && element.addEventListener) {
      element.addEventListener(event, handler);
      this.eventHandlers.push({ element, event, handler });
    }
  },

  // Render settings UI
  render() {
    const user = this.userAccount.getUserData();
    const pfpOptions = [
      { value: null, label: 'Default Avatar', emoji: '👤' },
      { value: 'crypto1', label: 'Crypto Explorer', emoji: '🚀' },
      { value: 'crypto2', label: 'Blockchain Builder', emoji: '⛓️' },
      { value: 'crypto3', label: 'DeFi Trader', emoji: '💎' },
      { value: 'crypto4', label: 'NFT Collector', emoji: '🎨' }
    ];

    this.container.innerHTML = `
      <div class="account-settings-screen">
        <h2 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Account Settings</h2>
        <div class="secondary-text" style="margin-bottom: 1.5rem;">
          Manage your profile and preferences
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Profile</div>
          
          <div class="setting-item">
            <label class="setting-label">Profile Picture</label>
            <div class="pfp-selector">
              ${pfpOptions.map(opt => `
                <button 
                  class="pfp-option ${user.pfp === opt.value ? 'pfp-option--active' : ''}"
                  data-value="${opt.value || 'null'}"
                >
                  <span class="pfp-emoji">${opt.emoji}</span>
                  <span class="pfp-label">${opt.label}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="setting-item">
            <label class="setting-label">Username</label>
            <input 
              type="text" 
              class="setting-input" 
              value="${user.username}" 
              id="username-input"
            />
          </div>
        </div>

        <div class="settings-section" style="margin-top: 2rem;">
          <div class="settings-section-title">Preferences</div>
          
          <div class="setting-item">
            <label class="setting-label">Default Screen</label>
            <select class="setting-select" id="default-screen-select">
              <option value="home" ${user.preferences.defaultScreen === 'home' ? 'selected' : ''}>Home</option>
              <option value="tree" ${user.preferences.defaultScreen === 'tree' ? 'selected' : ''}>Tree CryptoMap</option>
            </select>
          </div>

          <div class="setting-item">
            <label class="setting-label">App Language</label>
            <select class="setting-select" id="language-select">
              <option value="en" ${user.preferences.language === 'en' ? 'selected' : ''}>English</option>
              <option value="es" ${user.preferences.language === 'es' ? 'selected' : ''}>Spanish</option>
              <option value="fr" ${user.preferences.language === 'fr' ? 'selected' : ''}>French</option>
              <option value="de" ${user.preferences.language === 'de' ? 'selected' : ''}>German</option>
            </select>
          </div>

          <div class="setting-item">
            <label class="setting-label">Preferred Domain Name</label>
            <input 
              type="text" 
              class="setting-input" 
              placeholder="e.g., trading, defi, nft"
              value="${user.preferences.preferredDomain || ''}"
              id="domain-input"
            />
          </div>

          <div class="setting-item">
            <label class="setting-label">
              Current Investing Capital: $<span id="capital-value">${user.preferences.investingCapital.toLocaleString()}</span>
            </label>
            <div class="capital-selector">
              <input 
                type="range" 
                class="capital-slider" 
                min="0" 
                max="1000000" 
                step="1000"
                value="${user.preferences.investingCapital}"
                id="capital-slider"
              />
              <input 
                type="number" 
                class="capital-input" 
                min="0" 
                max="1000000"
                value="${user.preferences.investingCapital}"
                id="capital-input"
              />
            </div>
          </div>

          <div class="setting-item">
            <label class="setting-label">Years of Experience in Crypto</label>
            <select class="setting-select" id="experience-select">
              <option value="newcomer" ${user.preferences.yearsOfExperience === 'newcomer' ? 'selected' : ''}>&lt;1y - New Comer</option>
              <option value="recent" ${user.preferences.yearsOfExperience === 'recent' ? 'selected' : ''}>1y - Recent Adopter</option>
              <option value="junior" ${user.preferences.yearsOfExperience === 'junior' ? 'selected' : ''}>2y - Junior Investor</option>
              <option value="experienced" ${user.preferences.yearsOfExperience === 'experienced' ? 'selected' : ''}>3y - Experienced Investor</option>
              <option value="ancient" ${user.preferences.yearsOfExperience === 'ancient' ? 'selected' : ''}>4y+ - Ancient Adopter</option>
            </select>
          </div>
        </div>
      </div>

      <div style="margin-top: 2rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <button class="primary-button" id="save-settings-btn">Save Settings</button>
        <button class="secondary-button" id="cancel-settings-btn">Cancel</button>
        <button class="secondary-button" id="logout-btn">Log out</button>
        <button class="secondary-button" id="delete-account-btn" style="border-color: #ef4444; color: #ef4444;">Delete Account</button>
      </div>
    `;

    this.attachEventHandlers();
  },

  // Attach event handlers
  attachEventHandlers() {
    // PFP selection
    this.container.querySelectorAll('.pfp-option').forEach(btn => {
      const handler = (e) => {
        const value = e.currentTarget.dataset.value === 'null' ? null : e.currentTarget.dataset.value;
        this.userAccount.updatePFP(value);
        this.render();
      };
      this.addEventHandler(btn, 'click', handler);
    });

    // Username input
    const usernameInput = this.container.querySelector('#username-input');
    const usernameHandler = () => {
      this.userAccount.updateUsername(usernameInput.value || 'crypto.explorer');
    };
    this.addEventHandler(usernameInput, 'blur', usernameHandler);

    // Default screen
    const defaultScreenSelect = this.container.querySelector('#default-screen-select');
    const screenHandler = () => {
      this.userAccount.updatePreferences({ defaultScreen: defaultScreenSelect.value });
    };
    this.addEventHandler(defaultScreenSelect, 'change', screenHandler);

    // Language
    const languageSelect = this.container.querySelector('#language-select');
    const langHandler = () => {
      this.userAccount.updatePreferences({ language: languageSelect.value });
    };
    this.addEventHandler(languageSelect, 'change', langHandler);

    // Domain
    const domainInput = this.container.querySelector('#domain-input');
    const domainHandler = () => {
      this.userAccount.updatePreferences({ preferredDomain: domainInput.value });
    };
    this.addEventHandler(domainInput, 'blur', domainHandler);

    // Capital slider and input
    const capitalSlider = this.container.querySelector('#capital-slider');
    const capitalInput = this.container.querySelector('#capital-input');
    const capitalValue = this.container.querySelector('#capital-value');

    const sliderHandler = (e) => {
      const value = parseInt(e.target.value);
      capitalInput.value = value;
      capitalValue.textContent = value.toLocaleString();
      this.userAccount.updatePreferences({ investingCapital: value });
    };
    this.addEventHandler(capitalSlider, 'input', sliderHandler);

    const inputHandler = (e) => {
      let value = parseInt(e.target.value) || 0;
      if (value < 0) value = 0;
      if (value > 1000000) value = 1000000;
      capitalSlider.value = value;
      capitalValue.textContent = value.toLocaleString();
      this.userAccount.updatePreferences({ investingCapital: value });
    };
    this.addEventHandler(capitalInput, 'input', inputHandler);

    // Experience
    const experienceSelect = this.container.querySelector('#experience-select');
    const expHandler = () => {
      this.userAccount.updatePreferences({ yearsOfExperience: experienceSelect.value });
    };
    this.addEventHandler(experienceSelect, 'change', expHandler);

    // Save button
    const saveBtn = this.container.querySelector('#save-settings-btn');
    const saveHandler = async () => {
      try {
        await this._saveProfileToFirebase();
        this.showSuccessMessage();
        setTimeout(() => {
          this.cleanup();
          this.onClose();
        }, 800);
      } catch (e) {
        alert(e?.message || 'Failed to save settings');
      }
    };
    this.addEventHandler(saveBtn, 'click', saveHandler);

    const logoutBtn = this.container.querySelector('#logout-btn');
    if (logoutBtn) {
      this.addEventHandler(logoutBtn, 'click', () => this._handleLogout());
    }

    const deleteBtn = this.container.querySelector('#delete-account-btn');
    if (deleteBtn) {
      this.addEventHandler(deleteBtn, 'click', () => this._handleDeleteAccount());
    }

    // Cancel button
    const cancelBtn = this.container.querySelector('#cancel-settings-btn');
    const cancelHandler = () => {
      this.cleanup();
      this.onClose();
    };
    this.addEventHandler(cancelBtn, 'click', cancelHandler);
  },

  // Show success message
  showSuccessMessage() {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = '✓ Settings saved successfully!';
    successDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #10b981;
      color: white;
      padding: 1rem 2rem;
      border-radius: 8px;
      z-index: 1000;
      font-weight: 600;
    `;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.parentNode.removeChild(successDiv);
      }
    }, 1500);
  }
};
