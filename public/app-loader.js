// App Loader - Simple dependency check
(function() {
  function checkAndStart() {
    if (window.React && window.ReactDOM && window.cryptoHustleTree) {
      console.log('Dependencies loaded, starting app');
      return;
    }
    
    console.log('Waiting for dependencies...');
    setTimeout(checkAndStart, 50);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndStart);
  } else {
    checkAndStart();
  }
})();