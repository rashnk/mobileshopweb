// Update Notification System for GitHub Pages Flutter App
class UpdateNotificationManager {
  constructor() {
    this.isUpdateAvailable = false;
    this.currentVersion = null;
    this.newVersion = null;
    this.serviceWorker = null;
    this.init();
  }

  async init() {
    if ('serviceWorker' in navigator) {
      try {
        // Register service worker if not already registered
        const registration = await navigator.serviceWorker.register('/flutter_service_worker.js');
        
        // Listen for service worker messages
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event.data);
        });

        // Get the active service worker
        this.serviceWorker = registration.active || registration.waiting || registration.installing;
        
        // Check for updates on page load
        this.checkForUpdates();
        
        console.log('Update notification system initialized');
      } catch (error) {
        console.error('Failed to register service worker:', error);
      }
    }
  }

  handleServiceWorkerMessage(data) {
    if (data.type === 'UPDATE_AVAILABLE') {
      this.isUpdateAvailable = true;
      this.newVersion = data.version;
      this.showUpdateNotification();
    }
  }

  checkForUpdates() {
    if (this.serviceWorker) {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        console.log('Update check completed');
      };
      
      this.serviceWorker.postMessage(
        { type: 'CHECK_UPDATE' },
        [messageChannel.port2]
      );
    }
  }

  showUpdateNotification() {
    // Remove existing notification if any
    this.hideUpdateNotification();

    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'update-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 320px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      animation: slideIn 0.3s ease-out;
    `;

    notification.innerHTML = `
      <div style="display: flex; align-items: center; margin-bottom: 12px;">
        <div style="width: 8px; height: 8px; background: #4CAF50; border-radius: 50%; margin-right: 8px; animation: pulse 2s infinite;"></div>
        <strong>Update Available!</strong>
      </div>
      <div style="margin-bottom: 16px; line-height: 1.4; opacity: 0.9;">
        A new version (${this.newVersion?.version || 'latest'}) is available. 
        Click update to get the latest features and improvements.
      </div>
      <div style="display: flex; gap: 10px;">
        <button id="update-btn" style="
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
          backdrop-filter: blur(10px);
        ">Update Now</button>
        <button id="dismiss-btn" style="
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: rgba(255, 255, 255, 0.8);
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        ">Later</button>
      </div>
    `;

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      #update-btn:hover {
        background: rgba(255, 255, 255, 0.3) !important;
        transform: translateY(-1px);
      }
      
      #dismiss-btn:hover {
        background: rgba(255, 255, 255, 0.1) !important;
        color: white !important;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(notification);

    // Add event listeners
    document.getElementById('update-btn').addEventListener('click', () => {
      this.performUpdate();
    });

    document.getElementById('dismiss-btn').addEventListener('click', () => {
      this.hideUpdateNotification();
    });

    // Auto-hide after 30 seconds
    setTimeout(() => {
      this.hideUpdateNotification();
    }, 30000);

    console.log('Update notification shown');
  }

  hideUpdateNotification() {
    const notification = document.getElementById('update-notification');
    if (notification) {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }
  }

  async performUpdate() {
    if (!this.serviceWorker) {
      console.error('Service worker not available');
      return;
    }

    // Show loading state
    const updateBtn = document.getElementById('update-btn');
    if (updateBtn) {
      updateBtn.innerHTML = 'Updating...';
      updateBtn.disabled = true;
      updateBtn.style.opacity = '0.7';
    }

    try {
      // Request force update from service worker
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'UPDATE_COMPLETE') {
          if (event.data.success) {
            this.showUpdateSuccessMessage();
            // Reload the page after a brief delay
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } else {
            this.showUpdateErrorMessage();
          }
        }
      };

      this.serviceWorker.postMessage(
        { type: 'FORCE_UPDATE' },
        [messageChannel.port2]
      );

    } catch (error) {
      console.error('Update failed:', error);
      this.showUpdateErrorMessage();
    }
  }

  showUpdateSuccessMessage() {
    this.hideUpdateNotification();
    
    const successMsg = document.createElement('div');
    successMsg.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #4CAF50, #45a049);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      backdrop-filter: blur(10px);
      animation: slideIn 0.3s ease-out;
    `;
    
    successMsg.innerHTML = `
      <div style="display: flex; align-items: center;">
        <div style="margin-right: 10px;">✅</div>
        <div>
          <strong>Update Successful!</strong><br>
          <span style="opacity: 0.9; font-size: 13px;">Reloading page...</span>
        </div>
      </div>
    `;
    
    document.body.appendChild(successMsg);
  }

  showUpdateErrorMessage() {
    const updateBtn = document.getElementById('update-btn');
    if (updateBtn) {
      updateBtn.innerHTML = 'Update Failed - Retry';
      updateBtn.disabled = false;
      updateBtn.style.opacity = '1';
      updateBtn.style.background = 'rgba(244, 67, 54, 0.8)';
    }
  }
}

// Initialize the update notification system when the page loads
document.addEventListener('DOMContentLoaded', () => {
  window.updateManager = new UpdateNotificationManager();
});

// Expose a global function to manually check for updates
window.checkForUpdates = () => {
  if (window.updateManager) {
    window.updateManager.checkForUpdates();
  }
};
