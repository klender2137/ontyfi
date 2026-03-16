// merge-branches-with-descriptions.js
// Merges all branch JSON files with their corresponding markdown descriptions
const fs = require('fs');
const path = require('path');

const DATA_DIR = __dirname;
const BRANCHES_DIR = path.join(DATA_DIR, 'branches');
const DESCRIPTIONS_DIR = path.join(DATA_DIR, 'descriptions');
const OUTPUT_FILE = path.join(DATA_DIR, 'cryptoTree.merged.json');

// Helper function to read markdown description
function readDescription(branchId, category, subcategory, node, subnode, leafnode) {
    const pathParts = [branchId];
    
    if (category) pathParts.push(category);
    if (subcategory) pathParts.push(subcategory);
    if (node) pathParts.push(node);
    if (subnode) pathParts.push(subnode);
    if (leafnode) pathParts.push(leafnode);
    
    const filename = pathParts.join('_') + '.md';
    const filepath = path.join(DESCRIPTIONS_DIR, filename);
    
    if (fs.existsSync(filepath)) {
        const content = fs.readFileSync(filepath, 'utf8');
        return content;
    }
    
    return null;
}

// Helper function to recursively merge descriptions
function mergeDescriptions(item, branchId, pathParts = []) {
    const merged = { ...item };
    
    if (item.id) {
        const descriptionPath = [...pathParts, item.id];
        const description = readDescription(branchId, ...descriptionPath.slice(1));
        if (description) {
            merged.description = description;
        }
    }
    
    // Recursively process children
    ['categories', 'subcategories', 'nodes', 'subnodes', 'leafnodes'].forEach(childType => {
        if (merged[childType] && Array.isArray(merged[childType])) {
            merged[childType] = merged[childType].map(child => 
                mergeDescriptions(child, branchId, [...pathParts, item.id])
            );
        }
    });
    
    return merged;
}

// Main merge function
function mergeAllBranches() {
    console.log('Starting branch merge process...');
    
    // Read trunk structure
    const trunkPath = path.join(DATA_DIR, 'cryptoTree.json');
    const trunk = JSON.parse(fs.readFileSync(trunkPath, 'utf8'));
    
    const mergedFields = [];
    
    // Process each branch
    for (const field of trunk.fields) {
        const branchPath = path.join(DATA_DIR, field.file);
        
        if (fs.existsSync(branchPath)) {
            console.log(`Processing branch: ${field.id}`);
            const branchData = JSON.parse(fs.readFileSync(branchPath, 'utf8'));
            
            // Merge descriptions into the branch
            const mergedBranch = mergeDescriptions(branchData, field.id);
            
            // Add to merged fields
            mergedFields.push({
                ...mergedBranch,
                _source: {
                    branchId: field.id,
                    file: field.file
                }
            });
            
            console.log(`✅ Merged branch: ${field.id}`);
        } else {
            console.warn(`⚠️ Branch file not found: ${branchPath}`);
        }
    }
    
    // Create merged tree structure
    const mergedTree = {
        version: "2.0-merged",
        type: "cryptoTree-merged",
        generated: new Date().toISOString(),
        fields: mergedFields
    };
    
    // Write merged file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(mergedTree, null, 2));
    
    console.log(`✅ Merged tree created: ${OUTPUT_FILE}`);
    console.log(`📊 Total branches merged: ${mergedFields.length}`);
    
    // Statistics
    let totalCategories = 0;
    let totalSubcategories = 0;
    let totalNodes = 0;
    let totalSubnodes = 0;
    let totalLeafnodes = 0;
    let totalDescriptions = 0;
    
    function countItems(item) {
        let counts = { categories: 0, subcategories: 0, nodes: 0, subnodes: 0, leafnodes: 0, descriptions: 0 };
        
        if (item.description) counts.descriptions = 1;
        
        ['categories', 'subcategories', 'nodes', 'subnodes', 'leafnodes'].forEach(type => {
            if (item[type]) {
                counts[type] = item[type].length;
                item[type].forEach(child => {
                    const childCounts = countItems(child);
                    Object.keys(counts).forEach(key => {
                        counts[key] += childCounts[key];
                    });
                });
            }
        });
        
        return counts;
    }
    
    mergedFields.forEach(field => {
        const counts = countItems(field);
        totalCategories += counts.categories;
        totalSubcategories += counts.subcategories;
        totalNodes += counts.nodes;
        totalSubnodes += counts.subnodes;
        totalLeafnodes += counts.leafnodes;
        totalDescriptions += counts.descriptions;
    });
    
    console.log('\n📈 Merged Tree Statistics:');
    console.log(`   Categories: ${totalCategories}`);
    console.log(`   Subcategories: ${totalSubcategories}`);
    console.log(`   Nodes: ${totalNodes}`);
    console.log(`   Subnodes: ${totalSubnodes}`);
    console.log(`   Leafnodes: ${totalLeafnodes}`);
    console.log(`   Descriptions loaded: ${totalDescriptions}`);
    
    return mergedTree;
}

// Run the merge
if (require.main === module) {
    try {
        mergeAllBranches();
    } catch (error) {
        console.error('❌ Merge failed:', error);
        process.exit(1);
    }
}

module.exports = { mergeAllBranches, mergeDescriptions };
