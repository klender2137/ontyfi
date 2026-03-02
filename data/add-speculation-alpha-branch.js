const fs = require('fs');
const path = require('path');

const DATA_DIR = __dirname;
const BRANCHES_DIR = path.join(DATA_DIR, 'branches');
const DESCRIPTIONS_DIR = path.join(DATA_DIR, 'descriptions');
const CRYPTO_TREE_PATH = path.join(DATA_DIR, 'cryptoTree.json');
const DESCRIPTION_INDEX_PATH = path.join(DATA_DIR, 'descriptionIndex.json');

// Load the new branch structure
const speculationAlphaTree = {
  // Field Level
  "speculation-alpha": {
    "file": "descriptions/speculation-alpha.md",
    "name": "Speculation & Alpha Exploration",
    "path": "speculation-alpha"
  },

  // BRANCH 1: Systematic Airdrop & Point Farming
  "airdrop-farming": {
    "file": "descriptions/speculation-alpha_airdrop-farming.md",
    "name": "Airdrop Farming",
    "path": "speculation-alpha > airdrop-farming"
  },
  "protocol-interaction": {
    "file": "descriptions/speculation-alpha_protocol-interaction.md",
    "name": "Protocol Interaction",
    "path": "speculation-alpha > airdrop-farming > protocol-interaction"
  },
  "cross-chain-volume-mining": {
    "file": "descriptions/speculation-alpha_cross-chain-volume-mining.md",
    "name": "Cross-Chain Volume Mining",
    "path": "speculation-alpha > airdrop-farming > protocol-interaction > cross-chain-volume-mining"
  },
  "mainnet-bridge-volume": {
    "file": "descriptions/speculation-alpha_mainnet-bridge-volume.md",
    "name": "Mainnet Bridge Volume (Official & Third-Party)",
    "path": "speculation-alpha > airdrop-farming > protocol-interaction > cross-chain-volume-mining > mainnet-bridge-volume"
  },
  "uam-retention": {
    "file": "descriptions/speculation-alpha_uam-retention.md",
    "name": "Unique Active Months (UAM) Retention",
    "path": "speculation-alpha > airdrop-farming > protocol-interaction > cross-chain-volume-mining > mainnet-bridge-volume > uam-retention"
  },
  "tiered-sybil-resistance": {
    "file": "descriptions/speculation-alpha_tiered-sybil-resistance.md",
    "name": "Tiered Sybil-Resistance Verification",
    "path": "speculation-alpha > airdrop-farming > protocol-interaction > cross-chain-volume-mining > mainnet-bridge-volume > uam-retention > tiered-sybil-resistance"
  },
  "ecosystem-reputation": {
    "file": "descriptions/speculation-alpha_ecosystem-reputation.md",
    "name": "Ecosystem Reputation Building",
    "path": "speculation-alpha > airdrop-farming > protocol-interaction > ecosystem-reputation"
  },
  "dev-airdrop-deployment": {
    "file": "descriptions/speculation-alpha_dev-airdrop-deployment.md",
    "name": "Contract Deployment (Developer-Specific Airdrops)",
    "path": "speculation-alpha > airdrop-farming > protocol-interaction > ecosystem-reputation > dev-airdrop-deployment"
  },
  "governance-engagement": {
    "file": "descriptions/speculation-alpha_governance-engagement.md",
    "name": "Governance Engagement (Snapshot/On-Chain Voting)",
    "path": "speculation-alpha > airdrop-farming > protocol-interaction > ecosystem-reputation > dev-airdrop-deployment > governance-engagement"
  },
  "onchain-identity-attestation": {
    "file": "descriptions/speculation-alpha_onchain-identity-attestation.md",
    "name": "Social Proof & On-Chain Identity Attestation",
    "path": "speculation-alpha > airdrop-farming > protocol-interaction > ecosystem-reputation > dev-airdrop-deployment > governance-engagement > onchain-identity-attestation"
  },

  // BRANCH 2: High-Frequency Memecoin "Trenching"
  "memecoin-hustling": {
    "file": "descriptions/speculation-alpha_memecoin-hustling.md",
    "name": "Memecoin Hustling",
    "path": "speculation-alpha > memecoin-hustling"
  },
  "execution-sniping": {
    "file": "descriptions/speculation-alpha_execution-sniping.md",
    "name": "Execution & Sniping",
    "path": "speculation-alpha > memecoin-hustling > execution-sniping"
  },
  "launchpad-monitoring": {
    "file": "descriptions/speculation-alpha_launchpad-monitoring.md",
    "name": "Launchpad Monitoring (Pump.fun/Moonshot)",
    "path": "speculation-alpha > memecoin-hustling > execution-sniping > launchpad-monitoring"
  },
  "bonding-curve-entry": {
    "file": "descriptions/speculation-alpha_bonding-curve-entry.md",
    "name": "Bonding Curve Early Entry (First 5 Transactions)",
    "path": "speculation-alpha > memecoin-hustling > execution-sniping > launchpad-monitoring > bonding-curve-entry"
  },
  "custom-rpc-speed": {
    "file": "descriptions/speculation-alpha_custom-rpc-speed.md",
    "name": "Custom RPC Node Execution (Speed-Meta)",
    "path": "speculation-alpha > memecoin-hustling > execution-sniping > launchpad-monitoring > bonding-curve-entry > custom-rpc-speed"
  },
  "liquidity-lock-verification": {
    "file": "descriptions/speculation-alpha_liquidity-lock-verification.md",
    "name": "Anti-Rug Liquidity Lock Verification",
    "path": "speculation-alpha > memecoin-hustling > execution-sniping > launchpad-monitoring > bonding-curve-entry > custom-rpc-speed > liquidity-lock-verification"
  },
  "narrative-sentiment-analysis": {
    "file": "descriptions/speculation-alpha_narrative-sentiment-analysis.md",
    "name": "Narrative & Sentiment Analysis",
    "path": "speculation-alpha > memecoin-hustling > execution-sniping > narrative-sentiment-analysis"
  },
  "viral-social-tracking": {
    "file": "descriptions/speculation-alpha_viral-social-tracking.md",
    "name": "Viral TikTok/X Sentiment Tracking",
    "path": "speculation-alpha > memecoin-hustling > execution-sniping > narrative-sentiment-analysis > viral-social-tracking"
  },
  "dev-wallet-bundle": {
    "file": "descriptions/speculation-alpha_dev-wallet-bundle.md",
    "name": "Developer Wallet Bundle Detection",
    "path": "speculation-alpha > memecoin-hustling > execution-sniping > narrative-sentiment-analysis > viral-social-tracking > dev-wallet-bundle"
  },
  "ai-agent-heatmaps": {
    "file": "descriptions/speculation-alpha_ai-agent-heatmaps.md",
    "name": "AI-Agent Mention Heatmaps",
    "path": "speculation-alpha > memecoin-hustling > execution-sniping > narrative-sentiment-analysis > viral-social-tracking > dev-wallet-bundle > ai-agent-heatmaps"
  },

  // BRANCH 3: Prediction Market Inefficiency Capture
  "prediction-markets": {
    "file": "descriptions/speculation-alpha_prediction-markets.md",
    "name": "Prediction Markets",
    "path": "speculation-alpha > prediction-markets"
  },
  "delta-neutral-arbitrage": {
    "file": "descriptions/speculation-alpha_delta-neutral-arbitrage.md",
    "name": "Delta-Neutral Arbitrage",
    "path": "speculation-alpha > prediction-markets > delta-neutral-arbitrage"
  },
  "cross-platform-hedging": {
    "file": "descriptions/speculation-alpha_cross-platform-hedging.md",
    "name": "Cross-Platform Odds Hedging",
    "path": "speculation-alpha > prediction-markets > delta-neutral-arbitrage > cross-platform-hedging"
  },
  "polymarket-kalshi-spread": {
    "file": "descriptions/speculation-alpha_polymarket-kalshi-spread.md",
    "name": "Polymarket vs. Kalshi Spread Capture",
    "path": "speculation-alpha > prediction-markets > delta-neutral-arbitrage > cross-platform-hedging > polymarket-kalshi-spread"
  },
  "yes-no-volume-mining": {
    "file": "descriptions/speculation-alpha_yes-no-volume-mining.md",
    "name": "Yes/No Delta-Neutral Volume Mining",
    "path": "speculation-alpha > prediction-markets > delta-neutral-arbitrage > cross-platform-hedging > polymarket-kalshi-spread > yes-no-volume-mining"
  },
  "event-rule-arbitrage": {
    "file": "descriptions/speculation-alpha_event-rule-arbitrage.md",
    "name": "Event Rule Nuance Arbitrage",
    "path": "speculation-alpha > prediction-markets > delta-neutral-arbitrage > cross-platform-hedging > polymarket-kalshi-spread > yes-no-volume-mining > event-rule-arbitrage"
  },
  "market-liquidity-provisioning": {
    "file": "descriptions/speculation-alpha_market-liquidity-provisioning.md",
    "name": "Market Liquidity Provisioning",
    "path": "speculation-alpha > prediction-markets > delta-neutral-arbitrage > market-liquidity-provisioning"
  },
  "information-arbitrage": {
    "file": "descriptions/speculation-alpha_information-arbitrage.md",
    "name": "Information Arbitrage (News-Frontrunning)",
    "path": "speculation-alpha > prediction-markets > delta-neutral-arbitrage > market-liquidity-provisioning > information-arbitrage"
  },
  "niche-market-amm-mining": {
    "file": "descriptions/speculation-alpha_niche-market-amm-mining.md",
    "name": "AMM Liquidity Mining for Niche Markets",
    "path": "speculation-alpha > prediction-markets > delta-neutral-arbitrage > market-liquidity-provisioning > information-arbitrage > niche-market-amm-mining"
  },
  "jurisdictional-legal-arb": {
    "file": "descriptions/speculation-alpha_jurisdictional-legal-arb.md",
    "name": "Regional/Jurisdictional Legal Arbitrage",
    "path": "speculation-alpha > prediction-markets > delta-neutral-arbitrage > market-liquidity-provisioning > information-arbitrage > niche-market-amm-mining > jurisdictional-legal-arb"
  },

  // BRANCH 4: Early-Stage Allocation Flipping
  "token-launchpads": {
    "file": "descriptions/speculation-alpha_token-launchpads.md",
    "name": "Token Launchpads",
    "path": "speculation-alpha > token-launchpads"
  },
  "strategic-ido-participation": {
    "file": "descriptions/speculation-alpha_strategic-ido-participation.md",
    "name": "Strategic IDO/IGO Participation",
    "path": "speculation-alpha > token-launchpads > strategic-ido-participation"
  },
  "capital-allocation-strategy": {
    "file": "descriptions/speculation-alpha_capital-allocation-strategy.md",
    "name": "Capital Allocation Strategy",
    "path": "speculation-alpha > token-launchpads > strategic-ido-participation > capital-allocation-strategy"
  },
  "tier-staking-optimization": {
    "file": "descriptions/speculation-alpha_tier-staking-optimization.md",
    "name": "Tier-Level Staking Optimization",
    "path": "speculation-alpha > token-launchpads > strategic-ido-participation > capital-allocation-strategy > tier-staking-optimization"
  },
  "whitelist-spot-flipping": {
    "file": "descriptions/speculation-alpha_whitelist-spot-flipping.md",
    "name": "Whitelist Spot Flipping (OTC Secondary Markets)",
    "path": "speculation-alpha > token-launchpads > strategic-ido-participation > capital-allocation-strategy > tier-staking-optimization > whitelist-spot-flipping"
  },
  "refund-policy-exploitation": {
    "file": "descriptions/speculation-alpha_refund-policy-exploitation.md",
    "name": "Refund Policy Safety-Net Exploitation",
    "path": "speculation-alpha > token-launchpads > strategic-ido-participation > capital-allocation-strategy > tier-staking-optimization > whitelist-spot-flipping > refund-policy-exploitation"
  },
  "access-sybil-management": {
    "file": "descriptions/speculation-alpha_access-sybil-management.md",
    "name": "Access Gating & Sybil Management",
    "path": "speculation-alpha > token-launchpads > strategic-ido-participation > access-sybil-management"
  },
  "governance-gating-access": {
    "file": "descriptions/speculation-alpha_governance-gating-access.md",
    "name": "Governance Gating Access Management",
    "path": "speculation-alpha > token-launchpads > strategic-ido-participation > access-sybil-management > governance-gating-access"
  },
  "multi-account-pooling": {
    "file": "descriptions/speculation-alpha_multi-account-pooling.md",
    "name": "Multi-Account Allocation Pooling",
    "path": "speculation-alpha > token-launchpads > strategic-ido-participation > access-sybil-management > governance-gating-access > multi-account-pooling"
  },
  "venture-daos-retail-access": {
    "file": "descriptions/speculation-alpha_venture-daos-retail-access.md",
    "name": "Venture-DAOs for Retail Access",
    "path": "speculation-alpha > token-launchpads > strategic-ido-participation > access-sybil-management > governance-gating-access > multi-account-pooling > venture-daos-retail-access"
  },

  // BRANCH 5: On-Chain Intelligence & Whale Forensics
  "intelligence-forensics": {
    "file": "descriptions/speculation-alpha_intelligence-forensics.md",
    "name": "Intelligence & Forensics",
    "path": "speculation-alpha > intelligence-forensics"
  },
  "smart-money-tracking": {
    "file": "descriptions/speculation-alpha_smart-money-tracking.md",
    "name": "Smart Money Flow Tracking",
    "path": "speculation-alpha > intelligence-forensics > smart-money-tracking"
  },
  "wallet-monitoring-alerting": {
    "file": "descriptions/speculation-alpha_wallet-monitoring-alerting.md",
    "name": "Wallet Monitoring & Alerting",
    "path": "speculation-alpha > intelligence-forensics > smart-money-tracking > wallet-monitoring-alerting"
  },
  "whale-inflow-outflow-alerts": {
    "file": "descriptions/speculation-alpha_whale-inflow-outflow-alerts.md",
    "name": "Whale Wallet Inflow/Outflow Alerts",
    "path": "speculation-alpha > intelligence-forensics > smart-money-tracking > wallet-monitoring-alerting > whale-inflow-outflow-alerts"
  },
  "vc-fund-distribution-tracking": {
    "file": "descriptions/speculation-alpha_vc-fund-distribution-tracking.md",
    "name": "VC Fund Distribution Tracking",
    "path": "speculation-alpha > intelligence-forensics > smart-money-tracking > wallet-monitoring-alerting > whale-inflow-outflow-alerts > vc-fund-distribution-tracking"
  },
  "smart-money-copy-trading": {
    "file": "descriptions/speculation-alpha_smart-money-copy-trading.md",
    "name": "First-In Smart Money Copy-Trading",
    "path": "speculation-alpha > intelligence-forensics > smart-money-tracking > wallet-monitoring-alerting > whale-inflow-outflow-alerts > vc-fund-distribution-tracking > smart-money-copy-trading"
  },
  "investigative-forensics": {
    "file": "descriptions/speculation-alpha_investigative-forensics.md",
    "name": "Investigative On-Chain Forensics",
    "path": "speculation-alpha > intelligence-forensics > smart-money-tracking > investigative-forensics"
  },
  "insider-mint-detection": {
    "file": "descriptions/speculation-alpha_insider-mint-detection.md",
    "name": "Insider Mint & Dev-Dump Detection",
    "path": "speculation-alpha > intelligence-forensics > smart-money-tracking > investigative-forensics > insider-mint-detection"
  },
  "exchange-inflow-frontrunning": {
    "file": "descriptions/speculation-alpha_exchange-inflow-frontrunning.md",
    "name": "Exchange Inflow Frontrunning",
    "path": "speculation-alpha > intelligence-forensics > smart-money-tracking > investigative-forensics > insider-mint-detection > exchange-inflow-frontrunning"
  },
  "stolen-asset-blacklist": {
    "file": "descriptions/speculation-alpha_stolen-asset-blacklist.md",
    "name": "Stolen Asset Blacklist Monitoring",
    "path": "speculation-alpha > intelligence-forensics > smart-money-tracking > investigative-forensics > insider-mint-detection > exchange-inflow-frontrunning > stolen-asset-blacklist"
  },

  // BRANCH 6: Algorithmic Yield & Volatility Farming
  "yield-delta-exploration": {
    "file": "descriptions/speculation-alpha_yield-delta-exploration.md",
    "name": "Yield & Delta Exploration",
    "path": "speculation-alpha > yield-delta-exploration"
  },
  "synthetic-asset-yields": {
    "file": "descriptions/speculation-alpha_synthetic-asset-yields.md",
    "name": "Synthetic Asset Yields",
    "path": "speculation-alpha > yield-delta-exploration > synthetic-asset-yields"
  },
  "delta-neutral-perp-arbitrage": {
    "file": "descriptions/speculation-alpha_delta-neutral-perp-arbitrage.md",
    "name": "Delta-Neutral Perp Funding Arbitrage",
    "path": "speculation-alpha > yield-delta-exploration > synthetic-asset-yields > delta-neutral-perp-arbitrage"
  },
  "long-spot-short-perp-harvesting": {
    "file": "descriptions/speculation-alpha_long-spot-short-perp-harvesting.md",
    "name": "Long-Spot/Short-Perp Funding Harvesting",
    "path": "speculation-alpha > yield-delta-exploration > synthetic-asset-yields > delta-neutral-perp-arbitrage > long-spot-short-perp-harvesting"
  },
  "cross-dex-funding-disparity": {
    "file": "descriptions/speculation-alpha_cross-dex-funding-disparity.md",
    "name": "Cross-DEX Funding Rate Disparity",
    "path": "speculation-alpha > yield-delta-exploration > synthetic-asset-yields > delta-neutral-perp-arbitrage > long-spot-short-perp-harvesting > cross-dex-funding-disparity"
  },
  "lst-yield-loops": {
    "file": "descriptions/speculation-alpha_lst-yield-loops.md",
    "name": "Liquid Staking Token (LST) Yield Loops",
    "path": "speculation-alpha > yield-delta-exploration > synthetic-asset-yields > delta-neutral-perp-arbitrage > long-spot-short-perp-harvesting > cross-dex-funding-disparity > lst-yield-loops"
  },
  "volatility-market-capture": {
    "file": "descriptions/speculation-alpha_volatility-market-capture.md",
    "name": "Volatility Market Capture",
    "path": "speculation-alpha > yield-delta-exploration > synthetic-asset-yields > volatility-market-capture"
  },
  "il-hedging-strategies": {
    "file": "descriptions/speculation-alpha_il-hedging-strategies.md",
    "name": "Impermanent Loss Hedging Strategies",
    "path": "speculation-alpha > yield-delta-exploration > synthetic-asset-yields > volatility-market-capture > il-hedging-strategies"
  },
  "mev-aware-liquidity": {
    "file": "descriptions/speculation-alpha_mev-aware-liquidity.md",
    "name": "MEV-Aware Liquidity Provisioning",
    "path": "speculation-alpha > yield-delta-exploration > synthetic-asset-yields > volatility-market-capture > il-hedging-strategies > mev-aware-liquidity"
  },
  "pol-farming": {
    "file": "descriptions/speculation-alpha_pol-farming.md",
    "name": "Protocol-Owned Liquidity (POL) Farming",
    "path": "speculation-alpha > yield-delta-exploration > synthetic-asset-yields > volatility-market-capture > il-hedging-strategies > mev-aware-liquidity > pol-farming"
  }
};

