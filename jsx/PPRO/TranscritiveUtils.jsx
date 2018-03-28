$._ext_PPRO = {
  returnApp: function () {
    return app;
  },

  getVersionInfo: function () {
    return 'PPro ' + app.version + 'x' + app.build;
  },

  getUserName: function () {
    var homeDir = new File('~/');
    var userName = homeDir.displayName;
    homeDir.close();
    return userName;
  },

  keepPanelLoaded: function () {
    app.setExtensionPersistent('com.digitalanarchy.Transcriptive', 0);
  },

  updateGrowingFile: function () {
    var numItems = app.project.rootItem.children.numItems;
    var currentItem = 0;

    for (var i = 0; i < numItems; i++) {
      currentItem = app.project.rootItem.children[i];
      if (currentItem) {
        currentItem.refreshMedia();
      }
    }
  },

  getSep: function () {
    if (Folder.fs === 'Macintosh') {
      return '/';
    }
    return '\\';
  },

  ticksPerSecond: 254016000000,

  saveProject: function () {
    app.project.save();
  },

  makeSequence: function (sequence) {
    if (!sequence) {
      return 'null'; // 'undefined' is not valid JSON
    }
    var inPoint = Number(sequence.getInPoint());
    var outPoint = Number(sequence.getOutPoint());
    if (inPoint < 0) {
      inPoint = undefined;
    }
    if (outPoint < 0) {
      outPoint = undefined;
    }
    var maxDuration = $._ext_SecretSauce.getMaxDuration();
    var end = parseInt(sequence.end, 10) / this.ticksPerSecond;
    var length = (outPoint || end) - (inPoint || 0);
    if (maxDuration < length) {
      length = maxDuration;
    }

    var seq = {
      end: end,
      inPoint: inPoint,
      outPoint: outPoint,
      length: length,
      frameRate: $._ext_PPRO.getFPS(),
      id: sequence.id,
      name: sequence.name,
      sequenceID: sequence.sequenceID,
      zeroPoint: parseInt(sequence.zeroPoint, 10) / this.ticksPerSecond
    };

    return $._ext_JSON.stringify(seq);
  },

  getActiveSequence: function () {
    return this.makeSequence(app.project.activeSequence);
  },

  getActiveSequenceName: function () {
    if (app.project.activeSequence) {
      return app.project.activeSequence.name;
    }
    return 'No active sequence.';
  },

  getActiveSequenceCurrentTime: function (sequenceID) {
    var activeSequence = app.project.activeSequence;

    if (!activeSequence) return '';
    if (activeSequence.sequenceID !== sequenceID) return '';
    app.enableQE();
    if (!qe.project.getActiveSequence()) return '';
    return '' + qe.project.getActiveSequence().CTI.secs;
  },

  openLoadDialogFilter: function (fileTypes) {
    return function (file) {
      if (file instanceof Folder) {
        return true;
      }
      for (var i = 0; i < fileTypes.length; i++) {
        if (file.fsName.split('.').pop().toLowerCase() === fileTypes[i]) {
          return true;
        }
      }
      return false;
    };
  },

  openLoadDialog: function (prompt, fileTypesStr, multipleFilesStr, selected) {
    var fileTypes;
    if (typeof fileTypesStr === 'string') {
      fileTypes = $._ext_JSON.parse(fileTypesStr);
    } else {
      fileTypes = fileTypesStr;
    }
    var multipleFiles;
    if (!multipleFilesStr || multipleFilesStr === 'false') {
      multipleFiles = false;
    } else {
      multipleFiles = true;
    }
    var filterString;
    var i;
    if (Folder.fs === 'Windows') {
      filterString = '';
      if (fileTypes) {
        for (i = 0; i < fileTypes.length; i++) {
          var fileType = fileTypes[i];
          filterString += fileType.toUpperCase() + ' files:*.' + fileType + ';';
        }
      }
      filterString += 'All files:*.*';
    } else if (!fileTypes) {
      filterString = 0;
    } else {
      filterString = this.openLoadDialogFilter(fileTypes);
    }

    var fileToOpen;
    if (selected) {
      var fsSelected = new File(selected);
      fileToOpen = fsSelected.openDlg(prompt, filterString, multipleFiles);
    } else {
      fileToOpen = File.openDialog(prompt, filterString, multipleFiles);
    }
    if (fileToOpen) {
      if (multipleFiles) {
        if (fileToOpen.fsName !== undefined) {
          return $._ext_JSON.stringify(fileToOpen.fsName);
        } else if (fileToOpen.length > 0) {
          var files = [];
          for (i = 0; i < fileToOpen.length; i++) {
            if (fileToOpen[i].exists) {
              files.push(fileToOpen[i].fsName);
            }
          }
          if (files.length > 0) {
            return $._ext_JSON.stringify(files);
          }
        }
      } else if (fileToOpen.exists) {
        return $._ext_JSON.stringify(fileToOpen.fsName);
      }
    }
    return 'null'; // JSON.parse fails on empty string
  },

  openSaveDialog: function (prompt, fileType, selected) {
    var filterString = (Folder.fs === 'Windows')
      ? fileType.toUpperCase() + 'files:*.' + fileType
      : '*.'.concat(fileType);
    var fileToSave;
    if (selected) {
      var fsSelected = new File(selected);
      fileToSave = fsSelected.saveDlg(prompt, filterString);
    } else {
      fileToSave = File.saveDialog(prompt, filterString);
    }
    return $._ext_JSON.stringify(fileToSave ? fileToSave.fsName : null);
  },

  openSelectDialog: function (prompt, selected) {
    var folder;
    if (selected) {
      var fsSelected = new Folder(selected);
      folder = fsSelected.selectDlg(prompt);
    } else {
      folder = Folder.selectDialog(prompt);
    }
    return $._ext_JSON.stringify(folder ? folder.fsName : null);
  },

  searchForBinWithName: function (nameToFind) {
    var numItemsAtRoot = app.project.rootItem.children.numItems;
    var foundBin = null;

    for (var i = 0; (numItemsAtRoot > 0) && (i < numItemsAtRoot) && (foundBin === null); i++) {
      var currentItem = app.project.rootItem.children[i];
      if ((currentItem) && currentItem.name === nameToFind) {
        foundBin = currentItem;
      }
    }
    return foundBin;
  },

  // using the sequenceID is unique
  searchForSequenceWithID: function (sequenceID, name) {
    var foundSeq = null;
    var projForSeq = 0;
    var seqCount = app.project.sequences.numSequences;

    for (var i = 0; i < seqCount; i++) {
      var currentSeq = app.project.sequences[i];

      if (currentSeq) {
        var end = currentSeq.end / this.ticksPerSecond;
        if (currentSeq.sequenceID.toString() === sequenceID.toString()) {
          foundSeq = currentSeq;
        }
      }
    }
    if (!foundSeq) {
      if (name !== undefined) {
        alert('Couldn\'t find sequence ' + name);
      } else {
        alert('Couldn\'t find sequenceID ' + sequenceID);
      }
    }
    return foundSeq;
  },

  searchForSequence: function (sequence) {
    return this.searchForSequenceWithID(sequence.sequenceID, sequence.name);
  },

  // using the nodeId is unique
  searchForSequenceWithNodeId: function (nodeId) {
    var foundSeq = null;
    var seqCount = app.project.sequences.numSequences;

    for (var i = 0; i < seqCount; i++) {
      var currentSeq = app.project.sequences[i];

      if (currentSeq && currentSeq.projectItem) {
        if (currentSeq.projectItem.nodeId.toString() === nodeId.toString()) {
          foundSeq = currentSeq;
        }
      }
    }
    return foundSeq;
  },

  getSequence: function (sequenceJson) {
    var sequence = $._ext_JSON.parse(sequenceJson);
    return this.makeSequence(this.searchForSequence(sequence));
  },

  getSequenceClips: function (sequenceJson) {
    var result = [];
    var sequence = this.searchForSequence($._ext_JSON.parse(sequenceJson));
    if (sequence) {
      var trackGroups = [ sequence.audioTracks, sequence.videoTracks ];
      for (var gi = 0; gi < 2; gi++) {
        group = trackGroups[gi];
        for (var ti = 0; ti < group.numTracks; ti++) {
          var track = group[ti];
          var clips = track.clips;
          for (var ci = 0; ci < clips.numTracks; ci++) {
            var clip = clips[ci];
            if (clip.projectItem) {
              var i = {
                group: gi,
                track: ti,
                clip: ci,
                mediaType: clip.mediaType,
                mediaPath: clip.projectItem.getMediaPath(),
                duration: clip.duration,
                start: clip.start,
                end: clip.end,
                inPoint: clip.inPoint,
                outPoint: clip.outPoint
              };
              result.push(i);
            }
          }
        }
      }
    }
    return $._ext_JSON.stringify(result);
  },

  getSequenceClip: function (sequenceJson, clipJson) {
    var sequence = this.searchForSequence($._ext_JSON.parse(sequenceJson));
    if (sequence) {
      var clip = $._ext_JSON.parse(clipJson);
      var trackGroups = [ sequence.audioTracks, sequence.videoTracks ];
      group = trackGroups[clip.group];
      if (group) {
        var track = group[clip.track];
        if (track) {
          return track.clips[clip.clip];
        }
      }
    }
    return undefined;
  },

  searchBinForProjItemByName: function (i, currentItem, nameToFind) {
    for (var j = 0; j < currentItem.children.numItems; j++) {
      var currentChild = currentItem.children[j];
      if (currentChild) {
        if (currentChild.type === ProjectItemType.BIN) {
          return $._ext_PPRO.searchBinForProjItemByName(j, currentChild, nameToFind); // warning; recursion!
        } else if (currentChild.name === nameToFind) {
          return currentChild;
        }
        currentChild = currentItem.children[j + 1];
        if (currentChild) {
          return $._ext_PPRO.searchBinForProjItemByName(0, currentChild, nameToFind);
        }
      }
    }
  },

  // Define a couple of callback functions, for AME to use during render.

  message: function (msg) {
    $.writeln(msg);    // Using '$' object will invoke ExtendScript Toolkit, if installed.
  },

  getFPS: function () {
    return this.ticksPerSecond / app.project.activeSequence.timebase;
  },

  setPlayerPosition: function (sequenceID, secs) {
    // This can fail if 'ticks' is not an integer.
    var ticks = Math.round(this.ticksPerSecond * secs);
    var activeSequence = app.project.activeSequence;

    if (activeSequence && activeSequence.sequenceID === sequenceID) {
      activeSequence.setPlayerPosition(ticks);
      return true;
    }
    return false;
  },

  play: function (sequenceID, speed) {
    app.enableQE();

    var activeSequence = app.project.activeSequence;
    var activeSequenceQE = qe.project.getActiveSequence();
    if (activeSequenceQE && activeSequence && activeSequence.sequenceID === sequenceID) {
      if (speed === 1) {
        activeSequenceQE.player.play();
      } else {
        activeSequenceQE.player.play(speed);
      }
      return true;
    }
    return false;
  },

  stop: function (sequenceID) {
    app.enableQE();

    var activeSequence = app.project.activeSequence;
    var activeSequenceQE = qe.project.getActiveSequence();
    if (activeSequenceQE && activeSequence && activeSequence.sequenceID === sequenceID) {
      activeSequenceQE.player.play(0);
      return true;
    }
    return false;
  },

  addProjectClipItem: function (mediaVisited, item, sequences, recursive, audio, video) {
    var result = [];
    if (item.type === ProjectItemType.CLIP) {
      var mediaPath = item.getMediaPath();
      if (!mediaPath) {
        if (sequences) {
          // Possibly a sequence
          var sequence = this.searchForSequenceWithNodeId(item.nodeId);
          if (sequence) {
            var trackGroups = [];
            if (audio) {
              trackGroups.push(sequence.audioTracks);
            }
            if (video) {
              trackGroups.push(sequence.videoTracks);
            }
            for (var gi = 0; gi < trackGroups.length; gi++) {
              group = trackGroups[gi];
              for (var ti = 0; ti < group.numTracks; ti++) {
                var track = group[ti];
                var clips = track.clips;
                for (var ci = 0; ci < clips.numTracks; ci++) {
                  var clip = clips[ci];
                  if (clip.projectItem) {
                    result = result.concat(this.addProjectClipItem(mediaVisited, clip.projectItem, sequences, recursive, audio, video));
                  }
                }
              }
            }
          }
        }
      } else if (!mediaVisited[mediaPath]) {
        // Only add this file once.
        mediaVisited[mediaPath] = true;
        result = [item.treePath];
      } else if (item.type === ProjectItemType.BIN) {
        if (recursive) {
          result = this.getProjectClips(mediaVisited, item, sequences, recursive);
        }
      }
    }
    return result;
  },

  getProjectClips: function (mediaVisited, root, sequences, recursive, audio, video) {
    var items = root.children;
    var result = [];
    for (i = 0; i < items.numItems; i++) {
      result = result.concat(this.addProjectClipItem(mediaVisited, items[i], sequences, recursive, audio, video));
    }
    return result;
  },

  refreshMediaPath: function (mediaPath, rootItem) {
    var root = rootItem || app.project.rootItem;
    var items = root.items;
    var i;
    for (i = 0; i < root.numItems; i++) {
      if (items[i].type === ProjectItemType.BIN) {
        refreshMediaPath(mediaPath, items[i]);
      } else if (items[i].type === ProjectItemType.CLIP) {
        if (items[i].getMediaPath() === mediaPath) {
          items[i].refreshMedia();
        }
      }
    }
  },

  getProjectItems: function (binName, audio, video) {
    var root;
    var items;
    var i;
    if (binName) {
      items = app.project.rootItem.children;
      for (i = 0; i < items.numItems; i++) {
        if (items[i].type === ProjectItemType.BIN &&
            items[i].name === binName) {
          root = items[i];
          break;
        }
      }
    } else {
      root = app.project.rootItem;
    }
    var result = [];
    if (root) {
      result = this.getProjectClips({}, root, true, true, audio, video);
    } else {
      result = { error: 'Unable to find Bin ' + binName };
    }
    return $._ext_JSON.stringify(result);
  },

  getSequenceItems: function (sequenceJson, audio, video) {
    var sequence = this.searchForSequence($._ext_JSON.parse(sequenceJson));
    var result;
    if (sequence && sequence.projectItem) {
      result = this.addProjectClipItem({}, sequence.projectItem, true, true, audio, video);
    } else {
      result = { error: 'Unable to find sequenceID ' + sequenceID };
    }
    return $._ext_JSON.stringify(result);
  },

  projectItemFromPath: function (projectItemPath, root) {
    var items = (root || app.project.rootItem).children;
    for (var i = 0; i < items.numItems; i++) {
      if (items[i].type === ProjectItemType.BIN) {
        var result = this.projectItemFromPath(projectItemPath, items[i]);
        if (result) {
          return result;
        }
      } else if (projectItemPath === items[i].treePath) {
        return items[i];
      }
    }
  },

  getProjectItemMediaPath: function (projectItemPath, root) {
    var item = this.projectItemFromPath(projectItemPath, root);
    if (item) {
      return item.getMediaPath();
    }
    return '';
  },

  importFiles: function (filesStr, binName) {
    var files = $._ext_JSON.parse(filesStr);
    var bin = 0;
    if (binName) {
      bin = this.searchForBinWithName(binName);
      if (!bin) {
        app.project.rootItem.createBin(binName);
        bin = this.searchForBinWithName(binName);
      }
    }
    if (bin) {
      bin.select();
      var result = app.project.importFiles(files,
                                           1, // suppress warnings
                                           bin,
                                           0); // import as numbered stills
      return result;
    }
    return false;
  },

  findImportedFiles: function (filesStr, binName) {
    var files = $._ext_JSON.parse(filesStr);
    var results = [];
    var bin = this.searchForBinWithName(binName);
    if (bin) {
      var items = bin.children;
      for (var j = 0; j < files.length; j++) {
        var name = files[j].split($._ext_PPRO.getSep()).pop();
        for (var i = 0; i < items.numItems; i++) {
          if (items[i].type === ProjectItemType.CLIP && items[i].name === name) {
            results.push(items[i].treePath);
            break;
          }
        }
      }
    }
    return $._ext_JSON.stringify(results);
  },

  findUniqueBin: function (binName) {
    var name = binName;
    // Keep going until bin isn't found.
    for (var i = 1; this.searchForBinWithName(name); i++) {
      name = binName + i;
    }
    return name;
  },

  deleteBin: function (binName) {
    var bin = this.searchForBinWithName(binName);
    if (bin) {
      bin.deleteBin(bin);
      return true;
    }
    return false;
  },

  onExportJobComplete: function (jobID, outputFilePath) {
    var eoName;
    var data = {};

    if (Folder.fs === 'Macintosh') {
      eoName = 'PlugPlugExternalObject';
    } else {
      eoName = 'PlugPlugExternalObject.dll';
    }

    var mylib = new ExternalObject('lib:' + eoName);
    var eventObj = new CSXSEvent();
    data.outputFilePath = outputFilePath;
    data.jobID = jobID;

    eventObj.type = 'com.adobe.csxs.events.PProPanelExportEvent';
    eventObj.data = $._ext_JSON.stringify(data);
    eventObj.dispatch();
  },

  onExportJobError: function (jobID, errorMessage) {
    var eoName;
    var data = {};

    if (Folder.fs === 'Macintosh') {
      eoName = 'PlugPlugExternalObject';
    } else {
      eoName = 'PlugPlugExternalObject.dll';
    }

    var mylib = new ExternalObject('lib:' + eoName);
    var eventObj = new CSXSEvent();
    data.error = errorMessage;
    data.jobID = jobID;

    eventObj.type = 'com.adobe.csxs.events.PProPanelExportEvent';
    eventObj.data = $._ext_JSON.stringify(data);
    eventObj.dispatch();
  },

  onExportJobCanceled: function (jobID) {
    var eoName;
    var data = {};

    if (Folder.fs === 'Macintosh') {
      eoName = 'PlugPlugExternalObject';
    } else {
      eoName = 'PlugPlugExternalObject.dll';
    }

    var mylib = new ExternalObject('lib:' + eoName);
    var eventObj = new CSXSEvent();
    data.error = 'User has cancelled the export';
    data.jobID = jobID;

    eventObj.type = 'com.adobe.csxs.events.PProPanelExportEvent';
    eventObj.data = $._ext_JSON.stringify(data);
    eventObj.dispatch();
  },

  onExportJobQueued: function (jobID) {
    app.encoder.startBatch();
  },

  validFilename: function (pathname) {
    if (Folder.fs === 'Windows') {
      return pathname.replace(/[<>:":\/\\|?*]/g, '-');
    }
    return pathname.replace(/[\/]/g, '-');
  },

  exportSequence: function (presetPath, ext, documentsPath, background) {
    var activeSequence = app.project.activeSequence;

    if (!activeSequence) return;

    var outputName = this.validFilename(activeSequence.name);
    var outputFolder = new Folder(documentsPath.concat($._ext_PPRO.getSep(), 'Transcriptive'));
    outputFolder.create();
    var outputPath = outputFolder.fsName.concat($._ext_PPRO.getSep(), outputName, ext);

    var outPreset   = new File(presetPath);
    var result = {};

    if (outPreset.exists === true) {
      // Returns -400000 if undefined.
      var inPoint = Number(activeSequence.getInPoint());
      var outPoint = Number(activeSequence.getOutPoint());
      var restoreOutPoint = outPoint;
      if (inPoint >= 0) {
        result.startTime = inPoint;
      } else {
        result.startTime = 0;
      }
      if (inPoint < 0) {
        inPoint = undefined;
      }
      if (outPoint < 0) {
        outPoint = undefined;
      }
      var maxDuration = $._ext_SecretSauce.getMaxDuration();
      if (maxDuration < 1) {
        maxDuration = 1;
      }
      var end = parseInt(activeSequence.end, 10) / this.ticksPerSecond;
      var length = (outPoint || end) - (inPoint || 0);
      var outputFile = new File(outputPath);
      if (outputFile.exists) {
        outputFile.remove();
      }
      if (maxDuration < length) {
        activeSequence.setOutPoint(maxDuration + (inPoint || 0));
      } else {
        restoreOutPoint = undefined;
      }
      var removeFromQueue = true;
      var rangeToEncode = app.encoder.ENCODE_IN_TO_OUT;
      if (!background && activeSequence.exportAsMediaDirect !== undefined) {
        try {
          var v = activeSequence.exportAsMediaDirect(outputPath, outPreset.fsName, rangeToEncode);
          if (v && v !== 'No Error') {
            result.error = v.toString();
          }
        } catch (e) {
          result.error = e.toString();
        }
        if (!result.error) {
          result.outputPath = outputPath;
        }
      } else {
        app.encoder.launchEncoder();
        app.encoder.bind('onEncoderJobComplete', $._ext_PPRO.onExportJobComplete);
        app.encoder.bind('onEncoderJobError', $._ext_PPRO.onExportJobError);
        app.encoder.bind('onEncoderJobQueued', $._ext_PPRO.onExportJobQueued);
        app.encoder.bind('onEncoderJobCanceled', $._ext_PPRO.onExportJobCanceled);

        app.encoder.setSidecarXMPEnabled(0);
        app.encoder.setEmbeddedXMPEnabled(0);

        delete result.error;
        result.jobID = app.encoder.encodeSequence(activeSequence,
                                                  outputPath,
                                                  outPreset.fsName,
                                                  rangeToEncode,
                                                  removeFromQueue);
      }
      if (restoreOutPoint !== undefined) {
        activeSequence.setOutPoint(restoreOutPoint);
      }
      outPreset.close();
    } else {
      result.error = 'Missing preset: ' + presetPath;
    }

    return $._ext_JSON.stringify(result);
  },

  supportsEncodeItem: function () {
    if (app.encoder.encodeProjectItem !== undefined) {
      return true;
    }
    return false;
  },

  supportsEncodeFile: function () {
    if (app.encoder.encodeFile !== undefined) {
      return true;
    }
    return false;
  },

  encodeItem: function (presetPath, ext, projectItemPath, documentsPath) {
    var projectItem = $._ext_PPRO.projectItemFromPath(projectItemPath);
    var outputName = projectItem.name.search('[.]');
    if (outputName === -1) {
      outputName = projectItem.name.length;
    }
    outputName = projectItem.name.substr(0, outputName);
    outputName = this.validFilename(outputName);
    var outputFolder = new Folder(documentsPath.concat($._ext_PPRO.getSep(), 'Transcriptive'));
    outputFolder.create();
    var outputPath = outputFolder.fsName.concat($._ext_PPRO.getSep(), outputName, ext);

    var outPreset = new File(presetPath);
    var result = {};

    if (outPreset.exists === true) {
      result.startTime = 0;
      var maxDuration = $._ext_SecretSauce.getMaxDuration();
      if (maxDuration < 1) {
        maxDuration = 1;
      }
      var outputFile = new File(outputPath);
      if (outputFile.exists) {
        outputFile.remove();
      }
      app.encoder.launchEncoder();
      app.encoder.bind('onEncoderJobComplete', $._ext_PPRO.onExportJobComplete);
      app.encoder.bind('onEncoderJobError', $._ext_PPRO.onExportJobError);
      app.encoder.bind('onEncoderJobQueued', $._ext_PPRO.onExportJobQueued);
      app.encoder.bind('onEncoderJobCanceled', $._ext_PPRO.onExportJobCanceled);

      app.encoder.setSidecarXMPEnabled(0);
      app.encoder.setEmbeddedXMPEnabled(0);

      var removeFromQueue = true;
      var rangeToEncode = app.encoder.ENCODE_IN_TO_OUT;
      if (maxDuration >= 1000000000) {
        rangeToEncode = app.encoder.ENCODE_ENTIRE;
      }
      result.jobID = app.encoder.encodeProjectItem(projectItem,
                                                   outputPath,
                                                   outPreset.fsName,
                                                   rangeToEncode,
                                                   removeFromQueue);
      outPreset.close();
      outputFile.close();
    } else {
      result.error = 'Missing preset: ' + presetPath;
    }

    return $._ext_JSON.stringify(result);
  },

  appEncodeFile: function (input, output, preset, removeFromQueue, srcInPoint, srcOutPoint) {
    if (srcInPoint === undefined || srcOutPoint === undefined) {
      // Optional arguments can't be passed as undefined.
      return app.encoder.encodeFile(input,
                                    output,
                                    preset,
                                    removeFromQueue);
    }
    return app.encoder.encodeFile(input,
                                  output,
                                  preset,
                                  removeFromQueue,
                                  srcInPoint,
                                  srcOutPoint);
  },

  encodeFile: function (presetPath, ext, inputPath, documentsPath, binName) {
    var outputName = inputPath.search('[.]');
    if (outputName === -1) {
      outputName = inputPath.length;
    }
    outputName = inputPath.substr(0, outputName);
    outputName = outputName.split($._ext_PPRO.getSep()).pop();
    var outputFolder = new Folder(documentsPath.concat($._ext_PPRO.getSep(), 'Transcriptive'));
    outputFolder.create();
    var outputPath = outputFolder.fsName.concat($._ext_PPRO.getSep(), outputName, ext);

    var outPreset = new File(presetPath);
    var result = {};

    if (outPreset.exists === true) {
      var srcInPoint;
      var srcOutPoint;
      var maxDuration = $._ext_SecretSauce.getMaxDuration();
      if (maxDuration < 1) {
        maxDuration = 1;
      }
      if (maxDuration < 1000000000) {
        srcInPoint = 0;
        srcOutPoint = maxDuration;
      }
      var inputFile = new File(inputPath);
      var outputFile = new File(outputPath);
      if (outputFile.exists) {
        outputFile.remove();
      }
      app.encoder.launchEncoder();
      app.encoder.bind('onEncoderJobComplete', $._ext_PPRO.onExportJobComplete);
      app.encoder.bind('onEncoderJobError', $._ext_PPRO.onExportJobError);
      app.encoder.bind('onEncoderJobQueued', $._ext_PPRO.onExportJobQueued);
      app.encoder.bind('onEncoderJobCanceled', $._ext_PPRO.onExportJobCanceled);

      app.encoder.setSidecarXMPEnabled(0);
      app.encoder.setEmbeddedXMPEnabled(0);

      var removeFromQueue = true;
      var bin = binName ? this.searchForBinWithName(binName) : 0;
      var projectItem = 0;
      var name = inputFile.fsName.split($._ext_PPRO.getSep()).pop();
      if (bin) {
        var items = bin.children;
        for (var i = 0; i < items.numItems; i++) {
          if (items[i].type === ProjectItemType.CLIP && items[i].name === name) {
            projectItem = items[i];
            break;
          }
        }
      }

      if (projectItem) {
        var rangeToEncode = app.encoder.ENCODE_IN_TO_OUT;
        if (srcInPoint === undefined || srcOutPoint === undefined) {
          rangeToEncode = app.encoder.ENCODE_ENTIRE;
        }
        result.jobID = app.encoder.encodeProjectItem(projectItem,
                                                     outputPath,
                                                     outPreset.fsName,
                                                     rangeToEncode,
                                                     removeFromQueue);
      } else if (binName) {
        result.error = 'Missing project item: ' + name;
      } else {
        result.jobID = this.appEncodeFile(inputFile.fsName,
                                          outputPath,
                                          outPreset.fsName,
                                          removeFromQueue,
                                          srcInPoint,
                                          srcOutPoint);
      }
      outPreset.close();
      inputFile.close();
      outputFile.close();
    } else {
      result.error = 'Missing preset: ' + presetPath;
    }

    return $._ext_JSON.stringify(result);
  },

  included: function (arr, obj) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] === obj) {
        return true;
      }
    }
    return false;
  },

  getSentence: function (words) {
    var text = '';

    // pull words to build sentence
    for (var obj = 0; obj < words.length; obj++) {
      text = text + words[obj].text + ' ';
    }
    return text;
  },

  // the idea here is go through each marker and delete any with 'Transcriptive' in the name
  clearExistingMarkers: function (markers, clip) {
    if (markers) {
      // be sure to only delete markers in the range of this clip in the sequence
      // preserving previous markers that might have been in areas of the clip outside the current sequence
      var cIn;
      var cOut;
      if (clip !== undefined) {
        cIn = parseFloat(clip.inPoint.seconds);
        cOut = parseFloat(clip.outPoint.seconds);
      }
      var marker = markers.getFirstMarker();
      while (marker) {
        var next_marker = markers.getNextMarker(marker);
        var start = marker.start.seconds;
        if (clip === undefined || (start >= cIn && start < cOut)) {
          if (marker.name.length > 0 && marker.name.search('Transcriptive') >= 0) {
            if (marker === markers.getLastMarker()) {
              next_marker = null;
            }
            markers.deleteMarker(marker);
          } else if (marker === markers.getLastMarker()) {
            // marker is empty name or not Transcriptive
            next_marker = null;
          }
        }
        marker = next_marker;
      } // while
    } // if markers
  },

  exportMarkers: function (markers, markerObjs, clip) {
    $._ext_PPRO.clearExistingMarkers(markers, clip);

    for (var i = 0; i < markerObjs.length; i++) {
      var markerObj = markerObjs[i];
      var newMarker = markers.createMarker(markerObj.start);
      if (markerObj.end !== undefined) {
        newMarker.end = markerObj.end;
      }
      if (markerObj.name !== undefined) {
        newMarker.name = markerObj.name;
      }
      if (markerObj.comments !== undefined) {
        newMarker.comments = markerObj.comments;
      }
      switch (markerObjs.type) {
        case 'chapter':
          newMarker.setTypeAsChapter();
          break;
        case 'weblink':
          newMarker.setTypeAsWebLink(newMarker.url, newMarker.frameTarget);
          break;
        case 'segmentation':
          newMarker.setTypeAsSegmentation();
          break;
        case 'comment':
        default:
          newMarker.setTypeAsComment();
          break;
      }
    }
  },

  exportMarkersToSequence: function (sequenceJson, markersJson) {
    var transcribedSeq = $._ext_JSON.parse(sequenceJson);
    var markerObjs = $._ext_JSON.parse(markersJson);
    var curSequence = $._ext_PPRO.searchForSequence(transcribedSeq);

    // when a sequence is passed down to the calling function, we
    // go through the project to retrieve the named sequence from
    // the project, rather than calling getActiveSequence, since QE is unreliable

    if (!curSequence) {
      return;
    }

    var markers = curSequence.markers;

    if (!markers) {
      alert('not markers' + markers);
      alert('sequence name: ' + curSequence.name + ' has no marker object defined');
      return;
    }
    this.exportMarkers(markers, markerObjs);
  },
};
