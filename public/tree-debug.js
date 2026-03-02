// TreeScreen Debug System - Comprehensive issue detection
window.TreeScreenDebugger = (function() {
  const issues = [];
  const logs = [];
  
  function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, message, type };
    logs.push(logEntry);
    console[type](`[TreeDebug] ${message}`);
  }
  
  function addIssue(id, description, severity = 'medium') {
    issues.push({ id, description, severity, timestamp: new Date().toISOString() });
    log(`ISSUE ${id}: ${description}`, severity === 'critical' ? 'error' : 'warn');
  }
  
  function checkDependencies() {
    log('Checking dependencies...');
    
    // Issue 1: React availability
    if (typeof React === 'undefined') {
      addIssue('REACT_MISSING', 'React is not loaded', 'critical');
    } else if (!React.useState) {
      addIssue('REACT_HOOKS_MISSING', 'React hooks not available', 'critical');
    }
    
    // Issue 2: TreeScreen component
    if (typeof window.TreeScreen === 'undefined') {
      addIssue('TREESCREEN_MISSING', 'TreeScreen component not loaded', 'critical');
    }
    
    // Issue 3: Tree data
    if (typeof window.cryptoHustleTree === 'undefined') {
      addIssue('TREE_DATA_MISSING', 'cryptoHustleTree data not loaded', 'high');
    } else if (!window.cryptoHustleTree.fields) {
      addIssue('TREE_FIELDS_MISSING', 'Tree fields array missing', 'high');
    } else if (window.cryptoHustleTree.fields.length === 0) {
      addIssue('TREE_EMPTY', 'Tree fields array is empty', 'medium');
    }
    
    // Issue 4: UserAccount
    if (typeof UserAccount === 'undefined') {
      addIssue('USERACCOUNT_MISSING', 'UserAccount module not loaded', 'medium');
    }
    
    // Issue 5: DOM element
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      addIssue('ROOT_ELEMENT_MISSING', 'Root DOM element not found', 'critical');
    }
  }
  
  function checkTreeScreenComponent() {
    log('Checking TreeScreen component...');
    
    if (typeof window.TreeScreen !== 'undefined') {
      try {
        // Issue 6: Component instantiation
        const testProps = { 
          tree: { fields: [] }, 
          onOpenArticle: () => {}, 
          bookmarksApi: { bookmarks: [], toggleBookmark: () => {}, isBookmarked: () => false }
        };
        
        const element = React.createElement(window.TreeScreen, testProps);
        if (!element) {
          addIssue('TREESCREEN_INSTANTIATION', 'TreeScreen component cannot be instantiated', 'high');
        }
      } catch (error) {
        addIssue('TREESCREEN_ERROR', `TreeScreen component error: ${error.message}`, 'high');
      }
    }
  }
  
  function checkTreeData() {
    log('Checking tree data structure...');
    
    if (window.cryptoHustleTree && window.cryptoHustleTree.fields) {
      const fields = window.cryptoHustleTree.fields;
      
      // Issue 7: Tree structure validation
      fields.forEach((field, index) => {
        if (!field.id) {
          addIssue('TREE_FIELD_NO_ID', `Field ${index} missing id`, 'medium');
        }
        if (!field.name) {
          addIssue('TREE_FIELD_NO_NAME', `Field ${index} missing name`, 'medium');
        }
      });
    }
  }
  
  function checkCSS() {
    log('Checking CSS...');
    
    // Issue 8: CSS loading
    const stylesheets = Array.from(document.styleSheets);
    const hasStyles = stylesheets.some(sheet => {
      try {
        return sheet.href && sheet.href.includes('styles.css');
      } catch (e) {
        return false;
      }
    });
    
    if (!hasStyles) {
      addIssue('CSS_MISSING', 'styles.css not loaded properly', 'medium');
    }
  }
  
  function checkScriptLoading() {
    log('Checking script loading order...');
    
    // Issue 9: Script loading order
    const scripts = Array.from(document.scripts);
    const scriptOrder = scripts.map(s => s.src.split('/').pop()).filter(Boolean);
    
    const expectedOrder = ['cryptoTree.js', 'user.account.js', 'TreeScreen.js', 'main.js'];
    const actualOrder = scriptOrder.filter(s => expectedOrder.includes(s));
    
    if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder.filter(s => actualOrder.includes(s)))) {
      addIssue('SCRIPT_ORDER', 'Scripts not loaded in correct order', 'medium');
    }
  }
  
  function checkMemoryAndPerformance() {
    log('Checking memory and performance...');
    
    // Issue 10: Memory issues
    if (performance.memory) {
      const memoryUsage = performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize;
      if (memoryUsage > 0.9) {
        addIssue('HIGH_MEMORY_USAGE', 'High memory usage detected', 'medium');
      }
    }
  }
  
  function runFullDiagnostic() {
    log('Starting full TreeScreen diagnostic...');
    issues.length = 0; // Clear previous issues
    
    checkDependencies();
    checkTreeScreenComponent();
    checkTreeData();
    checkCSS();
    checkScriptLoading();
    checkMemoryAndPerformance();
    
    log(`Diagnostic complete. Found ${issues.length} issues.`);
    return { issues, logs };
  }
  
  function getReport() {
    return {
      issues: issues.slice(),
      logs: logs.slice(),
      summary: {
        total: issues.length,
        critical: issues.filter(i => i.severity === 'critical').length,
        high: issues.filter(i => i.severity === 'high').length,
        medium: issues.filter(i => i.severity === 'medium').length
      }
    };
  }
  
  function displayReport() {
    const report = getReport();
    console.group('🔍 TreeScreen Debug Report');
    console.log('Summary:', report.summary);
    
    if (report.issues.length > 0) {
      console.group('Issues Found:');
      report.issues.forEach(issue => {
        const icon = issue.severity === 'critical' ? '🚨' : issue.severity === 'high' ? '⚠️' : '⚡';
        console.log(`${icon} ${issue.id}: ${issue.description}`);
      });
      console.groupEnd();
    } else {
      console.log('✅ No issues found!');
    }
    
    console.groupEnd();
    return report;
  }
  
  return {
    runFullDiagnostic,
    getReport,
    displayReport,
    log,
    addIssue
  };
})();

// Auto-run diagnostic when script loads
setTimeout(() => {
  window.TreeScreenDebugger.runFullDiagnostic();
  window.TreeScreenDebugger.displayReport();
}, 1000);