function createDescriptionFile(tileId, name, path) {
  const description = `# ${name}

**ID:** ${tileId}
**Path:** ${path}
**Branch:** Speculation & Alpha Exploration

## Description

${name} - Advanced strategy and technique within the Speculation & Alpha Exploration branch. This node represents a specific approach to generating alpha through sophisticated on-chain and off-chain methodologies.

## Tags

- speculation
- alpha
- exploration
${path.includes('airdrop') ? '- airdrop' : ''}
${path.includes('memecoin') ? '- memecoin' : ''}
${path.includes('prediction') ? '- prediction' : ''}
${path.includes('launchpad') ? '- launchpad' : ''}
${path.includes('intelligence') ? '- intelligence' : ''}
${path.includes('yield') ? '- yield' : ''}
${path.includes('arbitrage') ? '- arbitrage' : ''}
`;

  const filename = `speculation-alpha_${tileId}.md`;
  const filepath = path.join(DESCRIPTIONS_DIR, filename);
  
  fs.writeFileSync(filepath, description, 'utf8');
  console.log(`Created description file: ${filename}`);
  
  return {
    id: tileId,
    name: name,
    path: path,
    descriptionRef: `descriptions/${filename}`
  };
}

function buildHierarchicalStructure() {
  const root = {
    id: "speculation-alpha",
    name: "Speculation & Alpha Exploration",
    description: "Advanced strategies and techniques for generating alpha through systematic speculation, airdrop farming, memecoin trading, prediction markets, token launches, on-chain intelligence, and yield farming.",
    tags: ["speculation", "alpha", "exploration", "airdrop", "memecoin", "prediction", "launchpad", "intelligence", "yield"],
    categories: []
  };

  // Build the hierarchical structure
  const nodeMap = {};
  
  // First pass: create all nodes
  for (const [tileId, tileData] of Object.entries(speculationAlphaTree)) {
    if (tileId === 'speculation-alpha') continue; // Skip root
    
    const pathParts = tileData.path.split(' > ');
    let currentLevel = root.categories;
    let currentPath = '';
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const isLast = i === pathParts.length - 1;
      
      if (isLast) {
        // This is the target node
        const node = {
          id: tileId,
          name: tileData.name,
          descriptionRef: tileData.file.replace('descriptions/', ''),
          tags: generateTags(tileData.path)
        };
        
        if (currentLevel === root.categories && i === 0) {
          // Top-level category
          currentLevel.push({
            id: tileId,
            name: tileData.name,
            description: `${tileData.name} strategies and techniques.`,
            tags: generateTags(tileData.path),
            subcategories: []
          });
        } else {
          // Add to current level
          currentLevel.push(node);
        }
      } else {
        // Navigate/create intermediate nodes
        currentPath = currentPath ? `${currentPath} > ${part}` : part;
        
        let existingNode = currentLevel.find(n => n.name === part);
        if (!existingNode) {
          existingNode = {
            id: part.toLowerCase().replace(/\s+/g, '-'),
            name: part,
            description: `${part} strategies and methodologies.`,
            tags: generateTags(currentPath),
            subcategories: []
          };
          currentLevel.push(existingNode);
        }
        
        currentLevel = existingNode.subcategories || (existingNode.subcategories = []);
      }
    }
  }

  return root;
}

