# Tree Map Unfold Issue - Comprehensive Analysis Report

**Date:** March 24, 2026  
**Severity:** CRITICAL  
**Affected Tiles:** 8 out of 9 branches  

---

## Executive Summary

Only **1 branch tile is fully unfoldable with tags** (Global Asset Management Institution) out of 9 total primary tiles. The other 8 branches display without tags and cannot be unfolded. This is caused by **structural inconsistencies in branch JSON files and a mismatch between the tree children array detection logic**.

---

## Root Causes Identified

### 1. **CRITICAL: Child Array Name Mismatch** ⚠️

The `getChildren()` function in `tree-utils.js` (line 4-10) only recognizes these child array names:
```javascript
getChildren: (node) => [
  ...(node.categories || []),
  ...(node.subcategories || []),
  ...(node.nodes || []),
  ...(node.subnodes || []),
  ...(node.leafnodes || []),
  ...(node.children || [])
]
```

However, the branch JSON files use **different child array names**:

#### Branch Structure Audit:

| Branch File | Child Array Used | Currently Recognized? | Status |
|---|---|---|---|
| **AssetMangementBranch.json** | `categories` | ✅ YES | ✓ WORKING |
| **investmentBanking.json** | `institutions` | ❌ NO | ❌ BROKEN |
| **VCbranch.json** | `institutions` | ❌ NO | ❌ BROKEN |
| **PEbranch.json** | `institutions` | ❌ NO | ❌ BROKEN |
| **QuantBranch.json** | `institutions` | ❌ NO | ❌ BROKEN |
| **pubfinBranch.json** | `categories` | ✅ YES | ✓ WORKING (partial) |
| **HedgeFbranche.json** | `institutions` | ❌ NO | ❌ BROKEN |
| **RiskMbranche.json** | `tiles` | ❌ NO | ❌ BROKEN |
| **FPnAbranch.json** | `institutions` | ❌ NO | ❌ BROKEN |

**Impact:** When `getChildren()` returns an empty array for 8 branches, the TreeTile component's unfold indicator doesn't render (line 196 of tree-components.js):
```javascript
childrenCount > 0 && React.createElement('span', { key: 'indicator', className: 'tree-expand-indicator' }, ...)
```

---

### 2. **CRITICAL: Missing Tags on 8 Branches**

Only **Asset Management** branch has tags at the root level:

```json
{
  "id": "asset-management-ecosystem",
  "name": "Global Asset Management Institution",
  "description": "...",
  "tags": ["asset-management", "investment-management", "capital-allocation"],
  "categories": [...]
}
```

All other 8 branches are **missing the `tags` array entirely** at the root level. When tags are missing, the TreeTile meta section (line 189 of tree-components.js) renders nothing:
```javascript
...(node.tags || []).slice(0, 2).map(tag => React.createElement('span', { key: tag, className: 'tag-pill' }, tag))
```

**Missing Tags by Branch:**
- ❌ investmentBanking.json - NO TAGS
- ❌ VCbranch.json - NO TAGS
- ❌ PEbranch.json - NO TAGS
- ❌ QuantBranch.json - NO TAGS
- ❌ pubfinBranch.json - NO TAGS (though Ministry of Finance subcategory has tags)
- ❌ HedgeFbranche.json - NO TAGS
- ❌ RiskMbranche.json - NO TAGS
- ❌ FPnAbranch.json - NO TAGS

---

### 3. **STRUCTURAL: Risk Management Branch Uses Wrong Child Array**

`RiskMbranche.json` uses `"tiles"` instead of the expected naming convention:

```json
{
  "id": "risk-management-sector",
  "name": "Risk Management",
  "type": "core-root",
  "tiles": [           // ❌ WRONG - Should be categories, subcategories, nodes, etc.
    { "id": "gsibs", ... }
  ]
}
```

All other branches use `institutions` (inconsistent with Asset Management which uses `categories`).

---

### 4. **BACKEND: Description Loading Not Tied to Root Tiles**

The `resolveDescriptions()` function in `treeModular.service.js` (line 245+) only processes nodes with `descriptionRef` properties. **Root-level branch tiles don't have `descriptionRef` entries**, so tags from description files cannot be auto-merged.

While the function is designed to merge tags from description files:
```javascript
if (result.tags && result.tags.length > 0) {
  if (!node.tags) {
    node.tags = [];
  }
  result.tags.forEach(tag => {
    // Add tags to node
  });
}
```

This only helps nodes that already have a `descriptionRef`. Root tiles need explicit `tags` arrays.

---

## Data Flow Analysis

### Current Flow (Why Only Asset Management Works):

