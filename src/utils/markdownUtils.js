/**
 * Markdown processing utilities for CryptoExplorer
 * Provides functions to strip markdown, extract metadata, and clean text for display
 */

/**
 * Strips markdown syntax from text to create plain text previews
 * @param {string} text - The markdown text to clean
 * @returns {string} - Plain text without markdown syntax
 */
export function stripMarkdown(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    // Remove headers (# ## ###)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove blockquotes
    .replace(/^\s*>\s*/gm, '')
    // Remove list markers
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Remove links but keep text [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bare URLs
    .replace(/https?:\/\/[^\s]+/g, '')
    // Remove images ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    // Remove horizontal rules
    .replace(/^\s*---+\s*$/gm, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Normalize whitespace
    .replace(/\n\s*\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts the first H1 title from markdown content
 * @param {string} content - Markdown content
 * @returns {string|null} - The H1 title or null if not found
 */
export function extractH1Title(content) {
  if (!content || typeof content !== 'string') return null;
  
  const h1Match = content.match(/^#\s+(.+)$/m);
  return h1Match ? h1Match[1].trim() : null;
}

/**
 * Removes the first H1 title from markdown content if it matches the given title
 * @param {string} content - Markdown content
 * @param {string} title - The title to compare against
 * @returns {string} - Content with matching H1 removed
 */
export function removeDuplicateTitle(content, title) {
  if (!content || !title) return content;
  
  const h1Title = extractH1Title(content);
  if (!h1Title) return content;
  
  // Normalize for comparison (case-insensitive, ignore extra whitespace)
  const normalizedH1 = h1Title.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedTitle = title.toLowerCase().replace(/\s+/g, ' ').trim();
  
  if (normalizedH1 === normalizedTitle) {
    // Remove the H1 line and following empty lines
    return content.replace(/^#\s+.+\n\n*/, '');
  }
  
  return content;
}

/**
 * Extracts metadata from markdown frontmatter (YAML-style)
 * @param {string} content - Markdown content
 * @returns {object} - Extracted metadata object
 */
export function extractFrontmatter(content) {
  if (!content || typeof content !== 'string') return {};
  
  const result = {
    title: null,
    id: null,
    path: null,
    branch: null,
    tags: []
  };
  
  // Extract H1 title
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    result.title = h1Match[1].trim();
  }
  
  // Extract ID, Path, Branch from markdown format **ID:** value
  const idMatch = content.match(/\*\*ID:\*\*\s*(.+)$/m);
  if (idMatch) result.id = idMatch[1].trim();
  
  const pathMatch = content.match(/\*\*Path:\*\*\s*(.+)$/m);
  if (pathMatch) result.path = pathMatch[1].trim();
  
  const branchMatch = content.match(/\*\*Branch:\*\*\s*(.+)$/m);
  if (branchMatch) result.branch = branchMatch[1].trim();
  
  // Extract tags from ## Tags section
  const tagsMatch = content.match(/##\s*Tags\s*\n([\s\S]*?)(?=\n##|\n---|$)/i);
  if (tagsMatch) {
    result.tags = tagsMatch[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^[-*+•]\s*/, '').replace(/^\d+\.\s*/, ''))
      .filter(line => line.length > 0 && !line.startsWith('#'));
  }
  
  return result;
}

/**
 * Cleans description text for tile preview display
 * Removes markdown, extracts sentences, limits length
 * @param {string} content - Raw markdown content
 * @param {string} nodeTitle - The title of the node (to check for duplication)
 * @param {number} maxSentences - Maximum sentences to return
 * @returns {string} - Clean plain text description
 */
export function cleanDescriptionForPreview(content, nodeTitle, maxSentences = 3) {
  if (!content || typeof content !== 'string') return '';
  
  // Remove duplicate title if present
  let cleaned = removeDuplicateTitle(content, nodeTitle);
  
  // Remove metadata lines
  cleaned = cleaned
    .replace(/^\*\*ID:.*$/m, '')
    .replace(/^\*\*Path:.*$/m, '')
    .replace(/^\*\*Branch:.*$/m, '');
  
  // Remove ## Description header and ## Tags section
  cleaned = cleaned.replace(/^##\s*Description\s*$/m, '');
  cleaned = cleaned.replace(/##\s*Tags[\s\S]*?(?=\n##|\n---|$)/i, '');
  
  // Strip markdown
  cleaned = stripMarkdown(cleaned);
  
  // Extract first N sentences
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [];
  const result = sentences.slice(0, maxSentences).join(' ').trim();
  
  // Fallback to first 200 chars if no sentences found
  if (!result) {
    return cleaned.substring(0, 200).trim();
  }
  
  return result;
}

/**
 * Filters content for full article display
 * Removes metadata, tags section, but preserves rest of markdown
 * @param {string} content - Raw markdown content
 * @param {string} nodeTitle - The title of the node (to check for duplication)
 * @returns {string} - Filtered markdown ready for rendering
 */
export function filterContentForDisplay(content, nodeTitle) {
  if (!content || typeof content !== 'string') return '';
  
  const lines = content.split('\n');
  const filtered = [];
  let skippingTags = false;
  let foundFirstH1 = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Handle H1 title (first one only)
    if (!foundFirstH1 && /^#\s+/.test(line)) {
      foundFirstH1 = true;
      const h1Text = line.replace(/^#\s+/, '').trim();
      // Skip this line if it matches the node title
      if (h1Text.toLowerCase() === nodeTitle?.toLowerCase()) {
        continue;
      }
    }
    
    // Skip metadata lines
    if (/^\*\*ID:/i.test(line)) continue;
    if (/^\*\*Path:/i.test(line)) continue;
    if (/^\*\*Branch:/i.test(line)) continue;
    
    // Detect tags block
    if (/^##\s*Tags\b/i.test(line)) {
      skippingTags = true;
      continue;
    }
    
    // End of tags block when we hit another header
    if (skippingTags && /^##\s+/.test(line)) {
      skippingTags = false;
      // Continue to include this header
    }
    
    if (skippingTags) continue;
    
    filtered.push(line);
  }
  
  return filtered.join('\n').trim();
}

export default {
  stripMarkdown,
  extractH1Title,
  removeDuplicateTitle,
  extractFrontmatter,
  cleanDescriptionForPreview,
  filterContentForDisplay
};
