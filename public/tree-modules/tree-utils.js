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
          const nodeName = node && node.name ? node.name : '';
          const currentHierarchy = [...path, { id: node.id, name: nodeName }];
          const currentFullPath = currentHierarchy.map(p => p.name);
          const fullPathString = currentFullPath.join(' / ');
          const nodeWithPaths = {
            ...node,
            hierarchy: currentHierarchy,
            path: currentHierarchy.slice(0, -1),
            fullPath: currentFullPath,
            fullPathIds: currentHierarchy.map(p => p.id),
            pathString: fullPathString,
          };
          const children = getChildren(node);
          const childResults = children.length > 0 ? flatten(children, currentHierarchy) : [];
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
          const fp = n.fullPath;
          const nodePathStr = Array.isArray(fp) ? fp.join(' / ') : (typeof fp === 'string' ? fp : String(fp || ''));
          if (!nodePathStr) return false;
          return pathParts.every(part => nodePathStr.toLowerCase().includes(part.toLowerCase()));
        });
      }
      return flatNodes.filter(n => {
        const fp = n.fullPath;
        const nodePathStr = Array.isArray(fp) ? fp.join(' / ') : (typeof fp === 'string' ? fp : '');
        const pathString = n.pathString || nodePathStr || n.name;
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
