/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';

var icc = {
  _iccLastCommand: null,

  init: function icc_init() {
    this._icc = this.getICC();
    this.hideViews();
    var self = this;
    this.clearMenuCache(function() {
      window.navigator.mozSetMessageHandler('icc-stkcommand',
        function callHandleSTKCommand(message) {
          self.handleSTKCommand(message);
        });
    });
  },

  getICC: function icc_getICC() {
    if (!window.navigator.mozMobileConnection) {
      return;
    }

    // See bug 859712
    // To have the backward compatibility for bug 859220.
    // If we could not get iccManager from navigator,
    // try to get it from mozMobileConnection.
    // 'window.navigator.mozMobileConnection.icc' can be dropped
    // after bug 859220 is landed.
    return window.navigator.mozIccManager ||
           window.navigator.mozMobileConnection.icc;
  },

  clearMenuCache: function icc_clearMenuCache(callback) {
    if (typeof callback != 'function') {
      callback = function() {};
    }
    // Remove previous menu
    var resetApplications = window.navigator.mozSettings.createLock().set({
      'icc.applications': '{}'
    });
    resetApplications.onsuccess = function icc_resetApplications() {
      DUMP('STK Cache Reseted');
      callback();
    };
  },

  handleSTKCommand: function icc_handleSTKCommand(command) {
    DUMP('STK Proactive Command:', command);
    this._iccLastCommand = command;

    var cmdId = '0x' + command.typeOfCommand.toString(16);
    if (icc_worker[cmdId]) {
      return icc_worker[cmdId](command, this);
    }

    // Command not yet supported in system (Bug #875679)
    // transferring to settings...
    DUMP('STK -> Settings: ', command);
    var application = document.location.protocol + '//' +
      document.location.host.replace('system', 'settings');
    DUMP('application: ', application);
    var reqIccData = window.navigator.mozSettings.createLock().set({
      'icc.data': JSON.stringify(command)
    });
    reqIccData.onsuccess = function icc_getIccData() {
      if (WindowManager.getRunningApps()[application]) {
        DUMP('Settings is running. Ignoring');
        return;   // If settings is opened, we don't manage it
      }

      function launchSettings() {
        DUMP('Locating settings . . .');
        navigator.mozApps.mgmt.getAll().onsuccess =
        function gotApps(evt) {
          var apps = evt.target.result;
          apps.forEach(function appIterator(app) {
            if (app.origin != application)
              return;
            DUMP('Launching ', app.origin);
            app.launch();
          }, this);
        };
      }
      if (FtuLauncher.isFtuRunning()) {
        // Delay the stk command until FTU is done
        window.addEventListener('ftudone', function ftudone() {
          DUMP('ftu is done!');
          launchSettings();
        });
      } else {
        launchSettings();
      }
    };
  },


  /**
   * Response ICC Command
   */
  responseSTKCommand: function icc_responseSTKCommand(response) {
    DUMP('sendStkResponse to command: ', this._iccLastCommand);
    DUMP('sendStkResponse -- # response = ', response);

    this._icc.sendStkResponse(this._iccLastCommand, response);
    this._iccLastCommand = null;
  },

  /******************************************
   * ICC Helper methods
   ******************************************/

  hideViews: function icc_hideViews() {
    if (!this.icc_view) {
      this.icc_view = document.getElementById('icc-view');
    }
    this.icc_view.classList.remove('visible');
    var icc_view_boxes = this.icc_view.children;
    for (var i = 0; i < icc_view_boxes.length; i++) {
      icc_view_boxes[i].classList.remove('visible');
    }
  },

  alert: function icc_alert(message) {
    if (!this.icc_alert) {
      this.icc_alert = document.getElementById('icc-alert');
      this.icc_alert_msg = document.getElementById('icc-alert-msg');
      this.icc_alert_btn = document.getElementById('icc-alert-btn');
    }

    var self = this;
    this.icc_alert_btn.onclick = function closeICCalert() {
      self.hideViews();
    };

    this.icc_alert_msg.textContent = message;
    this.icc_alert.classList.add('visible');
    this.icc_view.classList.add('visible');
  }

};

// Initialize icc management
icc.init();