1. **API Request:** Client fetches `/api/tree`
2. **Backend Processing:**
   - `tree.services.js` calls `treeModular.getFullTree()`
   - Loads all 9 branches from JSON
   - Calls `resolveDescriptions()` on each branch
3. **Rendering Logic:**
   - `TreeScreen.js` receives tree with branches as `fields`
   - For each field, renders a `TreeTile` component
   - Calls `getChildren(node)` to determine if tile is unfoldable
   - Reads `node.tags` to display tag pills
4. **Why Asset Management Works:**
   - Has `categories` array → `getChildren()` finds children → unfold indicator shows
   - Has `tags` array → `node.tags || []` renders tags
5. **Why Others Fail:**
   - Have `institutions` array instead of `categories` → `getChildren()` returns `[]` → no unfold indicator
   - No `tags` array → renders empty tag section

---

## Files Involved

### Backend Files:
- **`services/treeModular.service.js`** - Tree loading and description resolution
- **`services/tree.services.js`** - Tree service wrapper
- **`routes/tree.routes.js`** - API endpoints

### Frontend Files:
- **`public/TreeScreen.js`** - Main tree display component
- **`public/tree-modules/tree-utils.js`** - `getChildren()` function (CORE ISSUE)
- **`public/tree-modules/tree-components.js`** - TreeTile rendering logic

### Data Files (ALL need fixing):
- `data/branches/investmentBanking.json` - Uses `institutions`, missing `tags`
- `data/branches/VCbranch.json` - Uses `institutions`, missing `tags`
- `data/branches/PEbranch.json` - Uses `institutions`, missing `tags`
- `data/branches/QuantBranch.json` - Uses `institutions`, missing `tags`
- `data/branches/HedgeFbranche.json` - Uses `institutions`, missing `tags`
- `data/branches/RiskMbranche.json` - Uses `tiles`, missing `tags`
- `data/branches/FPnAbranch.json` - Uses `institutions`, missing `tags`
- `data/branches/pubfinBranch.json` - Uses `categories`, missing `tags`
- `data/branches/AssetMangementBranch.json` - ✓ Uses `categories`, HAS `tags`

---

## Diagram: Why Only Asset Management Works

```
Asset Management Branch (WORKING):
├─ JSON: { categories: [...], tags: [...] }
├─ getChildren() → finds categories array → returns children ✓
├─ childrenCount > 0 → unfold indicator renders ✓
└─ node.tags exists → tag pills render ✓

Investment Banking Branch (BROKEN):
├─ JSON: { institutions: [...], tags: MISSING }
├─ getChildren() → doesn't recognize institutions → returns [] ✗
├─ childrenCount === 0 → NO unfold indicator ✗
└─ node.tags undefined → NO tag pills ✗
```

---

## Fix Strategy

### Phase 1: Fix Child Array Recognition
**Update `getChildren()` in `tree-utils.js` to recognize all child array types:**
- Keep existing: `categories`, `subcategories`, `nodes`, `subnodes`, `leafnodes`, `children`
- Add new: `institutions`, `tiles`, `functions`, `roles` (if used elsewhere)

### Phase 2: Normalize Branch JSON Structure
**Option A (Recommended):** Rename all `institutions` to `categories` in all branch files
**Option B:** Rename `tiles` in RiskMbranche to `categories`

### Phase 3: Add Tags to All Root-Level Branches
Add appropriate `tags` arrays to 8 branches based on their domain:
- investmentBanking: investment-banking, M&A, capital-markets, financial-advisory
- VCbranch: venture-capital, startups, fund-management, cap-table
- PEbranch: private-equity, leveraged-buyout, portfolio-management, exit-strategy
- QuantBranch: quantitative-finance, algorithmic-trading, mathematical-models, data-science
- HedgeFbranche: hedge-funds, absolute-return, leveraged-strategies, macro-trading
- RiskMbranche: risk-management, compliance, market-risk, credit-risk
- FPnAbranch: financial-planning, analysis, budgeting, forecasting
- pubfinBranch: public-finance, fiscal-policy, sovereign-debt, treasury

---

## Expected Outcome After Fixes

✅ All 9 branch tiles will:
- Display 2-3 relevant tags in the meta section
- Show the unfold indicator (+/−) when clicked
- Allow full navigation and expansion of child nodes
- Maintain full tree hierarchy visualization

---

## Risk Assessment

**Low Risk:** All changes are additive or structural (no data loss)
- Adding arrays to getChildren() is backward compatible
- Renaming JSON keys doesn't affect existing functionality (just adds recognition)
- Adding tags doesn't break existing rendering logic

**Testing Required:**
- Verify all 9 tiles show tags after update
- Confirm unfold indicators appear on all tiles
- Test expanding/collapsing each branch
- Verify tree navigation still works after changes

---

End of Analysis Report
