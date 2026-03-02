// Contribute Save Module - Handles saving user article suggestions for admin review

const ContributeSave = (function() {
  const STORAGE_KEY = 'cryptoExplorer.articleSuggestions';
  
  // Get current user data
  function getCurrentUser() {
    try {
      if (typeof UserAccount !== 'undefined' && UserAccount.getUserData) {
        return UserAccount.getUserData();
      }
    } catch (e) {
      console.warn('Could not get user data:', e);
    }
    return { username: 'Anonymous', id: 'anonymous' };
  }
  
  // Save a new article suggestion
  function saveContribution(contribution) {
    try {
      const existing = getContributions();
      const user = getCurrentUser();
      
      const newContribution = {
        id: 'suggestion_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        status: 'pending', // pending, approved, declined, editing
        
        // Original author info
        author: {
          id: user.id,
          username: user.username,
          nickname: user.nickname || user.username
        },
        
        // Admin review info (populated later)
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        
        // Admin editor info (if edited before approval)
        editedBy: null,
        editedAt: null,
        
        // Article content
        title: contribution.title?.trim() || '',
        description: contribution.description?.trim() || '',
        body: contribution.body?.trim() || '',
        tags: contribution.tags || [],
        
        // Location info
        segmentId: contribution.segmentId || null,
        segmentPath: contribution.segmentPath || null,
        customSegment: contribution.customSegment?.trim() || null,
        locationType: contribution.locationType || 'existing', // 'existing' or 'custom'
        
        // Version tracking for admin edits
        originalContent: {
          title: contribution.title?.trim() || '',
          description: contribution.description?.trim() || '',
          body: contribution.body?.trim() || '',
          tags: [...(contribution.tags || [])]
        },
        
        // Version history
        versions: [{
          timestamp: new Date().toISOString(),
          type: 'original',
          author: user.username,
          changes: 'Initial submission'
        }]
      };
      
      existing.push(newContribution);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      
      // Dispatch event for real-time updates
      window.dispatchEvent(new CustomEvent('suggestionSubmitted', { 
        detail: { suggestion: newContribution } 
      }));
      
      return { success: true, id: newContribution.id, suggestion: newContribution };
    } catch (e) {
      console.error('Error saving contribution:', e);
      return { success: false, error: e.message };
    }
  }

  // Get all contributions/suggestions
  function getContributions(status = null) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const contributions = stored ? JSON.parse(stored) : [];
      
      if (status) {
        return contributions.filter(c => c.status === status);
      }
      return contributions;
    } catch (e) {
      console.error('Error loading contributions:', e);
      return [];
    }
  }
  
  // Get pending suggestions count (for admin badge)
  function getPendingCount() {
    return getContributions('pending').length;
  }
  
  // Get contributions by segment
  function getContributionsBySegment(segmentId) {
    return getContributions().filter(c => c.segmentId === segmentId);
  }
  
  // Get a single contribution by ID
  function getContributionById(id) {
    const contributions = getContributions();
    return contributions.find(c => c.id === id) || null;
  }

  // Update contribution status (approve/decline/edit)
  function updateContributionStatus(id, status, adminData = {}) {
    try {
      const contributions = getContributions();
      const index = contributions.findIndex(c => c.id === id);
      
      if (index === -1) {
        return { success: false, error: 'Contribution not found' };
      }
      
      const user = getCurrentUser();
      const contribution = contributions[index];
      
      // Update status
      contribution.status = status;
      
      // Record review info
      contribution.reviewedBy = {
        id: user.id,
        username: user.username,
        nickname: user.nickname || user.username
      };
      contribution.reviewedAt = new Date().toISOString();
      
      if (adminData.reviewNotes) {
        contribution.reviewNotes = adminData.reviewNotes;
      }
      
      // If admin made edits, record them
      if (adminData.edits) {
        contribution.editedBy = {
          id: user.id,
          username: user.username,
          nickname: user.nickname || user.username
        };
        contribution.editedAt = new Date().toISOString();
        
        // Add version history entry
        contribution.versions.push({
          timestamp: new Date().toISOString(),
          type: 'admin_edit',
          author: user.username,
          changes: adminData.editSummary || 'Admin edits before ' + status
        });
        
        // Apply edits
        if (adminData.edits.title) contribution.title = adminData.edits.title;
        if (adminData.edits.description) contribution.description = adminData.edits.description;
        if (adminData.edits.body) contribution.body = adminData.edits.body;
        if (adminData.edits.tags) contribution.tags = adminData.edits.tags;
        if (adminData.edits.segmentId) contribution.segmentId = adminData.edits.segmentId;
        if (adminData.edits.customSegment) contribution.customSegment = adminData.edits.customSegment;
        if (adminData.edits.locationType) contribution.locationType = adminData.edits.locationType;
      }
      
      // If approved, add approval version entry
      if (status === 'approved') {
        contribution.versions.push({
          timestamp: new Date().toISOString(),
          type: 'approved',
          author: user.username,
          changes: 'Approved and published by admin'
        });
        contribution.publishedAt = new Date().toISOString();
      }
      
      // If declined, add decline version entry
      if (status === 'declined') {
        contribution.versions.push({
          timestamp: new Date().toISOString(),
          type: 'declined',
          author: user.username,
          changes: adminData.reviewNotes || 'Declined by admin'
        });
      }
      
      contributions[index] = contribution;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(contributions));
      
      // Dispatch events for real-time updates
      window.dispatchEvent(new CustomEvent('suggestionStatusChanged', { 
        detail: { 
          id, 
          status, 
          suggestion: contribution 
        } 
      }));
      
      if (status === 'approved') {
        window.dispatchEvent(new CustomEvent('suggestionApproved', { 
          detail: { suggestion: contribution } 
        }));
      }
      
      return { success: true, suggestion: contribution };
    } catch (e) {
      console.error('Error updating contribution status:', e);
      return { success: false, error: e.message };
    }
  }

  // Delete a contribution
  function deleteContribution(contributionId) {
    try {
      const contributions = getContributions();
      const filtered = contributions.filter(c => c.id !== contributionId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      
      window.dispatchEvent(new CustomEvent('suggestionDeleted', { 
        detail: { id: contributionId } 
      }));
      
      return true;
    } catch (e) {
      console.error('Error deleting contribution:', e);
      return false;
    }
  }
  
  // Convert suggestion to article data format for publishing
  function convertToArticleData(suggestion) {
    return {
      title: suggestion.title,
      description: suggestion.description,
      body: suggestion.body,
      tags: suggestion.tags,
      locationType: suggestion.locationType,
      targetSectionId: suggestion.segmentId,
      customLocation: suggestion.customSegment,
      author: suggestion.author,
      reviewedBy: suggestion.reviewedBy,
      editedBy: suggestion.editedBy,
      suggestionId: suggestion.id,
      isContribution: true
    };
  }

  return {
    saveContribution,
    getContributions,
    getPendingCount,
    getContributionsBySegment,
    getContributionById,
    updateContributionStatus,
    deleteContribution,
    convertToArticleData
  };
})();
