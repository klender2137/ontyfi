# OntyFi

**LinkedIn OIDC Authentication with Finance Fit Index**

A React-based financial education platform featuring interactive knowledge mapping, career diagnostics, and market research access. Built with Firebase, Express, and Google Drive API integration.

---

## Project Structure

```
CryptoExplorer0.5/
├── src/
│   ├── components/          # React screen components
│   ├── contexts/            # Auth context providers
│   ├── hooks/               # Custom React hooks
│   ├── services/            # Firebase and API services
│   ├── store/               # Zustand state management
│   ├── styles/              # CSS and styling
│   └── utils/               # Utility functions
├── routes/                  # Express API routes
├── services/                # Backend services (Drive, Firebase Admin)
├── data/                    # JSON data files (crypto tree, descriptions)
├── functions/               # Firebase functions
├── public/                  # Static assets and web workers
└── scripts/                 # Build and data generation scripts
```

---

## Application Routes (Screens)

### 1. Authentication Screen (`/`, initial load)
**File:** `src/components/AuthScreen.jsx`

**Purpose:** User authentication and guest access entry point

**Content:**
- **Sign In Mode:** Email/password login form
- **Sign Up Mode:** Account creation with display name, email, password validation
- **Google OAuth Button:** Continue with Google authentication
- **LinkedIn OAuth Button:** Continue with LinkedIn authentication (LinkedIn blue theme)
- **Guest Mode:** Continue without authentication
- **Google Account Linking:** Modal for linking Google to existing password accounts
- **Error Display:** Firebase error message rendering

**Features:**
- Email validation (RFC 5322 pattern)
- Password strength validation (8+ chars, letter + number)
- Touch-optimized button interactions (scale transforms)
- Auto-complete attributes for accessibility

---

### 2. Home Screen (`/home`)
**File:** `src/components/Home.jsx`

**Purpose:** Main dashboard and navigation hub

**Content:**
- **Header:** OntyFi branding with ConnectButton (RainbowKit/Web3)
- **User Status:** Welcome message with username, streak days, articles read
- **Navigation Cards:**
  - MyInsights card (purple theme) → `/my-insights`
  - CryptoMap Tree card (blue theme) → `/tree`
- **Account Management:**
User should simply click on the un obvious PFP in order to open setting where he will be able to fill out the account details and personalize preferences up to the net worth goal until 30yo.
  - Logout button
  - Delete Account button with confirmation modal
- **Finance Archetype Diagnostic Entry:**
  - Rotated rhombus button with gradient styling
  - Decorative corner accents
  - "Discover Your Archetype" call-to-action
  - Navigation to `/archetype-diagnostic`

**Features:**
- Bookmark synchronization with Firebase on mount
- Touch gesture handling (scale transforms on buttons)
- Delete account confirmation modal with destructive styling
- LinkedIn OAuth integration via ConnectButton

---

### Navigation
User can navigate along the using the Navigation menu in the circle on the bottom right corner of the screen. Which features acess to the screens as : Tree Map, MyInsights, LevelUp, NewBranch(with the announces about new articles published), Favorite(with the bookmarks saved), Explore - a screen assembelling tags of the articles from the TreeMap nested tree in order to provide tag theme based aggregation of articles into the thematical bubbles. Which are not only useful, for research and exploration under another angle. But also is very entertaining(User double clicking on the bubble can drag the bubbles and they will rebounce from each other. One click opens the echeloned articles related to the bubble subject).
Contreebute screen - lets user suggest the article he wants to publish and send the ready version of it to the review and approval - straight away wikipedia openess and community involvement.

### 3. MyInsights Screen (`/my-insights`, default route `/`)
**File:** `src/components/MyInsightsScreen.jsx`

**Purpose:** IB and finance student ressource sharing online opensource no copyright restricted lib. Sector distinction in folder roots and genral templates and technical skills in finance honing templates tools

**Content:**
- **Background:** 
- **Ticker Background:** Real-time stock price ticker (30s update interval)
- **Header:** "MyInsights"  
- **Controls:** Refresh button, Back Home link
- **File Grid:** Responsive grid of research documents
- **File Cards:**
  - Icon (PDF, Sheet, Slides, Doc, Image, Text)
  - File name
  - File type badge with color coding

**Document Viewer (Modal):**
- Full-screen overlay with backdrop blur
- File-type specific rendering:
  - PDF: Google Drive PDF preview
  - Spreadsheets: Google Sheets embed or viewerng
  - Presentations: Google Slides embed
  - Documents: Google Docs preview
  - Text files: Pre-formatted text display (via backend proxy)
  - Images: Thumbnail with object-fit contain
- Error fallback with "Open in Google Drive" button
- Loading states and iframe sandboxing

