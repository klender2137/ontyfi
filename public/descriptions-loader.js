// Description Loader - Client-side fallback for loading descriptions
// This script provides a backup mechanism if server-side loading fails

window.DescriptionLoader = {
  // Cache for loaded descriptions
  descriptionCache: new Map(),
  
  // Load description from markdown file
  async loadDescription(descriptionRef) {
    if (this.descriptionCache.has(descriptionRef)) {
      return this.descriptionCache.get(descriptionRef);
    }
    
    try {
      const response = await fetch(`/api/description/${encodeURIComponent(descriptionRef)}`);
      if (!response.ok) {
        console.warn(`Failed to load description: ${descriptionRef}`);
        return null;
      }
      
      const content = await response.text();
      const description = this.extractDescription(content);
      
      if (description) {
        this.descriptionCache.set(descriptionRef, description);
        return description;
      }
      
      return null;
    } catch (error) {
      console.error(`Error loading description ${descriptionRef}:`, error);
      return null;
    }
  },
  
  // Extract description from markdown content
  extractDescription(content) {
    // Use the same filtering logic as the article screen
    return this.filterDescriptionContent(content);
  },

  // Filter content to remove metadata and tags section (same as article screen)
  filterDescriptionContent(content) {
    if (!content) return '';

    const lines = content.split('\n');
    const filtered = [];
    let skippingTags = false;
    let skippingDescription = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // drop top‑level title and metadata lines
      if (/^#\s+/.test(line)) continue;
      if (/^\*\*ID:/i.test(line)) continue;
      if (/^\*\*Path:/i.test(line)) continue;
      if (/^\*\*Branch:/i.test(line)) continue;

      // detect and skip Description header
      if (/^##\s+Description\b/i.test(trimmedLine)) {
        skippingDescription = true;
        continue;
      }
      
      // detect tags block
      if (/^##\s+Tags\b/i.test(trimmedLine)) {
        skippingTags = true;
        skippingDescription = false; // Stop skipping description when we hit tags
        continue;
      }
      
      // if we were skipping tags and hit another header, stop skipping
      if (skippingTags && /^##\s+/i.test(trimmedLine)) {
        skippingTags = false;
        continue;
      }
      
      // skip lines while we're in the tags block
      if (skippingTags) continue;
      
      // skip the Description header line itself
      if (skippingDescription) {
        skippingDescription = false; // Only skip the header line, then start collecting
        continue;
      }

      filtered.push(line);
    }

    // Join and clean up for short description
    const cleanContent = filtered.join('\n').trim();
    
    // For short description, get just the first paragraph or first few lines
    const paragraphs = cleanContent.split('\n\n').filter(p => p.trim());
    if (paragraphs.length > 0) {
      return paragraphs[0].replace(/\n/g, ' ').trim();
    }
    
    return cleanContent.replace(/\n/g, ' ').trim();
  },
  
  // Resolve descriptions for all nodes in a tree
  async resolveDescriptions(tree) {
    if (!tree || !tree.fields) return tree;
    
    const resolveNode = async (node) => {
      if (node.descriptionRef && !node.description) {
        const description = await this.loadDescription(node.descriptionRef);
        if (description) {
          node.description = description;
        }
      }
      
      // Process child nodes
      const childArrays = ['categories', 'subcategories', 'nodes', 'subnodes', 'leafnodes', 'children'];
      for (const key of childArrays) {
        if (node[key] && Array.isArray(node[key])) {
          for (const child of node[key]) {
            await resolveNode(child);
          }
        }
      }
    };
    
    // Process all fields
    for (const field of tree.fields) {
      await resolveNode(field);
    }
    
    return tree;
  }
};

// Auto-initialize if tree data exists
if (typeof window !== 'undefined') {
  // Hook into tree loading process
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    // Intercept tree API calls
    if (args[0] === '/api/tree' && response.ok) {
      const clonedResponse = response.clone();
      try {
        const treeData = await clonedResponse.json();
        
        // Check if descriptions are missing
        let needsResolution = false;
        const checkNode = (node) => {
          if (node.descriptionRef && !node.description) {
            needsResolution = true;
            return;
          }
          const childArrays = ['categories', 'subcategories', 'nodes', 'subnodes', 'leafnodes', 'children'];
          for (const key of childArrays) {
            if (node[key]) {
              node[key].forEach(checkNode);
            }
          }
        };
        
        if (treeData.fields) {
          treeData.fields.forEach(checkNode);
        }
        
        // If descriptions are missing, resolve them client-side
        if (needsResolution) {
          console.log('Resolving descriptions client-side...');
          const resolvedTree = await window.DescriptionLoader.resolveDescriptions(treeData);
          
          // Return a new response with resolved data
          return new Response(JSON.stringify(resolvedTree), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        }
      } catch (error) {
        console.error('Error in description resolution interceptor:', error);
      }
    }
    
    return response;
  };
}
