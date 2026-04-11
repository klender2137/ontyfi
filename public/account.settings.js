// Account Settings Module — FinPath: Finance Career & Wealth Explorer
// Neon blue-noir palette · logout · cancel-to-home · finance-focused UX

const AccountSettings = {
  eventHandlers: [],
  _busy: false,

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
      return firebase.auth()?.currentUser || null;
    } catch { return null; }
  },

  async _saveProfileToFirebase() {
    if (typeof firebase === 'undefined' || typeof firebase.firestore !== 'function')
      throw new Error('Firebase not available');
    const u = this._getFirebaseUser();
    if (!u?.uid) throw new Error('You must be signed in to save settings');

    const local = this.userAccount.getUserData();
    const profilePatch = {
      uid: u.uid,
      email: u.email || null,
      display_name: local.username || u.displayName || (u.email ? u.email.split('@')[0] : 'user'),
      username: local.username,
      linkedin_sub: local.linkedin_sub,
      linkedin_id: local.linkedin_id,
      linkedin_verified: true,
      last_active: new Date(),
      hustle_count: local.hustleHistory?.length || 0,
      total_points: local.totalPoints || 0,
      rank: local.rank || 'Beginner',
      last_login: new Date(),
      preferences: {
        defaultScreen:      local.preferences?.defaultScreen      || 'home',
        language:           local.preferences?.language           || 'en',
        careerTrack:        local.preferences?.careerTrack        || 'generalist',
        netWorthGoalAt30:   Number(local.preferences?.netWorthGoalAt30   || 500000),
        currentNetWorth:    Number(local.preferences?.currentNetWorth    || 0),
        currentAge:         Number(local.preferences?.currentAge         || 22),
        riskProfile:        local.preferences?.riskProfile        || 'moderate',
        primaryMarkets:     Array.isArray(local.preferences?.primaryMarkets) ? local.preferences.primaryMarkets : ['equities'],
        currency:           local.preferences?.currency           || 'USD',
        weeklyStudyHours:   Number(local.preferences?.weeklyStudyHours   || 5),
        showNetWorthPublic: local.preferences?.showNetWorthPublic ?? false,
        emailDigest:        local.preferences?.emailDigest        ?? true,
        careerStage:        local.preferences?.careerStage        || 'student',
      },
      activities: {
        lastActiveDate:    local.activities?.lastActiveDate    || new Date().toISOString(),
        streakDays:        Number(local.activities?.streakDays        || 0),
        totalArticlesRead: Number(local.activities?.totalArticlesRead || 0),
        lastArticleRead:   local.activities?.lastArticleRead   || null,
        todaysFocus:       local.activities?.todaysFocus       || null,
      },
      personalInfo: { joinDate: local.personalInfo?.joinDate || new Date().toISOString() },
      updated_at:   new Date(),
    };

    await firebase.firestore().collection('users').doc(u.uid).set(profilePatch, { merge: true });
  },

  // ── Sign out → redirect home ──────────────────────────────────────────────
  async _handleLogout() {
    if (this._busy) return;
    this._busy = true;
    try {
      if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function')
        throw new Error('Firebase not available');
      await firebase.auth().signOut();
      try {
        window.localStorage.removeItem('finPath.userId');
        window.localStorage.removeItem('finPath.guestSession');
      } catch {}
      this.cleanup();
      this.onClose();
      window.location.hash = '#home';
      window.location.reload();
    } catch (e) {
      alert(e?.message || 'Sign out failed.');
    } finally {
      this._busy = false;
    }
  },

  // ── Cancel: close panel and navigate home without saving ─────────────────
  _handleCancel() {
    this.cleanup();
    this.onClose();
    window.location.hash = '#home';
  },

  async _handleDeleteAccount() {
    if (this._busy) return;
    const ok = window.confirm(
      'Delete account? This will permanently remove your profile, career progress, and sign-in credentials. This cannot be undone.'
    );
    if (!ok) return;
    this._busy = true;
    try {
      const u = this._getFirebaseUser();
      if (!u?.uid) throw new Error('No authenticated user');
      if (typeof firebase !== 'undefined' && typeof firebase.firestore === 'function') {
        try { await firebase.firestore().collection('users').doc(u.uid).delete(); }
        catch (e) { console.warn('[AccountSettings] Firestore delete failed:', e); }
      }
      try { await u.delete(); }
      catch (e) {
        if (e?.code === 'auth/requires-recent-login')
          throw new Error('Please sign in again, then retry deleting your account.');
        throw e;
      }
      try {
        ['finPath.userId', 'finPath.guestSession', 'finPath.userAccount']
          .forEach(k => window.localStorage.removeItem(k));
      } catch {}
      this.cleanup();
      this.onClose();
      window.location.hash = '#home';
      window.location.reload();
    } catch (e) {
      alert(e?.message || 'Delete failed.');
    } finally {
      this._busy = false;
    }
  },

  cleanup() {
    this.eventHandlers.forEach(({ element, event, handler }) => {
      if (element?.removeEventListener) element.removeEventListener(event, handler);
    });
    this.eventHandlers = [];
  },

  addEventHandler(element, event, handler) {
    if (element?.addEventListener) {
      element.addEventListener(event, handler);
      this.eventHandlers.push({ element, event, handler });
    }
  },

  _formatWealth(value) {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
    if (value >= 1_000)     return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
  },

  _wealthTierLabel(value) {
    if (value < 100_000)   return { label: 'Financial Foundation',   desc: 'Emergency fund + first investments secured', color: '#3b82f6' };
    if (value < 300_000)   return { label: 'Early Accumulator',      desc: 'Compounding has started working for you',   color: '#2563eb' };
    if (value < 600_000)   return { label: 'Pre-HNW Trajectory',     desc: 'On path to High Net Worth by mid-30s',     color: '#1d4ed8' };
    if (value < 1_000_000) return { label: 'The 7-Figure Runway',    desc: 'Millionaire status within reach at 30',    color: '#00cfff' };
    if (value < 3_000_000) return { label: 'High Net Worth',         desc: 'Institutional-level wealth at your age',   color: '#06b6d4' };
    return                        { label: 'Ultra HNW / F.U. Money', desc: 'Financial independence, any path you want', color: '#00ffcc' };
  },

  _projectionText(goal, currentNW, currentAge) {
    const yearsLeft = Math.max(1, 30 - currentAge);
    if (goal - currentNW <= 0) return "You've already hit your target. Time to set a new one.";
    const r = 0.08 / 12, n = yearsLeft * 12;
    const fvExisting = currentNW * Math.pow(1 + r, n);
    const remainingNeeded = Math.max(0, goal - fvExisting);
    const pmt = remainingNeeded > 0 ? (remainingNeeded * r) / (Math.pow(1 + r, n) - 1) : 0;
    if (pmt < 1) return `Your existing ${this._formatWealth(currentNW)} should compound to your goal at 8% p.a.`;
    return `~${this._formatWealth(Math.round(pmt / 100) * 100)}/mo needed at 8% p.a. over ${yearsLeft} yrs`;
  },

  // ── AUTH HELPERS ─────────────────────────────────────────────────────────
  _handleConnectLinkedIn() {
    // Dispatch event for LinkedIn connection flow
    window.dispatchEvent(new CustomEvent('RequestLinkedInConnect', {
      detail: { source: 'settings' }
    }));
  },

  _handleUnlinkLinkedIn() {
    if (!confirm('Unlink your LinkedIn account? You will need to reconnect to complete LinkedIn-related quests.')) return;
    
    this.userAccount.updateProfile({
      linkedin_sub: null,
      linkedin_verified: false
    }).then(() => {
      this.render();
    }).catch((e) => {
      alert('Failed to unlink LinkedIn: ' + (e?.message || 'Unknown error'));
    });
  },

  // ── RENDER ────────────────────────────────────────────────────────────────
  render() {
    const user  = this.userAccount.getUserData();
    const prefs = user.preferences || {};

    const pfpOptions = [
      { value: null,         label: 'Default',     emoji: '👤', desc: 'Standard'        },
      { value: 'analyst',    label: 'Analyst',      emoji: '📊', desc: 'Equity Research' },
      { value: 'trader',     label: 'Trader',       emoji: '📈', desc: 'Markets'         },
      { value: 'pe',         label: 'PE Associate', emoji: '🏦', desc: 'Private Equity'  },
      { value: 'vc',         label: 'VC Scout',     emoji: '🚀', desc: 'Venture Capital' },
      { value: 'quant',      label: 'Quant',        emoji: '⚙️',  desc: 'Systematic'      },
      { value: 'cfo',        label: 'CFO Track',    emoji: '🎯', desc: 'Corp. Finance'   },
      { value: 'realestate', label: 'RE Investor',  emoji: '🏢', desc: 'Real Assets'     },
    ];

    const careerTracks = [
      { value: 'investment-banking', label: 'Investment Banking'           },
      { value: 'asset-management',   label: 'Asset Management / Buy Side'  },
      { value: 'private-equity',     label: 'Private Equity'               },
      { value: 'venture-capital',    label: 'Venture Capital'              },
      { value: 'quantitative',       label: 'Quantitative Finance'         },
      { value: 'corporate-finance',  label: 'Corporate Finance / CFO'      },
      { value: 'real-estate',        label: 'Real Estate & Infrastructure' },
      { value: 'fintech',            label: 'FinTech / Startups'           },
      { value: 'trading',            label: 'Sales & Trading'              },
      { value: 'generalist',         label: 'Still Exploring'              },
    ];

    const careerStages = [
      { value: 'student',   label: 'Student / Pre-career'    },
      { value: 'intern',    label: 'Intern'                   },
      { value: 'analyst',   label: 'Analyst  (0–3 yrs)'      },
      { value: 'associate', label: 'Associate (3–6 yrs)'     },
      { value: 'vp',        label: 'VP / Manager (6–10 yrs)' },
      { value: 'director',  label: 'Director (10+ yrs)'      },
    ];

    const riskProfiles = [
      { value: 'conservative', label: 'Conservative', sub: 'Capital preservation first'   },
      { value: 'moderate',     label: 'Moderate',     sub: 'Balanced growth & protection' },
      { value: 'aggressive',   label: 'Aggressive',   sub: 'Maximum growth, high vol.'    },
      { value: 'speculative',  label: 'Speculative',  sub: 'High-risk, asymmetric bets'   },
    ];

    const marketOptions = [
      { value: 'equities',        label: 'Equities'         },
      { value: 'fixed-income',    label: 'Fixed Income'     },
      { value: 'real-estate',     label: 'Real Estate'      },
      { value: 'private-markets', label: 'Private Markets'  },
      { value: 'derivatives',     label: 'Derivatives'      },
      { value: 'commodities',     label: 'Commodities'      },
      { value: 'crypto',          label: 'Crypto / Digital' },
      { value: 'fx',              label: 'FX / Macro'       },
    ];

    const selectedMarkets = Array.isArray(prefs.primaryMarkets) ? prefs.primaryMarkets : ['equities'];
    const nwGoal      = Number(prefs.netWorthGoalAt30 || 500_000);
    const currentNW   = Number(prefs.currentNetWorth  || 0);
    const currentAge  = Number(prefs.currentAge       || 22);
    const tier        = this._wealthTierLabel(nwGoal);
    const projection  = this._projectionText(nwGoal, currentNW, currentAge);
    const weeklyHours = Number(prefs.weeklyStudyHours || 5);

    this.container.innerHTML = `
      <style>
        /* ── Neon blue-noir palette ─────────────────────────────────────── */
        .fp {
          --bg:        #080c14;
          --bg2:       #0d1422;
          --bg3:       #111927;
          --border:    rgba(0,180,255,0.14);
          --border2:   rgba(0,180,255,0.32);
          --neon:      #00b4ff;
          --neon2:     #0066cc;
          --neon-glow: rgba(0,180,255,0.22);
          --text:      #ddeeff;
          --muted:     #4f7090;
          --accent:    #00cfff;
          --danger:    #ff4466;
          --danger-b:  rgba(255,68,102,0.22);
          --success:   #00ffaa;
          --radius:    10px;
          --ui:        'Helvetica Neue', Arial, sans-serif;
        }

        .fp {
          background: var(--bg); color: var(--text);
          font-family: var(--ui); max-width: 680px;
          border-radius: 16px; padding: 1.75rem 1.5rem 1.5rem;
        }
        .fp * { box-sizing: border-box; }

        /* Header */
        .fp-header {
          margin-bottom: 1.75rem; padding-bottom: 1.25rem;
          border-bottom: 1px solid var(--border);
        }
        .fp-header-title {
          font-size: 21px; font-weight: 700; margin: 0 0 4px;
          letter-spacing: -0.4px; color: var(--text);
        }
        .fp-header-sub { font-size: 12px; color: var(--muted); margin: 0; }

        /* Sections */
        .fp-section { margin-bottom: 1.875rem; }
        .fp-section-title {
          font-size: 9px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--neon);
          margin: 0 0 1rem; padding-bottom: 6px;
          border-bottom: 1px solid var(--border);
        }

        /* Rows */
        .fp-row   { display: flex; flex-direction: column; gap: 5px; margin-bottom: 1rem; }
        .fp-label { font-size: 12px; font-weight: 600; color: var(--text); letter-spacing: 0.01em; }
        .fp-sublabel { font-size: 11px; color: var(--muted); margin-top: -3px; }
        .fp-input-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .fp-input, .fp-select {
          font-family: var(--ui); font-size: 13px;
          padding: 8px 11px; border-radius: 8px;
          border: 1px solid var(--border2);
          background: var(--bg2); color: var(--text);
          width: 100%; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .fp-input:focus, .fp-select:focus {
          border-color: var(--neon);
          box-shadow: 0 0 0 3px var(--neon-glow);
        }
        .fp-select option { background: var(--bg2); }

        /* PFP grid */
        .fp-pfp-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
        .fp-pfp-btn {
          background: var(--bg2); border: 1.5px solid var(--border);
          border-radius: var(--radius); padding: 10px 6px 8px;
          cursor: pointer; text-align: center;
          transition: border-color 0.15s, box-shadow 0.15s;
          font-family: var(--ui);
        }
        .fp-pfp-btn:hover { border-color: var(--border2); }
        .fp-pfp-btn.active {
          border-color: var(--neon);
          box-shadow: 0 0 10px var(--neon-glow);
          background: var(--bg3);
        }
        .fp-pfp-emoji { font-size: 20px; display: block; margin-bottom: 4px; line-height: 1; }
        .fp-pfp-label { font-size: 11px; font-weight: 600; color: var(--text); display: block; }
        .fp-pfp-desc  { font-size: 10px; color: var(--muted); display: block; margin-top: 1px; }

        /* Net worth widget */
        .fp-nw-widget {
          background: var(--bg2); border: 1px solid var(--border2);
          border-radius: 12px; padding: 1.25rem; margin-bottom: 0.875rem;
        }
        .fp-nw-top {
          display: flex; align-items: flex-start;
          justify-content: space-between; margin-bottom: 1rem;
        }
        .fp-nw-amount {
          font-size: 34px; font-weight: 700; letter-spacing: -1.5px;
          line-height: 1; color: var(--accent);
          text-shadow: 0 0 20px rgba(0,207,255,0.45);
        }
        .fp-nw-tier-desc { font-size: 11px; color: var(--muted); margin-top: 4px; }
        .fp-nw-tier-badge {
          font-size: 10px; font-weight: 700; letter-spacing: 0.05em;
          padding: 4px 10px; border-radius: 999px; color: #000;
          white-space: nowrap; flex-shrink: 0;
        }
        .fp-nw-slider {
          width: 100%; margin: 0.5rem 0; cursor: pointer;
          accent-color: var(--neon); touch-action: pan-y;
        }
        .fp-nw-labels {
          display: flex; justify-content: space-between;
          font-size: 10px; color: var(--muted); margin-top: 2px;
        }
        .fp-nw-projection {
          margin-top: 0.75rem; padding-top: 0.75rem;
          border-top: 1px solid var(--border);
          font-size: 12px; color: var(--muted);
          display: flex; align-items: center; gap: 6px;
        }
        .fp-proj-value { font-weight: 700; color: var(--neon); }

        /* Risk grid */
        .fp-risk-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; }
        .fp-risk-btn {
          background: var(--bg2); border: 1.5px solid var(--border);
          border-radius: var(--radius); padding: 10px 12px;
          cursor: pointer; text-align: left; font-family: var(--ui);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .fp-risk-btn:hover { border-color: var(--border2); }
        .fp-risk-btn.active {
          border-color: var(--neon);
          box-shadow: 0 0 8px var(--neon-glow);
          background: var(--bg3);
        }
        .fp-risk-name {
          font-size: 13px; font-weight: 600; color: var(--text);
          display: block; margin-bottom: 2px;
        }
        .fp-risk-sub { font-size: 11px; color: var(--muted); }

        /* Market chips */
        .fp-market-chips { display: flex; flex-wrap: wrap; gap: 7px; }
        .fp-market-chip {
          font-family: var(--ui); font-size: 12px; font-weight: 500;
          padding: 5px 13px; border-radius: 999px;
          border: 1.5px solid var(--border2);
          background: var(--bg2); color: var(--muted);
          cursor: pointer; transition: all 0.12s;
        }
        .fp-market-chip.active {
          background: var(--neon2); color: #fff; border-color: var(--neon);
          box-shadow: 0 0 8px var(--neon-glow);
        }

        /* Study slider */
        .fp-study-row { display: flex; align-items: center; gap: 12px; }
        .fp-study-slider {
          flex: 1; accent-color: var(--neon);
          cursor: pointer; touch-action: pan-y;
        }
        .fp-study-val {
          font-size: 13px; font-weight: 700;
          min-width: 56px; color: var(--neon);
        }

        /* Toggle switches */
        .fp-toggle-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 0; border-bottom: 1px solid var(--border);
        }
        .fp-toggle-row:last-of-type { border-bottom: none; }
        .fp-toggle-title { font-size: 13px; font-weight: 600; color: var(--text); }
        .fp-toggle-desc  { font-size: 11px; color: var(--muted); margin-top: 1px; }

        .fp-switch {
          position: relative; display: inline-block;
          width: 40px; height: 22px; flex-shrink: 0;
        }
        .fp-switch input { opacity: 0; width: 0; height: 0; }
        .fp-slider-sw {
          position: absolute; inset: 0;
          background: var(--bg3); border: 1px solid var(--border2);
          border-radius: 999px; cursor: pointer; transition: all 0.2s;
        }
        .fp-slider-sw:before {
          content: ''; position: absolute;
          width: 16px; height: 16px; left: 2px; top: 2px;
          background: var(--muted); border-radius: 50%;
          transition: transform 0.2s, background 0.2s;
        }
        input:checked + .fp-slider-sw {
          background: var(--neon2); border-color: var(--neon);
        }
        input:checked + .fp-slider-sw:before {
          transform: translateX(18px); background: #fff;
        }

        /* ── Action bar ─────────────────────────────────────────────────── */
        .fp-actions {
          display: flex; gap: 8px; flex-wrap: wrap;
          margin-top: 1.5rem; padding-top: 1.25rem;
          border-top: 1px solid var(--border); align-items: center;
        }
        .fp-btn {
          font-family: var(--ui); font-size: 13px; font-weight: 600;
          padding: 9px 18px; border-radius: 8px; border: 1.5px solid transparent;
          cursor: pointer; transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
          letter-spacing: 0.01em;
        }
        .fp-btn:active { transform: scale(0.97); }

        /* Save — solid neon blue */
        .fp-btn-primary {
          background: var(--neon2); color: #fff; border-color: var(--neon);
          box-shadow: 0 0 12px var(--neon-glow);
        }
        .fp-btn-primary:hover { box-shadow: 0 0 22px var(--neon-glow); opacity: 0.9; }

        /* Back to Home — ghost with neon border */
        .fp-btn-secondary {
          background: transparent; color: var(--text); border-color: var(--border2);
        }
        .fp-btn-secondary:hover { border-color: var(--neon); color: var(--neon); }

        /* Sign Out — dim ghost */
        .fp-btn-logout {
          background: transparent; color: var(--muted); border-color: var(--border);
        }
        .fp-btn-logout:hover { border-color: var(--neon); color: var(--neon); }

        /* Delete — red neon */
        .fp-btn-danger {
          background: transparent; color: var(--danger); border-color: var(--danger-b);
        }
        .fp-btn-danger:hover {
          border-color: var(--danger);
          box-shadow: 0 0 10px rgba(255,68,102,0.28);
        }

        .fp-btn-spacer { flex: 1; }
      </style>

      <div class="fp">

        <!-- Header -->
        <div class="fp-header">
          <h2 class="fp-header-title">Account Settings</h2>
          <p class="fp-header-sub">Manage your profile, career path, and financial goals</p>
        </div>

        <!-- 1 · Profile Identity -->
        <div class="fp-section">
          <div class="fp-section-title">Profile Identity</div>

          <div class="fp-row">
            <div class="fp-label">Profile Avatar</div>
            <div class="fp-sublabel">Choose one that reflects your finance focus</div>
            <div class="fp-pfp-grid">
              ${pfpOptions.map(opt => `
                <button class="fp-pfp-btn ${user.pfp === opt.value ? 'active' : ''}"
                        data-value="${opt.value ?? 'null'}">
                  <span class="fp-pfp-emoji">${opt.emoji}</span>
                  <span class="fp-pfp-label">${opt.label}</span>
                  <span class="fp-pfp-desc">${opt.desc}</span>
                </button>`).join('')}
            </div>
          </div>

          <div class="fp-input-row">
            <div class="fp-row" style="margin-bottom:0">
              <label class="fp-label">Display Name</label>
              <input type="text" id="username-input" class="fp-input"
                     value="${user.username || ''}" placeholder="Your name" />
            </div>
            <div class="fp-row" style="margin-bottom:0">
              <label class="fp-label">App Language</label>
              <select id="language-select" class="fp-select">
                <option value="en" ${prefs.language === 'en' ? 'selected' : ''}>English</option>
                <option value="fr" ${prefs.language === 'fr' ? 'selected' : ''}>French</option>
                <option value="de" ${prefs.language === 'de' ? 'selected' : ''}>German</option>
                <option value="es" ${prefs.language === 'es' ? 'selected' : ''}>Spanish</option>
                <option value="zh" ${prefs.language === 'zh' ? 'selected' : ''}>Mandarin</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 2 · Career Profile -->
        <div class="fp-section">
          <div class="fp-section-title">Career Profile</div>

          <div class="fp-input-row">
            <div class="fp-row" style="margin-bottom:0">
              <label class="fp-label">Career Track</label>
              <select id="career-track-select" class="fp-select">
                ${careerTracks.map(t => `
                  <option value="${t.value}" ${prefs.careerTrack === t.value ? 'selected' : ''}>${t.label}</option>`
                ).join('')}
              </select>
            </div>
            <div class="fp-row" style="margin-bottom:0">
              <label class="fp-label">Career Stage</label>
              <select id="career-stage-select" class="fp-select">
                ${careerStages.map(s => `
                  <option value="${s.value}" ${prefs.careerStage === s.value ? 'selected' : ''}>${s.label}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <div class="fp-row" style="margin-top:0.875rem">
            <div class="fp-label">Weekly Study Commitment</div>
            <div class="fp-sublabel">Calibrates your learning path intensity</div>
            <div class="fp-study-row">
              <input type="range" id="study-slider" class="fp-study-slider"
                     min="1" max="40" step="1" value="${weeklyHours}" />
              <span class="fp-study-val" id="study-val">${weeklyHours} hr/wk</span>
            </div>
          </div>
        </div>

        <!-- 3 · Wealth Target -->
        <div class="fp-section">
          <div class="fp-section-title">Wealth Target — Net Worth by 30</div>

          <div class="fp-nw-widget">
            <div class="fp-nw-top">
              <div>
                <div class="fp-nw-amount" id="nw-goal-display">${this._formatWealth(nwGoal)}</div>
                <div class="fp-nw-tier-desc" id="nw-tier-desc">${tier.desc}</div>
              </div>
              <span class="fp-nw-tier-badge" id="nw-tier-badge"
                    style="background:${tier.color}">${tier.label}</span>
            </div>
            <input type="range" id="nw-goal-slider" class="fp-nw-slider"
                   min="50000" max="10000000" step="50000" value="${nwGoal}" />
            <div class="fp-nw-labels">
              <span>$50K</span><span>$500K</span><span>$1M</span><span>$5M</span><span>$10M</span>
            </div>
            <div class="fp-nw-projection">
              <span>◈</span>
              <span id="nw-proj-text"><span class="fp-proj-value">${projection}</span></span>
            </div>
          </div>

          <div class="fp-input-row">
            <div class="fp-row" style="margin-bottom:0">
              <label class="fp-label">Current Age</label>
              <input type="number" id="age-input" class="fp-input"
                     min="16" max="29" value="${currentAge}" placeholder="22" />
            </div>
            <div class="fp-row" style="margin-bottom:0">
              <label class="fp-label">Current Net Worth ($)</label>
              <input type="number" id="current-nw-input" class="fp-input"
                     min="0" value="${currentNW}" placeholder="0" />
            </div>
          </div>
        </div>

        <!-- 4 · Investment Profile -->
        <div class="fp-section">
          <div class="fp-section-title">Investment Profile</div>

          <div class="fp-row">
            <div class="fp-label">Risk Tolerance</div>
            <div class="fp-risk-grid">
              ${riskProfiles.map(r => `
                <button class="fp-risk-btn ${(prefs.riskProfile || 'moderate') === r.value ? 'active' : ''}"
                        data-risk="${r.value}">
                  <span class="fp-risk-name">${r.label}</span>
                  <span class="fp-risk-sub">${r.sub}</span>
                </button>`).join('')}
            </div>
          </div>

          <div class="fp-row">
            <div class="fp-label">Primary Markets of Interest</div>
            <div class="fp-sublabel">Select all that apply — shapes your content feed</div>
            <div class="fp-market-chips">
              ${marketOptions.map(m => `
                <button class="fp-market-chip ${selectedMarkets.includes(m.value) ? 'active' : ''}"
                        data-market="${m.value}">${m.label}</button>`).join('')}
            </div>
          </div>

          <div class="fp-row">
            <label class="fp-label">Preferred Currency Display</label>
            <select id="currency-select" class="fp-select">
              <option value="USD" ${prefs.currency === 'USD' ? 'selected' : ''}>USD — US Dollar</option>
              <option value="EUR" ${prefs.currency === 'EUR' ? 'selected' : ''}>EUR — Euro</option>
              <option value="GBP" ${prefs.currency === 'GBP' ? 'selected' : ''}>GBP — British Pound</option>
              <option value="CHF" ${prefs.currency === 'CHF' ? 'selected' : ''}>CHF — Swiss Franc</option>
              <option value="JPY" ${prefs.currency === 'JPY' ? 'selected' : ''}>JPY — Japanese Yen</option>
              <option value="SGD" ${prefs.currency === 'SGD' ? 'selected' : ''}>SGD — Singapore Dollar</option>
            </select>
          </div>
        </div>

        <!-- 5 · Privacy & Notifications -->
        <div class="fp-section">
          <div class="fp-section-title">Privacy & Notifications</div>

          <div class="fp-toggle-row">
            <div>
              <div class="fp-toggle-title">Show net worth progress publicly</div>
              <div class="fp-toggle-desc">Visible on your profile to other FinPath users</div>
            </div>
            <label class="fp-switch">
              <input type="checkbox" id="toggle-nw-public" ${prefs.showNetWorthPublic ? 'checked' : ''} />
              <span class="fp-slider-sw"></span>
            </label>
          </div>

          <div class="fp-toggle-row">
            <div>
              <div class="fp-toggle-title">Weekly financial digest email</div>
              <div class="fp-toggle-desc">Markets summary, career tips, and curated learning picks</div>
            </div>
            <label class="fp-switch">
              <input type="checkbox" id="toggle-email-digest" ${prefs.emailDigest !== false ? 'checked' : ''} />
              <span class="fp-slider-sw"></span>
            </label>
          </div>

          <div class="fp-toggle-row" style="border-bottom:none">
            <div>
              <div class="fp-toggle-title">Default screen on launch</div>
              <div class="fp-toggle-desc">What you see first when you open the app</div>
            </div>
            <select id="default-screen-select" class="fp-select" style="max-width:165px">
              <option value="home"    ${prefs.defaultScreen === 'home'    ? 'selected' : ''}>Home Feed</option>
              <option value="markets" ${prefs.defaultScreen === 'markets' ? 'selected' : ''}>Markets</option>
              <option value="career"  ${prefs.defaultScreen === 'career'  ? 'selected' : ''}>Career Path</option>
            </select>
          </div>
        </div>

        <!-- 6 · LinkedIn Connection -->
        <div class="fp-section">
          <div class="fp-section-title">Professional Profile</div>
          
          <div class="fp-row">
            <div class="fp-label">LinkedIn Account</div>
            <div class="fp-sublabel" id="linkedin-status">
              ${user.linkedin_sub ? 'LinkedIn connected' : 'Connect your LinkedIn to unlock quests'}
            </div>
            <div style="margin-top: 10px;">
              ${user.linkedin_sub ? 
                `<button class="fp-btn fp-btn-secondary" id="unlink-linkedin-btn" style="font-size: 12px; padding: 6px 12px;">Unlink LinkedIn</button>` :
                `<button class="fp-btn fp-btn-primary" id="connect-linkedin-btn" style="font-size: 12px; padding: 6px 12px;">🔗 Connect LinkedIn</button>`
              }
            </div>
          </div>
          
          ${user.linkedin_sub ? `
          <div class="fp-row" style="margin-top: 0.5rem;">
            <div style="font-size: 11px; color: var(--success); word-break: break-all;">
              ✓ Professional profile connected
            </div>
          </div>
          ` : ''}
        </div>

        <!-- ── Action bar ─────────────────────────────────────────────────── -->
        <div class="fp-actions">
          <button class="fp-btn fp-btn-primary"   id="save-settings-btn">Save Settings</button>
          <button class="fp-btn fp-btn-secondary" id="cancel-settings-btn">← Back to Home</button>
          <div class="fp-btn-spacer"></div>
          <button class="fp-btn fp-btn-logout"    id="logout-btn">Sign Out</button>
          <button class="fp-btn fp-btn-danger"    id="delete-account-btn">Delete Account</button>
        </div>

      </div>
    `;

    this.attachEventHandlers();
  },

  // ── EVENT HANDLERS ────────────────────────────────────────────────────────
  attachEventHandlers() {
    const user  = this.userAccount.getUserData();
    const prefs = user.preferences || {};
    let selectedMarkets = Array.isArray(prefs.primaryMarkets) ? [...prefs.primaryMarkets] : ['equities'];

    // PFP
    this.container.querySelectorAll('.fp-pfp-btn').forEach(btn => {
      this.addEventHandler(btn, 'click', (e) => {
        const value = e.currentTarget.dataset.value === 'null' ? null : e.currentTarget.dataset.value;
        this.userAccount.updatePFP(value);
        this.container.querySelectorAll('.fp-pfp-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Username — 'change' is safer than 'blur' on Android
    const usernameInput = this.container.querySelector('#username-input');
    this.addEventHandler(usernameInput, 'change', () => {
      this.userAccount.updateUsername(usernameInput.value || 'finance.explorer');
    });

    // Language
    const langSelect = this.container.querySelector('#language-select');
    this.addEventHandler(langSelect, 'change', () => {
      this.userAccount.updatePreferences({ language: langSelect.value });
    });

    // Career track & stage
    const careerTrackSelect = this.container.querySelector('#career-track-select');
    this.addEventHandler(careerTrackSelect, 'change', () => {
      this.userAccount.updatePreferences({ careerTrack: careerTrackSelect.value });
    });
    const careerStageSelect = this.container.querySelector('#career-stage-select');
    this.addEventHandler(careerStageSelect, 'change', () => {
      this.userAccount.updatePreferences({ careerStage: careerStageSelect.value });
    });

    // Study slider
    const studySlider = this.container.querySelector('#study-slider');
    const studyVal    = this.container.querySelector('#study-val');
    this.addEventHandler(studySlider, 'input', () => {
      const v = parseInt(studySlider.value);
      studyVal.textContent = `${v} hr/wk`;
      this.userAccount.updatePreferences({ weeklyStudyHours: v });
    });

    // Net worth goal slider + live projection update
    const nwSlider   = this.container.querySelector('#nw-goal-slider');
    const nwDisplay  = this.container.querySelector('#nw-goal-display');
    const nwBadge    = this.container.querySelector('#nw-tier-badge');
    const nwTierDesc = this.container.querySelector('#nw-tier-desc');
    const nwProjText = this.container.querySelector('#nw-proj-text');

    const updateNWGoal = () => {
      const val    = parseInt(nwSlider.value);
      const ageVal = parseInt(this.container.querySelector('#age-input')?.value        || 22);
      const curNW  = parseInt(this.container.querySelector('#current-nw-input')?.value || 0);
      const tier   = this._wealthTierLabel(val);
      nwDisplay.textContent    = this._formatWealth(val);
      nwBadge.textContent      = tier.label;
      nwBadge.style.background = tier.color;
      nwTierDesc.textContent   = tier.desc;
      nwProjText.innerHTML     = `<span class="fp-proj-value">${this._projectionText(val, curNW, ageVal)}</span>`;
      this.userAccount.updatePreferences({ netWorthGoalAt30: val });
    };
    this.addEventHandler(nwSlider, 'input', updateNWGoal);

    const ageInput = this.container.querySelector('#age-input');
    this.addEventHandler(ageInput, 'input', () => {
      const v = Math.min(29, Math.max(16, parseInt(ageInput.value) || 22));
      this.userAccount.updatePreferences({ currentAge: v });
      updateNWGoal();
    });

    const curNWInput = this.container.querySelector('#current-nw-input');
    this.addEventHandler(curNWInput, 'input', () => {
      const v = Math.max(0, parseInt(curNWInput.value) || 0);
      this.userAccount.updatePreferences({ currentNetWorth: v });
      updateNWGoal();
    });

    // Risk profile
    this.container.querySelectorAll('.fp-risk-btn').forEach(btn => {
      this.addEventHandler(btn, 'click', (e) => {
        this.container.querySelectorAll('.fp-risk-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.userAccount.updatePreferences({ riskProfile: e.currentTarget.dataset.risk });
      });
    });

    // Market chips (multi-toggle)
    this.container.querySelectorAll('.fp-market-chip').forEach(chip => {
      this.addEventHandler(chip, 'click', (e) => {
        const market = e.currentTarget.dataset.market;
        if (selectedMarkets.includes(market)) {
          selectedMarkets = selectedMarkets.filter(m => m !== market);
          e.currentTarget.classList.remove('active');
        } else {
          selectedMarkets.push(market);
          e.currentTarget.classList.add('active');
        }
        this.userAccount.updatePreferences({ primaryMarkets: selectedMarkets });
      });
    });

    // Currency
    const currencySelect = this.container.querySelector('#currency-select');
    this.addEventHandler(currencySelect, 'change', () => {
      this.userAccount.updatePreferences({ currency: currencySelect.value });
    });

    // Toggles
    const toggleNWPublic = this.container.querySelector('#toggle-nw-public');
    this.addEventHandler(toggleNWPublic, 'change', () => {
      this.userAccount.updatePreferences({ showNetWorthPublic: toggleNWPublic.checked });
    });
    const toggleDigest = this.container.querySelector('#toggle-email-digest');
    this.addEventHandler(toggleDigest, 'change', () => {
      this.userAccount.updatePreferences({ emailDigest: toggleDigest.checked });
    });

    // Default screen
    const defaultScreenSelect = this.container.querySelector('#default-screen-select');
    this.addEventHandler(defaultScreenSelect, 'change', () => {
      this.userAccount.updatePreferences({ defaultScreen: defaultScreenSelect.value });
    });

    // LinkedIn connection
    const connectLinkedInBtn = this.container.querySelector('#connect-linkedin-btn');
    if (connectLinkedInBtn) {
      this.addEventHandler(connectLinkedInBtn, 'click', () => this._handleConnectLinkedIn());
    }

    // LinkedIn unlink
    const unlinkLinkedInBtn = this.container.querySelector('#unlink-linkedin-btn');
    if (unlinkLinkedInBtn) {
      this.addEventHandler(unlinkLinkedInBtn, 'click', () => this._handleUnlinkLinkedIn());
    }

    // ── Save ─────────────────────────────────────────────────────────────────
    const saveBtn = this.container.querySelector('#save-settings-btn');
    this.addEventHandler(saveBtn, 'click', async () => {
      try {
        await this._saveProfileToFirebase();
        this.showSuccessMessage();
        setTimeout(() => { this.cleanup(); this.onClose(); }, 900);
      } catch (e) {
        alert(e?.message || 'Failed to save settings.');
      }
    });

    // ── Cancel → back to home (no save) ──────────────────────────────────────
    const cancelBtn = this.container.querySelector('#cancel-settings-btn');
    this.addEventHandler(cancelBtn, 'click', () => this._handleCancel());

    // ── Sign out ──────────────────────────────────────────────────────────────
    const logoutBtn = this.container.querySelector('#logout-btn');
    this.addEventHandler(logoutBtn, 'click', () => this._handleLogout());

    // ── Delete account ────────────────────────────────────────────────────────
    const deleteBtn = this.container.querySelector('#delete-account-btn');
    this.addEventHandler(deleteBtn, 'click', () => this._handleDeleteAccount());
  },

  showSuccessMessage() {
    const el = document.createElement('div');
    el.textContent = '✓ Settings saved';
    el.style.cssText = `
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: #0d1422;
      border: 1px solid #00b4ff;
      box-shadow: 0 0 28px rgba(0,180,255,0.35);
      color: #00cfff;
      padding: 0.875rem 2rem;
      border-radius: 10px;
      z-index: 9999;
      font-family: 'Helvetica Neue', sans-serif;
      font-size: 14px; font-weight: 700;
      letter-spacing: 0.06em;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.parentNode?.removeChild(el), 1600);
  },
};