**Features:**
- 24-hour localStorage caching of file list
- WebGL shader background (crystal web animation)
- Real-time stock ticker overlay
- File type detection by MIME type and extension
- Error boundary for crash protection

---

### LevelUp screen
Allows user to get involved in to the gamified learning and competition by gaining Oreos currency and boost its elvel and earn the Oreas by completing the Quests. THen the players can see each other in the global ranking based on the in app time spent , fav field and Oreos amount

### 4. CryptoMap Tree (`/tree`)
**File:** `src/components/TreeMap.jsx`

**Purpose:** Interactive knowledge map of crypto/finance domains article for each domain and in each branch 1 article about jobs in that sector and 1 article about key tasks and skills to master. User can ass notes to the tiles double clicking, changing theme, grabing and moving tiles. The description openable by clicking on title of the tile. There user can read ful article, bookmark it and even attept a quiz if one exists to test knowledge. On top of the TreeMap screen there is a scifi search bar allowing user to search for articles by key words also it accepts the link search to the specific tile. On each tile clicking on the link button user copies its link 

**Content:**
- **Archetype Result Banner (conditional):** Displayed when navigated from diagnostic
  - Top field icon and label
  - Archetype name
  - Retake Test and Close buttons
- **Header:** "CryptoMap Tree" title with zoom controls and Home button
- **Zoom Controls:** Minus/Plus buttons (50%-200% range), percentage display
- **Tile Grid:** Auto-fill grid of knowledge tiles (min 300px)

**Tile Components:**
- **New Article Badge:** Cyan gradient for newly added content
- **Title:** Clickable navigation to article view
- **Description:** 3-line clamped text, expandable to 6 lines
- **Description Ref:** Source file reference (green text)
- **Expand/Fold Button:** Toggle tile expansion
- **Bookmark Button:** Toggle bookmark status (green when active)
- **Open Button:** External link opener for new articles
- **Tags Section:** Up to 4 tags displayed in expanded mode

**Tile Interactions:**
- **Drag and Drop:** Pointer-based tile repositioning
- **Anti-clutter Positioning:** Poisson disc sampling with physics
- **Branch Boundaries:** Hierarchical field organization
- **Highlight Matching:** Archetype field highlighting with custom colors

**Features:**
- Pinch zoom gesture support (0.5x - 2x scale)
- Pan/drag navigation
- Anti-clutter positioning algorithm (minTileDistance: 180px)
- Gamification integration (tile open tracking)
- Touch-optimized interactions
- GPU-accelerated transforms (translate3d)

---

### 5. Finance Archetype Diagnostic (`/archetype-diagnostic`)
**File:** `src/components/FinanceArchetypeScreen.jsx`, `src/components/Questionaire.jsx`

**Purpose:** 7-question interactive assessment to determine finance career fit

**States:**
1. **Loading State:** Spinner with "Loading..." text
2. **Intro Screen:**
   - Rhombus icon header
   - "Finance Archetype Diagnostic" title
   - Feature list: Speed under pressure, Risk tolerance, Social preferences
   - "Start Diagnostic" button
   - "Back to Home" button

3. **Questionnaire Interface:**
   - Progress bar with percentage
   - Question counter (1-7)
   - Question subtitle (trait being measured)
   - Interactive question components

**Question Components:**

**Q1: Chaos Threshold Slider**
- Scenario: Cockpit emergency decision
- 0-100 range slider
- Labels: "Need full diagnostic first" to "Pull it — trust the gut"
- Measures: Speed vs Precision

**Q2: Persistence Grid**
- 5×5 grid of shapes (24 squares, 1 triangle)
- 30-second countdown timer
- Visual progress bar (green → orange → red)
- Find the odd shape (triangle)
- Continue options based on find/timeout
- Measures: Precision, Technical, Endurance

**Q3: Ethical Ranker**
- Drag-and-drop ranking interface
- 4 scenarios: 100-hour weeks, 500 layoffs decision, $1M loss, 8h alone at terminal
- Reorder from most to least tolerable
- Measures: Endurance, Narrative, Risk, Social

**Q4: Narrative Builder**
- Sentence completion with chip selection
- 3 slots: Action (Analyzing, Negotiating, Hedging, Governing), Subject (Startup, Corporation, Math Model, Public Infrastructure), Outcome (changes world, beats market, ensures stability, closes deal)
- Real-time sentence preview
- Measures: Technical, Social, Risk, Stability, Narrative, Endurance

**Q5: Information Diet**
- Multi-select up to 3 headlines from 5 options
- Headlines cover: Poker math, Startup drama, Municipal bonds, Fed policy, Oil mergers
- Checkbox-style selection
- Measures: Technical, Social, Risk, Stability, Narrative, Endurance

**Q6: Social Battery Clock**
- 0-16 hour slider
- Real-time role preview (Analyst: 0-2h, Hybrid: 3-7h, Front office: 8h+)
- Measures: Social, Stability, Endurance

