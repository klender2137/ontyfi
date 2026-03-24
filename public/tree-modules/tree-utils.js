// tree-utils.js - Utility functions and helpers
if (typeof window !== 'undefined') {
  window.TreeUtils = {
    getChildren: (node) => [
      ...(node.categories || []),
      ...(node.subcategories || []),
      ...(node.nodes || []),
      ...(node.subnodes || []),
      ...(node.leafnodes || []),
      ...(node.children || []),
      ...(node.institutions || []),  // Added for branches like investmentBanking, VCbranch, etc.
      ...(node.tiles || [])           // Added for RiskMbranche and similar structures
    ],

    flattenTree: (tree, getChildren) => {
      if (!tree || !tree.fields) return [];
      const flatten = (nodes, path = []) => {
        return nodes.reduce((acc, node) => {
          const currentPath = [...path, node.name];
          const fullPathString = currentPath.join(' / ');
          const nodeWithPaths = { ...node, path: currentPath, fullPath: currentPath, pathString: fullPathString };
          const children = getChildren(node);
          const childResults = children.length > 0 ? flatten(children, currentPath) : [];
          return [...acc, nodeWithPaths, ...childResults];
        }, []);
      };
      return flatten(tree.fields);
    },

    filterResults: (flatNodes, search) => {
      const q = search.trim().toLowerCase();
      if (!q) return [];
      if (q.includes(' / ')) {
        const pathParts = q.split(' / ').map(p => p.trim());
        return flatNodes.filter(n => {
          if (!n.fullPath) return false;
          // fullPath is now consistently a string
          const nodePathStr = n.fullPath.toLowerCase();
          return pathParts.every(part => nodePathStr.includes(part.toLowerCase()));
        });
      }
      return flatNodes.filter(n => {
        const pathString = n.fullPath || n.name;
        return n.name.toLowerCase().includes(q) || n.description?.toLowerCase().includes(q) || pathString.toLowerCase().includes(q) || (n.tags || []).some(t => t.toLowerCase().includes(q));
      });
    },

    createThemeManager: (nodeThemes, setNodeThemes) => ({
      getNodeTheme: (nodeId) => nodeThemes[nodeId] || 'default',
      setNodeTheme: (nodeId, theme) => {
        setNodeThemes(prev => {
          const newThemes = { ...prev, [nodeId]: theme };
          try { localStorage.setItem('cryptoExplorer.nodeThemes', JSON.stringify(newThemes)); } catch {}
          return newThemes;
        });
      },
      copyNodeLink: (nodeId) => {
        const link = `${window.location.origin}${window.location.pathname}#tree-${nodeId}`;
        navigator.clipboard.writeText(link).catch(() => console.error('Failed to copy link'));
      }
    })
  };

  // Alias for compatibility
  window.flattenTree = window.TreeUtils.flattenTree;
}
