#!/usr/bin/env node

/**
 * Honey Pot Pattern Generator for CryptoExplorer
 * 
 * This script creates honey pot patterns for all branches mentioned in cryptoTree.json
 * Each branch gets a core tile with proper naming and structure
 */

const fs = require('fs');
const path = require('path');

// Load the main cryptoTree structure
const cryptoTreePath = path.resolve(__dirname, '../data/cryptoTree.json');
console.log('Loading cryptoTree from:', cryptoTreePath);
const cryptoTree = JSON.parse(fs.readFileSync(cryptoTreePath, 'utf8'));

// Branch name mappings for core tiles
const branchNameMappings = {
  'global-investment-bank': 'Investment Banking',
  'PE': 'Private Equity',
  'VC': 'Venture Capital',
  'Quant': 'Quantitative Finance',
  'PubFin': 'Public Finance'
};

// Honey pot pattern template
const honeyPotTemplate = (branchId, branchName, filePath) => `
{
  "id": "${branchId}-honey-pot",
  "name": "${branchName} Honey Pot",
  "description": "Honey pot pattern for ${branchName} branch - detects and traps unauthorized access attempts",
  "type": "security-pattern",
  "category": "honey-pot",
  "source": "${filePath}",
  "coreTile": {
    "id": "${branchId}-core",
    "name": "${branchName}",
    "description": "Core ${branchName} operations and strategies",
    "type": "core-tile",
    "status": "active",
    "priority": "high",
    "tags": ["${branchId}", "core", "operations"],
    "metadata": {
      "branch": "${branchId}",
      "category": "${branchName}",
      "securityLevel": "enhanced",
      "monitoring": true
    }
  },
  "traps": [
    {
      "id": "${branchId}-fake-endpoint",
      "name": "Fake ${branchName} API Endpoint",
      "description": "Decoy endpoint that logs access attempts",
      "type": "api-trap",
      "trigger": "api-access",
      "response": "fake-data"
    },
    {
      "id": "${branchId}-honeypot-config",
      "name": "${branchName} Configuration Honey Pot",
      "description": "Fake configuration files with monitoring",
      "type": "file-trap",
      "trigger": "file-access",
      "response": "log-attempt"
    },
    {
      "id": "${branchId}-data-trap",
      "name": "${branchName} Data Access Trap",
      "description": "Monitors unauthorized data access attempts",
      "type": "data-trap",
      "trigger": "data-query",
      "response": "alert-security"
    }
  ],
  "monitoring": {
    "enabled": true,
    "logLevel": "high",
    "alerts": ["unauthorized-access", "data-exfiltration", "brute-force"],
    "retention": "90-days"
  },
  "generated": "${new Date().toISOString()}",
  "version": "1.0.0"
}
`;