**Q7: Loss Aversion Toss**
- Coin flip gambling simulation
- Start with $1,000
- 51% win chance, 2.1× multiplier
- Wallet display with BUST state
- Flip counter, loss counter
- "Flip the coin" / "Walk away" / "See my results" actions
- Measures: Risk, Speed, Endurance

**Results Screen:**
- Winner field card with:
  - Field icon and color coding
  - "YOUR DESTINY FIELD" label
  - Field name
  - Archetype name
  - Field description
- Full ranking list (all 9 fields with fit percentages)
- Fit visualization bars
- Navigation buttons: "Explore in TreeMap", "Tell me how to break into [field]"

**Supported Fields:**
- QuantFin (Quant Finance) — The Architect
- IB (Investment Banking) — The Gladiator
- VC (Venture Capital) — The Visionary
- RiskM (Risk Management) — The Sentry
- HedgeFund (Hedge Funds) — The Gambler
- FPA (FP&A) — The Navigator
- AssetMgmt (Asset Management) — The Guardian
- PublicFin (Public Finance) — The Diplomat
- PE (Private Equity) — The Surgeon

**Features:**
- Results cached in localStorage
- Firebase persistence for authenticated users
- Navigation to TreeMap with result state
- GPT prompt generation for career advice

---

### 6. Finance Fit Questionnaire (`/finance-questionnaire`)
**File:** `src/components/FinanceFitQuestionnaire.jsx`

**Purpose:** Calculate Finance Fit Index (F_i) for investment readiness

**Authentication Gate:**
- Redirects unauthenticated users to sign-in prompt

**Questions (5 total):**
1. **Risk Tolerance:** Reaction to 20% portfolio loss
   - Options: Sell everything, Sell some, Hold, Buy more
2. **Investment Knowledge:** Familiarity with markets/products
   - Options: No knowledge → Expert level
3. **Financial Stability:** Emergency fund status
   - Options: None → More than 6 months
4. **Time Horizon:** Investment duration plan
   - Options: <1 year → >7 years
5. **Investment Style:** Approach statement
   - Options: Capital preservation → Maximum growth

**Scoring:**
- Each option worth 5-20 points
- Total max score: 100
- Profile categories based on score ranges

**Results Display:**
- Circular score display with gradient background
- "Profile: [category]" badge
- Explanation text about F_i measurement
- Retake option

**Features:**
- Progress bar with step indicator
- Previous/Next navigation
- Firebase ID token authorization
- Completion status checking on load

---

### 7. LinkedIn OAuth Callback (`/auth/callback`)
**File:** `src/components/LinkedInCallback.jsx`

**Purpose:** Handle LinkedIn OIDC authentication flow

**Content:**
- Loading spinner during token exchange
- Error display for failed authentication
- Automatic navigation to home on success
- User document creation in Firestore

---

## API Routes (Backend)

### Authentication Routes
**File:** `routes/auth-simple.routes.js`, `routes/linkedin-auth.routes.js`

- `GET /api/auth/linkedin` - Initiate LinkedIn OAuth flow
- `GET /api/auth/linkedin/callback` - LinkedIn callback handler
- `POST /api/auth/linkedin/verify` - Token verification

### Questionnaire Routes
**File:** `routes/questionnaire.routes.js`

- `GET /api/questionnaire/status` - Check completion status (requires Bearer token)
- `POST /api/questionnaire/submit` - Submit answers and calculate F_i

### Insights Routes
**File:** `routes/insights.routes.js`

- `GET /api/insights/finance-resources` - List Google Drive research files
- `GET /api/insights/file-content` - Proxy text file content (avoids CORS)

### Tree Routes
**File:** `routes/tree.routes.js`

- `GET /api/tree` - Retrieve crypto knowledge tree structure

### Role Routes
**File:** `routes/role.routes.js`

- Role management endpoints for user permissions

### Activity Analytics Routes
**File:** `routes/activity-analytics.routes.js`

- User activity tracking and analytics

### Notification Routes
**File:** `routes/notifications.routes.js`

- Notification scheduling and delivery

### Embed Routes
**File:** `routes/embed.routes.js`

- oEmbed and embeddable content endpoints

### Finance Routes
**File:** `routes/finance.routes.js`

- Market data and financial calculations

---

## State Management

### useAppStore (Zustand)
**File:** `src/store/useAppStore.js`

**State:**
- `user`: { username, preferences, activities }
- `bookmarks`: Array of bookmarked nodes (user-specific localStorage)
- `tree`: Knowledge tree data
- `treeLoading`: Boolean
- `treeError`: Error object

