// FIXED: Remove static tree data to prevent conflicts with API
// The tree data is now loaded exclusively from CryptoTree.json
// This prevents static data from overriding dynamic updates

// DISABLED: Static tree data removed to centralize on CryptoTree.json
// All tree data now comes from the centralized JSON source

// Helper function to flatten the tree structure with support for 6 levels using unified walk
const flattenTree = (nodes, path = []) => {
  const result = [];
  const walkTree = (nodes, callback, path = []) => {
    nodes.forEach((node, index) => {
      const currentPath = [...path, { id: node.id, name: node.name }];
      callback(node, currentPath, index);
      const children = [
        ...(node.categories || []),
        ...(node.subcategories || []),
        ...(node.nodes || []),
        ...(node.subnodes || []),
        ...(node.leafnodes || [])
      ];
      if (children.length > 0) {
        walkTree(children, callback, currentPath);
      }
    });
  };
  
  walkTree(nodes, (node, path) => {
    result.push({
      ...node,
      path: path.slice(0, -1),
      children: [
        ...(node.categories || []),
        ...(node.subcategories || []),
        ...(node.nodes || []),
        ...(node.subnodes || []),
        ...(node.leafnodes || [])
      ]
    });
  });
  
  return result;
};

// Export to window for browser compatibility with error handling
try {
  if (typeof window !== 'undefined') {
    // Only export the helper function, not static data
    window.flattenTree = flattenTree;
    console.log('cryptoTree helper functions registered successfully');
  }
} catch (error) {
  console.error('Failed to register cryptoTree helpers:', error);
}