// Generate honey pot patterns for all unique branches
function generateHoneyPotPatterns() {
  const uniqueBranches = new Map();
  
  // Extract unique branches from cryptoTree
  cryptoTree.fields.forEach(field => {
    const branchId = field.id;
    const filePath = field.file;
    
    if (!uniqueBranches.has(branchId)) {
      const branchName = branchNameMappings[branchId] || branchId.toUpperCase();
      uniqueBranches.set(branchId, {
        id: branchId,
        name: branchName,
        file: filePath
      });
    }
  });
  
  // Create honey pot patterns directory
  const honeyPotDir = path.join(__dirname, '../data/honey-pots');
  if (!fs.existsSync(honeyPotDir)) {
    fs.mkdirSync(honeyPotDir, { recursive: true });
  }
  
  // Generate honey pot pattern for each branch
  const generatedPatterns = [];
  
  uniqueBranches.forEach((branch, branchId) => {
    const honeyPotData = JSON.parse(honeyPotTemplate(branchId, branch.name, branch.file));
    const fileName = `${branchId}-honey-pot.json`;
    const filePath = path.join(honeyPotDir, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(honeyPotData, null, 2), 'utf8');
    generatedPatterns.push({
      branch: branchId,
      name: branch.name,
      file: fileName,
      path: filePath
    });
    
    console.log(`✅ Generated honey pot for ${branch.name}: ${fileName}`);
  });
  
  // Generate index file
  const indexData = {
    version: "1.0.0",
    description: "Honey pot patterns for CryptoExplorer branches",
    generated: new Date().toISOString(),
    patterns: generatedPatterns
  };
  
  const indexPath = path.join(honeyPotDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf8');
  
  console.log(`📝 Generated honey pot index: index.json`);
  console.log(`🎯 Total honey pots generated: ${generatedPatterns.length}`);
  
  return generatedPatterns;
}

// Core tile generator for each branch
function generateCoreTiles() {
  const coreTilesDir = path.join(__dirname, '../data/core-tiles');
  if (!fs.existsSync(coreTilesDir)) {
    fs.mkdirSync(coreTilesDir, { recursive: true });
  }
  
  const uniqueBranches = new Map();
  
  // Extract unique branches from cryptoTree
  cryptoTree.fields.forEach(field => {
    const branchId = field.id;
    const filePath = field.file;
    
    if (!uniqueBranches.has(branchId)) {
      const branchName = branchNameMappings[branchId] || branchId.toUpperCase();
      uniqueBranches.set(branchId, {
        id: branchId,
        name: branchName,
        file: filePath
      });
    }
  });
  
  const coreTiles = [];
  
  uniqueBranches.forEach((branch, branchId) => {
    const coreTile = {
      id: `${branchId}-core`,
      name: branch.name,
      description: `Core ${branch.name} operations and strategic oversight`,
      type: "core-tile",
      category: "operations",
      branchId: branchId,
      sourceFile: branch.file,
      status: "active",
      priority: "high",
      tags: [branchId, "core", "strategic", "operations"],
      metadata: {
        branch: branchId,
        category: branch.name,
        securityLevel: "enhanced",
        monitoring: true,
        lastUpdated: new Date().toISOString()
      },
      functions: generateCoreTileFunctions(branchId, branch.name),
      kpis: generateCoreTileKPIs(branchId, branch.name),
      riskFactors: generateRiskFactors(branchId, branch.name)
    };
    
    const fileName = `${branchId}-core-tile.json`;
    const filePath = path.join(coreTilesDir, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(coreTile, null, 2), 'utf8');
    coreTiles.push({
      branch: branchId,
      name: branch.name,
      file: fileName,
      path: filePath
    });
    
    console.log(`🏗️ Generated core tile for ${branch.name}: ${fileName}`);
  });
  
  // Generate core tiles index
  const coreTilesIndex = {
    version: "1.0.0",
    description: "Core tiles for CryptoExplorer branches",
    generated: new Date().toISOString(),
    coreTiles: coreTiles
  };
  
  const coreTilesIndexPath = path.join(coreTilesDir, 'index.json');
  fs.writeFileSync(coreTilesIndexPath, JSON.stringify(coreTilesIndex, null, 2), 'utf8');
  
  console.log(`📝 Generated core tiles index: index.json`);
  console.log(`🎯 Total core tiles generated: ${coreTiles.length}`);
  
  return coreTiles;
}

// Generate core tile functions based on branch type
function generateCoreTileFunctions(branchId, branchName) {
  const functionTemplates = {
    'global-investment-bank': [
      "M&A Advisory Services",
      "Capital Market Operations",
      "Risk Management",
      "Client Relationship Management",
      "Compliance & Regulatory Oversight"
    ],
    'PE': [
      "Deal Sourcing & Due Diligence",
      "Portfolio Management",
      "Value Creation Strategies",
      "Exit Planning & Execution",
      "Fund Operations & Reporting"
    ],
    'VC': [
      "Deal Flow Generation",
      "Investment Analysis",
      "Portfolio Support",
      "Limited Partner Relations",
      "Fund Management"
    ],
    'Quant': [
      "Algorithm Development",
      "Risk Modeling",
      "Trading Operations",
      "Data Analysis",
      "System Infrastructure"
    ],
    'PubFin': [
      "Government Advisory",
      "Public Sector Financing",
      "Policy Analysis",
      "Infrastructure Projects",
      "Regulatory Compliance"
    ]
  };
  
  return (functionTemplates[branchId] || [
    "Strategic Planning",
    "Operations Management",
    "Risk Assessment",
    "Performance Monitoring",
    "Stakeholder Relations"
  ]).map(func => ({
    name: func,
    status: "active",
    priority: "medium"
  }));
}

// Generate KPIs for core tiles
function generateCoreTileKPIs(branchId, branchName) {
  const kpiTemplates = {
    'global-investment-bank': [
      "Deal Flow Volume",
      "Revenue per Deal",
      "Client Satisfaction",
      "Market Share",
      "Risk-Adjusted Returns"
    ],
    'PE': [
      "IRR Performance",
      "MOIC Multiple",
      "Portfolio Company Growth",
      "Fund Deployment Rate",
      "Exit Realization"
    ],
    'VC': [
      "Portfolio Company Valuation",
      "Follow-on Investment Ratio",
      "Success Rate",
      "Fund IRR",
      "Limited Partner Returns"
    ],
    'Quant': [
      "Sharpe Ratio",
      "Win Rate",
      "Trading Volume",
      "Algorithm Performance",
      "Risk Metrics"
    ],
    'PubFin': [
      "Project Completion Rate",
      "Budget Adherence",
      "Policy Impact",
      "Stakeholder Satisfaction",
      "Regulatory Compliance"
    ]
  };
  
  return (kpiTemplates[branchId] || [
    "Performance Metrics",
    "Efficiency Indicators",
    "Risk Measures",
    "Quality Standards",
    "Stakeholder Metrics"
  ]).map(kpi => ({
    name: kpi,
    target: "industry-benchmark",
    current: "baseline",
    trend: "improving"
  }));
}

// Generate risk factors for core tiles
function generateRiskFactors(branchId, branchName) {
  const riskTemplates = {
    'global-investment-bank': [
      "Market Volatility",
      "Regulatory Changes",
      "Credit Risk",
      "Operational Risk",
      "Reputational Risk"
    ],
    'PE': [
      "Market Cycle Risk",
      "Leverage Risk",
      "Liquidity Risk",
      "Concentration Risk",
      "Exit Market Risk"
    ],
    'VC': [
      "Technology Risk",
      "Market Adoption Risk",
      "Funding Risk",
      "Team Risk",
      "Competition Risk"
    ],
    'Quant': [
      "Model Risk",
      "System Risk",
      "Market Risk",
      "Liquidity Risk",
      "Technology Risk"
    ],
    'PubFin': [
      "Political Risk",
      "Regulatory Risk",
      "Funding Risk",
      "Implementation Risk",
      "Stakeholder Risk"
    ]
  };
  
  return (riskTemplates[branchId] || [
    "Market Risk",
    "Operational Risk",
    "Strategic Risk",
    "Compliance Risk",
    "External Risk"
  ]).map(risk => ({
    name: risk,
    level: "medium",
    mitigation: "active-monitoring"
  }));
}

// Main execution
function main() {
  console.log('🍯 Generating Honey Pot Patterns for CryptoExplorer...');
  console.log('=' .repeat(60));
  
  try {
    // Generate honey pot patterns
    const honeyPots = generateHoneyPotPatterns();
    console.log('');
    
    // Generate core tiles
    const coreTiles = generateCoreTiles();
    console.log('');
    
    // Generate summary report
    const summary = {
      generated: new Date().toISOString(),
      honeyPots: {
        count: honeyPots.length,
        items: honeyPots
      },
      coreTiles: {
        count: coreTiles.length,
        items: coreTiles
      },
      source: cryptoTreePath,
      totalBranches: new Set(cryptoTree.fields.map(f => f.id)).size
    };
    
    const summaryPath = path.join(__dirname, '../data/honey-pot-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    
    console.log('📊 Summary report generated: honey-pot-summary.json');
    console.log('');
    console.log('🎉 Honey pot pattern generation completed successfully!');
    console.log(`📈 Processed ${summary.totalBranches} unique branches`);
    console.log(`🛡️ Generated ${honeyPots.length} honey pot patterns`);
    console.log(`🏗️ Generated ${coreTiles.length} core tiles`);
    
  } catch (error) {
    console.error('❌ Error generating honey pot patterns:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  generateHoneyPotPatterns,
  generateCoreTiles,
  main
};