**Actions:**
- `setTree()`, `setTreeLoading()`, `setTreeError()`
- `toggleBookmark(node)`: Add/remove bookmarks with localStorage sync
- `isBookmarked(nodeId)`: Check bookmark status
- `getUserInterests()`: Aggregate tags from bookmarks and preferences
- `syncBookmarksWithFirebase()`: Encrypt and sync to Firestore
- `loadUserBookmarks(userId)`: Load user-specific bookmarks
- `clearBookmarks()`: Clear on logout
- `initializeBookmarksForUser(userId)`: Auth state handler

**Encryption:**
- AES-GCM encryption for favorites using wallet signature derived key
- Minified JSON for storage efficiency

---

## Custom Hooks

### useTreeData
**File:** `src/hooks/useTreeData.js`

Fetches and caches crypto tree data with error handling and loading states.

### useTouchGesture
**File:** `src/hooks/useTouchGesture.js`

Pinch zoom, pan, and long-press gesture detection for mobile interactions.

### useTilePositioning
**File:** `src/hooks/useTilePositioning.js`

Anti-clutter positioning algorithm using Poisson disc sampling and physics-based repulsion.

### usePerformanceOptimizations
**File:** `src/hooks/usePerformanceOptimizations.js`

Debounce and throttling utilities for performance optimization.

### useFinanceResources
**File:** `src/hooks/useFinanceResources.js`

Google Drive API integration for research materials.

### useUserRole
**File:** `src/hooks/useUserRole.js`

Role-based access control hook.

 

---

## Services

### Firebase Service
**File:** `src/services/firebase.js`

Firebase app initialization, auth instance, Firestore db export.

### Drive Service
**File:** `services/drive.service.js`

Google Drive API integration for file listing and content retrieval.

### Role Service
**File:** `services/role.service.js`

User role management and permission checking.

### Tree Services
**Files:** `services/tree.services.js`, `services/treeModular.service.js`

Knowledge tree data management and modular tree operations.

### Notification Scheduler
**File:** `services/notification-scheduler.js`

Scheduled notification delivery system.

### Firebase Admin
**Files:** `services/firebase-admin.js`, `services/firebase.admin.js`

Admin SDK initialization for backend operations.

---

## Utilities

### cryptoUtils
**File:** `src/utils/cryptoUtils.js`

- `deriveEncryptionKey(signature)`: Derive AES key from wallet signature
- `encryptData(key, data)`: AES-GCM encryption
- `decryptData(key, encrypted)`: AES-GCM decryption
- `minifyJSON(obj)`: Compact JSON stringification
- `parseJSON(str)`: Safe JSON parsing

### markdownUtils
**File:** `src/utils/markdownUtils.js`

Markdown parsing and rendering utilities.

### TextLayoutEngine
**File:** `src/utils/TextLayoutEngine.js`

Text layout calculation and optimization.

---

## Web Workers

### PDF Worker
**File:** `public/workers/pdf-worker.js`

PDF processing in web worker context.

### Excel Worker
**File:** `public/workers/excel-worker.js`

Spreadsheet processing in web worker context.

---

## Dependencies

### Core
- React 18.3.1
- React DOM 18.3.1
- React Router DOM 6.20.0

### State & Data
- Zustand (store management)
- Firebase 12.9.0 (Auth, Firestore)
- Firebase Admin 12.0.0

### Backend
- Express 5.2.1
- CORS 2.8.6
- Google APIs 130.0.0

### Build
- Vite 5.0.0
- @vitejs/plugin-react 4.0.0

### Utilities
- Axios 1.13.6
- Cheerio 1.2.0 (HTML parsing)
- dotenv 17.3.1
- Playwright 1.55.0 (scraping)

### Web3
- RainbowKit (implied by ConnectButton usage)

---

## Environment Variables

```
# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REDIRECT_URI=

# Google Drive
GOOGLE_DRIVE_API_KEY=
GOOGLE_SERVICE_ACCOUNT_KEY=

# Server
PORT=3000
SESSION_SECRET=
```

---

## Scripts

```bash
npm run dev         # Start development server
npm run dev:vite    # Start Vite dev server only
npm run build       # Production build
npm start           # Start production server
```

---

## Data Structure

### Crypto Tree
**File:** `data/cryptoTree.json`

Hierarchical knowledge structure:
```javascript
{
  fields: [
    {
      id: string,
      name: string,
      description: string,
      descriptionRef: string,  // File path reference
      tags: string[],
      isNewArticle: boolean,
      external_link: string,
      categories: [...],
      subcategories: [...],
      nodes: [...],
      subnodes: [...],
      leafnodes: [...]
    }
  ]
}
```

---

## Security Features

- Firebase Authentication with multiple providers (Email, Google, LinkedIn)
- AES-GCM encryption for user bookmarks
- Wallet signature-based key derivation
- CORS-protected API routes
- OAuth 2.0 / OIDC compliance for LinkedIn
- Session management with secure cookies
- Firestore security rules (configured in `firestore.rules`)