function generateTags(path) {
  const tags = ['speculation', 'alpha'];
  
  if (path.includes('airdrop')) tags.push('airdrop', 'farming');
  if (path.includes('memecoin')) tags.push('memecoin', 'hustling');
  if (path.includes('prediction')) tags.push('prediction', 'markets');
  if (path.includes('launchpad')) tags.push('launchpad', 'ido');
  if (path.includes('intelligence')) tags.push('intelligence', 'forensics');
  if (path.includes('yield')) tags.push('yield', 'farming');
  if (path.includes('arbitrage')) tags.push('arbitrage');
  if (path.includes('volume')) tags.push('volume', 'mining');
  if (path.includes('governance')) tags.push('governance', 'voting');
  if (path.includes('whale')) tags.push('whale', 'tracking');
  
  return tags;
}

function integrateSpeculationAlphaBranch() {
  console.log('Integrating Speculation & Alpha Exploration branch...');
  
  // Ensure directories exist
  if (!fs.existsSync(DESCRIPTIONS_DIR)) {
    fs.mkdirSync(DESCRIPTIONS_DIR, { recursive: true });
  }
  if (!fs.existsSync(BRANCHES_DIR)) {
    fs.mkdirSync(BRANCHES_DIR, { recursive: true });
  }

  // Create all description files
  const descriptionIndex = {};
  for (const [tileId, tileData] of Object.entries(speculationAlphaTree)) {
    const descFile = createDescriptionFile(tileId, tileData.name, tileData.path);
    descriptionIndex[tileId] = descFile;
  }

  // Build hierarchical structure
  const branchStructure = buildHierarchicalStructure();

  // Save branch file
  const branchFile = path.join(BRANCHES_DIR, 'branch_speculation-alpha.json');
  fs.writeFileSync(branchFile, JSON.stringify(branchStructure, null, 2), 'utf8');
  console.log(`Created branch file: branch_speculation-alpha.json`);

  // Update cryptoTree.json trunk
  const trunkData = JSON.parse(fs.readFileSync(CRYPTO_TREE_PATH, 'utf8'));
  
  // Check if branch already exists
  const existingIndex = trunkData.fields.findIndex(f => f.id === 'speculation-alpha');
  const newField = {
    id: 'speculation-alpha',
    name: 'Speculation & Alpha Exploration',
    file: 'branches/branch_speculation-alpha.json',
    descriptionRef: 'descriptions/speculation-alpha_speculation-alpha.md'
  };

  if (existingIndex >= 0) {
    trunkData.fields[existingIndex] = newField;
    console.log('Updated existing speculation-alpha branch in trunk');
  } else {
    trunkData.fields.push(newField);
    console.log('Added new speculation-alpha branch to trunk');
  }

  // Update description index
  const existingDescIndex = JSON.parse(fs.readFileSync(DESCRIPTION_INDEX_PATH, 'utf8'));
  Object.assign(existingDescIndex, descriptionIndex);
  fs.writeFileSync(DESCRIPTION_INDEX_PATH, JSON.stringify(existingDescIndex, null, 2), 'utf8');
  console.log('Updated description index');

  // Save updated trunk
  fs.writeFileSync(CRYPTO_TREE_PATH, JSON.stringify(trunkData, null, 2), 'utf8');
  console.log('Updated cryptoTree.json trunk');

  console.log('\n✅ Speculation & Alpha Exploration branch integrated successfully!');
  console.log(`📁 Created ${Object.keys(speculationAlphaTree).length} description files`);
  console.log('📂 Created branch file: branch_speculation-alpha.json');
  console.log('🔄 Updated cryptoTree.json trunk');
  console.log('📋 Updated description index');
}

// Run the integration
if (require.main === module) {
  integrateSpeculationAlphaBranch();
}

module.exports = {
  integrateSpeculationAlphaBranch,
  speculationAlphaTree
};
