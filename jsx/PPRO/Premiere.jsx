const PROJECTITEM_TYPE_MAP = { BIN: 2, CLIP: 1, FILE: 4, ROOT: 3 };
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function(b) {
    var a = this.length >>> 0;
    var c = Number(arguments[1]) || 0;
    c = c < 0 ? Math.ceil(c) : Math.floor(c);
    if (c < 0) {
      c += a;
    }
    for (; c < a; c++) {
      if (c in this && this[c] === b) {
        return c;
      }
    }
    return -1;
  };
}
if (Array.prototype.map === undefined) {
  Array.prototype.map = function(fn) {
    var rv = [];
    for (var i = 0, l = this.length; i < l; i++) rv.push(fn(this[i]));
    return rv;
  };
}
if (!Array.prototype.forEach) {
  //eslint-disable-line
  Array.prototype.forEach = function forEach(callback, thisArg) {
    //eslint-disable-line
    if (typeof callback !== 'function') {
      //eslint-disable-line
      throw new TypeError(callback + ' is not a function'); //eslint-disable-line
    } //eslint-disable-line
    var array = this; //eslint-disable-line
    thisArg = thisArg || this; //eslint-disable-line
    for (var i = 0, l = array.length; i !== l; ++i) {
      //eslint-disable-line
      callback.call(thisArg, array[i], i, array); //eslint-disable-line
    } //eslint-disable-line
  }; //eslint-disable-line
} //eslint-disable-line

$._PPP_ = {
  kPProPrivateProjectMetadataURI:
    'http://ns.adobe.com/premierePrivateProjectMetaData/1.0/',
  schemaNS: 'http://digitalanarchy.com/xmp/Transcriptive/1.0/',
  prefix: 'transcriptive:',
  languageName: 'language',
  speakerName: 'speakers',
  transcriptsName: 'transcripts',
  projectField: 'Transcriptive',
  projectLabel: 'Transcriptive',
  positionField: 'TranscriptivePosition',
  positionLabel: 'TranscriptivePosition',
  emptyObject: { transcripts: [], speakers: {}, lang: 'en-US' },
  initXMP: function() {
    if (ExternalObject.AdobeXMPScript === undefined) {
      ExternalObject.AdobeXMPScript = new ExternalObject('lib:AdobeXMPScript');
      if (ExternalObject.AdobeXMPScript === undefined) {
        return false;
      }
    }
    return true;
  },

  createDeepFolderStructure: function(foldersArray, maxDepth) {
    if (typeof foldersArray !== 'object' || foldersArray.length <= 0) {
      throw new Error('No valid folders array was provided!');
    }

    // if the first folder already exists, throw error
    for (var i = 0; i < app.project.rootItem.children.numItems; i++) {
      var curChild = app.project.rootItem.children[i];
      if (curChild.type === ProjectItemType.BIN && curChild.name === foldersArray[0]) {
        throw new Error('Folder with name "' + curChild.name + '" already exists!');
      }
    }

    // create the deep folder structure
    var currentBin = app.project.rootItem.createBin(foldersArray[0]);
    for (var i = 1; i < foldersArray.length && i < maxDepth; i++) {
      currentBin = currentBin.createBin(foldersArray[i]);
    }
  },

  fixTranscripts: function(transcripts) {
    var next;
    var words;
    var i = transcripts.length;
    while (i > 0) {
      --i;
      var t = transcripts[i];
      words = t.words;
      if (t.words.length > 0) {
        t.startTime = t.words[0].startTime;
        t.endTime = t.words[t.words.length - 1].endTime;
      }
      var w = words.length;
      while (w > 0) {
        --w;
        var word = words[w];
        if (next === undefined) {
          next = word.endTime;
        }
        word.nextStartTime = next;
        next = word.startTime;
        if (word.transcriptIndex === undefined || word.transcriptIndex === null) {
          word.transcriptIndex = i;
        }
      }
    }
  },

  readSpeechAnalysis: function(xmp) {
    var result = this.emptyObject;
    var count = xmp.countArrayItems(XMPConst.NS_DM, 'Tracks');
    if (count > 0) {
      for (var i = 1; i <= count; i++) {
        var path = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, 'Tracks', i);
        var type = xmp.getStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'trackType')
          .value;
        if (type === 'Speech') {
          var rate = xmp.getStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'frameRate')
            .value;
          if (rate[0] === 'f') {
            rate = rate.substr(1);
          }
          rate = Number(rate);
          result = { transcripts: [], speakers: {}, lang: 'en-US' };
          var markersPath = XMPUtils.composeStructFieldPath(
            XMPConst.NS_DM,
            path,
            XMPConst.NS_DM,
            'markers',
          );
          var words = [];
          var markers = xmp.countArrayItems(XMPConst.NS_DM, markersPath);
          var speaker;
          var speakerMap = {};
          var speakers = [];
          for (var j = 1; j <= markers; j++) {
            var markerJ = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, markersPath, j);
            var obj = {};
            obj.startTime =
              xmp.getStructField(XMPConst.NS_DM, markerJ, XMPConst.NS_DM, 'startTime')
                .value / rate;
            obj.endTime =
              xmp.getStructField(XMPConst.NS_DM, markerJ, XMPConst.NS_DM, 'duration')
                .value /
                rate +
              obj.startTime;
            obj.text = xmp.getStructField(
              XMPConst.NS_DM,
              markerJ,
              XMPConst.NS_DM,
              'name',
            ).value;
            obj.confidence =
              xmp.getStructField(XMPConst.NS_DM, markerJ, XMPConst.NS_DM, 'probability')
                .value / 100;
            if (!speaker) {
              speaker =
                xmp.getStructField(XMPConst.NS_DM, markerJ, XMPConst.NS_DM, 'speaker')
                  .value || undefined;
              if (speaker) {
                if (speakerMap[speaker] === undefined) {
                  speakers.push(speaker);
                  speakerMap[speaker] = speakers.length;
                  result.speakers[speakerMap[speaker]] = speaker;
                }
                speaker = speakerMap[speaker];
              }
            }
            words.push(obj);
            if (obj.text.search('[.?!]') >= 0) {
              result.transcripts.push({ words: words, speaker: speaker });
              words = [];
              speaker = undefined;
            }
          }
          if (words.length > 0) {
            result.transcripts.push({ words: words, speaker: speaker });
          }
          this.fixTranscripts(result.transcripts);
          break;
        }
      }
    }
    return result;
  },

  loadTranscriptsXMP: function() {
    var activeSequence = app.project.activeSequence;
    if (activeSequence) {
      if (!this.initXMP()) {
        return $._ext_JSON.stringify(this.emptyObject);
      }
      var xmp_blob = activeSequence.projectItem.getProjectMetadata();
      var xmp = new XMPMeta(xmp_blob);
      if (xmp.doesPropertyExist(this.kPProPrivateProjectMetadataURI, this.projectField)) {
        var result = xmp.getProperty(
          this.kPProPrivateProjectMetadataURI,
          this.projectField,
        );
        if (result) {
          var x = new XMPMeta(result.value);
          result = this.readXMP(x);
          return result;
        }
      }
    }
    return {};
  },

  readXMP: function(xmp) {
    if (!XMPMeta.getNamespacePrefix(this.schemaNS)) {
      XMPMeta.registerNamespace(this.schemaNS, this.prefix);
    }
    var i;
    var j;
    // Language
    var lang = xmp.getProperty(this.schemaNS, this.languageName);
    if (lang) {
      lang = lang.value;
    }
    var result = { transcripts: [], speakers: {}, lang: lang || 'en-US' };
    // Speaker labels
    var count;
    count = xmp.countArrayItems(this.schemaNS, this.speakerName);
    if (count > 0) {
      for (i = 1; i <= count; i++) {
        result.speakers[i] = xmp.getArrayItem(this.schemaNS, this.speakerName, i).value;
      }
    }
    // Transcripts array
    count = xmp.countArrayItems(this.schemaNS, this.transcriptsName);
    var prevTime = 0;
    if (count > 0) {
      for (i = 1; i <= count; i++) {
        var path = XMPUtils.composeArrayItemPath(this.schemaNS, this.transcriptsName, i);
        var obj = { words: [] };
        var text = xmp.getStructField(this.schemaNS, path, this.schemaNS, 'text').value;
        text = this.splitString(text);
        if (text.length === 0) {
          // We can't return empty arrays.
          text = [''];
        }
        for (j = 0; j < text.length; j++) {
          obj.words.push({ text: text[j] });
        }
        var speaker = xmp.getStructField(this.schemaNS, path, this.schemaNS, 'speaker');
        if (speaker && speaker.value) {
          obj.speaker = parseInt(speaker.value, 10);
        }
        var fieldPath;
        var fieldCount;
        // startTime
        fieldPath = XMPUtils.composeStructFieldPath(
          this.schemaNS,
          path,
          this.schemaNS,
          'startTime',
        );
        fieldCount = xmp.countArrayItems(this.schemaNS, fieldPath);
        if (fieldCount > obj.words.length) {
          fieldCount = obj.words.length;
        }
        for (j = 1; j <= fieldCount; j++) {
          obj.words[j - 1].startTime = parseFloat(
            xmp.getArrayItem(this.schemaNS, fieldPath, j).value,
          );
        }
        var startCount = fieldCount;
        // endTime
        fieldPath = XMPUtils.composeStructFieldPath(
          this.schemaNS,
          path,
          this.schemaNS,
          'endTime',
        );
        fieldCount = xmp.countArrayItems(this.schemaNS, fieldPath);
        if (fieldCount > obj.words.length) {
          fieldCount = obj.words.length;
        }
        for (j = 1; j <= fieldCount; j++) {
          obj.words[j - 1].endTime = parseFloat(
            xmp.getArrayItem(this.schemaNS, fieldPath, j).value,
          );
        }
        if (startCount === 0) {
          // missing all startTimes
          obj.words[0].startTime = prevTime;
        }
        if (fieldCount === 0) {
          // missing all endTimes
          obj.words[0].endTime = obj.words[0].startTime;
        }
        if (startCount > 0) {
          // missing fields
          for (j = startCount; j < obj.words.length; j++) {
            obj.words[j].startTime = obj.words[startCount - 1].endTime;
          }
        }
        if (fieldCount > 0) {
          // missing fields
          for (j = fieldCount; j < obj.words.length; j++) {
            obj.words[j].endTime = obj.words[fieldCount - 1].endTime;
          }
        }
        prevTime = obj.words[obj.words.length - 1].endTime;
        // confidence
        fieldPath = XMPUtils.composeStructFieldPath(
          this.schemaNS,
          path,
          this.schemaNS,
          'confidence',
        );
        fieldCount = xmp.countArrayItems(this.schemaNS, fieldPath);
        if (fieldCount > obj.words.length) {
          fieldCount = obj.words.length;
        }
        for (j = 1; j <= fieldCount; j++) {
          obj.words[j - 1].confidence = parseFloat(
            xmp.getArrayItem(this.schemaNS, fieldPath, j).value,
          );
        }
        // missing fields
        for (j = fieldCount; j < obj.words.length; j++) {
          obj.words[j].confidence = 0;
        }
        result.transcripts.push(obj);
      }
    }
    this.fixTranscripts(result.transcripts);
    return result;
  },

  _getXMPFieldData: function(xmp, value, field) {
    if (xmp.doesPropertyExist(value, field)) {
      var result = xmp.getProperty(value, field);
      if (result) {
        if (result.value.substring(0, 1) === '{') {
          return result.value;
        }
      }
      return {};
    }
    return {};
  },

  _itterate: function(array, length) {
    var items = [];
    var i = 0;
    for (i; i < length; i++) {
      items.push(array[i]);
    }
    return items;
  },

  _getTracks: function(array, length) {
    var items = [];
    length = length || array.length || 0;
    var i = 0;
    for (var i = 0; i < length; i++) {
      items.push({
        name: array[i].projectItem.name,
        id: array[i].projectItem.id,
      });
    }
    return items;
  },

  getAllSequences: function(toJSON) {
    var sequences = [];
    var i = 0;
    for (i; i < app.project.sequences.numSequences; i++) {
      var sequence = app.project.sequences[i];
      sequences.push(sequence);
    }
    if (toJSON) {
      return $._ext_JSON.stringify(sequences);
    }
    return sequences;
  },

  getSequences: function() {
    var _sequenceIds = [];
    var sequences = [];
    var i = 0;
    for (i; i < app.project.sequences.numSequences; i++) {
      var sequence = app.project.sequences[i];
      var seqId = sequence.sequenceID;
      if (_sequenceIds.indexOf(seqId) < 0) {
        sequences.push({
          //id: sequence.id,
          sequenceID: seqId,
          name: sequence.name,
          //videoTracks: this._getTracks(this._itterate(sequence.videoTracks, sequence.videoTracks.numTracks)),
          //audioTracks: this._getTracks(this._itterate(sequence.audioTracks, sequence.audioTracks.numTracks))
        });
        _sequenceIds.push(seqId);
      }
    }
    return JSON.stringify(sequences);
  },

  escapeString: function(s) {
    return s.replace(/[ \\]/g, function(x) {
      return '\\' + x;
    });
  },

  unescapeQuotes: function(string) {
    return string.replace(/[ \\]/g, '').replace(/\\"/g, '"');
  },

  getSequenceMetadata: function(sequenceID, sequenceName) {
    if (!this.initXMP()) {
      return JSON.stringify({});
    }
    var sequence = $._ext_PPRO.searchForSequenceWithID(sequenceID, sequenceName);
    return this.escapeString(
      JSON.stringify(
        this._getXMPFieldData(
          new XMPMeta(sequence.projectItem.getProjectMetadata()),
          this.kPProPrivateProjectMetadataURI,
          this.projectField,
        ),
      ),
    );
  },

  getFileMetadata: function(name) {
    if (!this.initXMP()) {
      return JSON.stringify({});
    }
    var i = 0;
    for (i; i < app.project.rootItem.children.numItems; i++) {
      var projectItem = app.project.rootItem.children[i];
      if (projectItem.name === name) {
        return JSON.stringify(
          this.readSpeechAnalysis(new XMPMeta(projectItem.getXMPMetadata())),
        );
      }
    }
    return JSON.stringify({});
  },

  /***************
      CONFORM
  ***************/

  printFunction: function(where, subObjectKeysString, name) {
    app.enableQE();
    var i = 0;
    var obj;
    if (where === 'app') {
      obj = app;
    } else if (where === 'qe') {
      obj = qe;
    }
    var arr = subObjectKeysString.split(' ');
    for (i; i < arr.length; i++) {
      var key = arr[i];
      if (obj[key]) {
        obj = obj[key];
      }
    }
    return obj[name];
  },

  newBin: function(name, overwrite) {
    if (overwrite) {
      var bin = this.searchForBinWithName(name);
      if (bin) {
        bin.deleteBin();
      }
    }
    var currentBin = app.project.rootItem.createBin(name);
  },

  findChildItemByNameAndType: function(name, type) {
    var foundChild;
    this.getAllRootItemMediaArray().forEach(function(child) {
      if (child.name === name) {
        foundChild = child;
      }
    });
    return this.getAllRootItemMediaArray();
  },

  searchForSequenceByKey: function(key, value) {
    var foundSeq = null;
    var seqCount = app.project.sequences.numSequences;

    for (var i = 0; i < seqCount; i++) {
      var currentSeq = app.project.sequences[i];

      if (currentSeq && currentSeq.projectItem) {
        if (currentSeq.projectItem[key].toString() === value.toString()) {
          foundSeq = currentSeq;
        }
      }
    }
    return foundSeq;
  },

  // using the nodeId is unique
  searchForSequenceWithNodeId: function(nodeId) {
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

  searchForSequenceWithSequenceId: function(sequenceID) {
    var foundSeq = null;
    var seqCount = app.project.sequences.numSequences;

    for (var i = 0; i < seqCount; i++) {
      var currentSeq = app.project.sequences[i];

      if (currentSeq && currentSeq.projectItem) {
        if (currentSeq.sequenceID.toString() === sequenceID.toString()) {
          foundSeq = currentSeq;
        }
      }
    }
    return foundSeq;
  },

  setActiveSequence: function(nodeId, useSequenceID) {
    var sequence = useSequenceID
      ? this.searchForSequenceWithSequenceId(nodeId)
      : this.searchForSequenceWithNodeId(nodeId);
    // app.project.activeSequence = sequence;
  },

  projectItemFromPath: function(projectItemPath, root) {
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

  createSubClipFromTreePath: function(
    treePath,
    newSubClipName,
    startTimeSeconds,
    endTimeSeconds,
    binName,
    overwrite,
  ) {
    var projectItem;
    this.getAllRootItemMediaArray().forEach(function(child) {
      if (child.treePath === treePath) {
        projectItem = child;
      }
    });

    projectItem = app.project.rootItem.children[0];
    var newSubClip = projectItem.createSubClip(
      newSubClipName,
      startTimeSeconds,
      endTimeSeconds,
      0,
      1,
      1,
    );

    if (binName) {
      var bin = this.searchForBinWithName(binName);
      if (bin) {
        newSubClip.moveBin(bin);
      }
    }
    var seq = app.project.activeSequence;
    var vTrack1 = seq.videoTracks[0];
    if (vTrack1.clips.numItems > 0) {
      var lastClip = vTrack1.clips[vTrack1.clips.numItems - 1];
      if (lastClip) {
        vTrack1.insertClip(newSubClip, lastClip.end.seconds);
      }
    } else {
      vTrack1.insertClip(newSubClip, '00;00;00;00');
    }
    return JSON.stringify(newSubClip);
  },

  insertClipByTreePath: function(treePath, startTimeSeconds, endTimeSeconds) {
    var projectItem = this.projectItemFromPath(treePath);
    var seq = app.project.activeSequence;
    var vTrack1 = seq.videoTracks[0];

    if (vTrack1.clips.numItems > 0) {
      var lastClip = vTrack1.clips[vTrack1.clips.numItems - 1];
      if (lastClip) {
        vTrack1.insertClip(projectItem, lastClip.end.seconds);
      }
    } else {
      vTrack1.insertClip(projectItem, '00;00;00;00');
    }
    var clip1 =
      app.project.activeSequence.videoTracks[0].clips[vTrack1.clips.numItems - 1];
    clip1.start = startTimeSeconds;
    clip1.end = endTimeSeconds;
    clip1.inPoint = startTimeSeconds;
    clip1.outPoint = endTimeSeconds;
    clip1.duration = 5;

    var clip1 = app.project.activeSequence.videoTracks[0].clips[0];

    app.project.activeSequence.videoTracks[1].insertClip(clip1.projectItem, clip1.start);

    var clip2 = app.project.activeSequence.videoTracks[1].clips[0];
    if (clip1.start.seconds > clip2.end.seconds) {
      clip2.end = clip1.end;
      clip2.start = clip1.start;
    } else {
      clip2.start = startTimeSeconds;
      clip2.end = endTimeSeconds;
    }
    clip2.inPoint = startTimeSeconds;
    clip2.outPoint = endTimeSeconds;
    clip2.duration = endTimeSeconds;

    return JSON.stringify(clip1);
  },

  insertClipFromSourceMonitor: function() {
    app.enableQE();
    var seq = app.project.activeSequence;
    var vTrack1 = seq.videoTracks[0];
    if (vTrack1.clips.numItems > 0) {
      var lastClip = vTrack1.clips[vTrack1.clips.numItems - 1];
      if (lastClip) {
        vTrack1.insertClip(qe.source.clip, lastClip.end.seconds);
      }
    } else {
      vTrack1.insertClip(qe.source.clip, '00;00;00;00');
    }
  },

  openInSourceMonitor: function(treePath, timecode) {
    if (app.sourceMonitor) {
      app.sourceMonitor.openFilePath(this.projectItemFromPath(treePath).getMediaPath());
    } else {
      app.enableQE();
      var projectItem = this.projectItemFromPath(treePath);
      if (projectItem) {
        qe.source.openFilePath(projectItem.getMediaPath());
      }
    }
    if (timecode) {
      app.enableQE();
      qe.source.player.startScrubbing();
      qe.source.player.scrubTo(timecode);
      qe.source.player.endScrubbing();
      qe.source.player.step();
    }
  },

  getSequenceClips: function(sequence) {
    var result = [];
    var trackGroups = [sequence.audioTracks, sequence.videoTracks];
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
              outPoint: clip.outPoint,
            };
            result.push(i);
          }
        }
      }
    }
    return result;
  },

  getClipMediaStartFromTreePath: function(treePath, returnObject) {
    if (!this.initXMP()) {
      return $._ext_JSON.stringify(this.emptyObject);
    }
    var projectItem = this.projectItemFromPath(treePath);
    var kPProPrivateProjectMetadataURI =
      'http://ns.adobe.com/premierePrivateProjectMetaData/1.0/';
    var mediaStartField = 'Column.Intrinsic.MediaStart';
    var result = {};
    // Handle subclips
    var projectMetadata = projectItem.getProjectMetadata();
    var projXMP = new XMPMeta(projectMetadata);
    if (projXMP.doesPropertyExist(kPProPrivateProjectMetadataURI, mediaStartField)) {
      var mediaStart = projXMP.getProperty(
        kPProPrivateProjectMetadataURI,
        mediaStartField,
      ).value;
      result.mediaStart = mediaStart;
    }
    var xmpBlob = projectItem.getXMPMetadata();
    var xmp = new XMPMeta(xmpBlob);
    var timecodeField = 'startTimecode';
    if (xmp.doesPropertyExist(XMPConst.NS_DM, 'altTimecode')) {
      timecodeField = 'altTimecode';
    }
    if (xmp.doesPropertyExist(XMPConst.NS_DM, timecodeField)) {
      result.startTimecode = xmp.getStructField(
        XMPConst.NS_DM,
        timecodeField,
        XMPConst.NS_DM,
        'timeValue',
      ).value;
      var format = xmp.getStructField(
        XMPConst.NS_DM,
        timecodeField,
        XMPConst.NS_DM,
        'timeFormat',
      ).value;
      switch (format) {
        case '24Timecode':
          result.frameRate = 24;
          break;
        case '25Timecode':
          result.frameRate = 25;
          break;
        case '2997DropTimecode':
          result.frameRate = 29.97;
          result.dropFrame = true;
          break;
        case '2997NonDropTimecode':
          result.frameRate = 29.97;
          result.dropFrame = false;
          break;
        case '30Timecode':
          result.frameRate = 30;
          break;
        case '50Timecode':
          result.frameRate = 50;
          break;
        case '5994DropTimecode':
          result.frameRate = 59.94;
          result.dropFrame = true;
          break;
        case '5994NonDropTimecode':
          result.frameRate = 59.94;
          result.dropFrame = false;
          break;
        case '60Timecode':
          result.frameRate = 60;
          break;
        case '23976Timecode':
          result.frameRate = 23.976;
          result.dropFrame = false;
          break;
        default:
          break;
      }
    } else if (xmp.doesPropertyExist(XMPConst.NS_DM, 'videoFrameRate')) {
      result.frameRate = parseFloat(
        xmp.getProperty(XMPConst.NS_DM, 'videoFrameRate').value,
      );
    } else if (xmp.doesPropertyExist(XMPConst.NS_DM, 'audioSampleRate')) {
      result.frameRate = parseInt(
        xmp.getProperty(XMPConst.NS_DM, 'audioSampleRate').value,
        10,
      );
    }
    if (returnObject) {
      return result;
    }
    return $._ext_JSON.stringify(result);
  },

  addClipToSequenceTimeline: function(treePath, inTime, outTime, overwrite) {
    this.openInSourceMonitor(treePath);
    app.enableQE();
    qe.source.clip.setInPoint(inTime);
    qe.source.clip.setOutPoint(outTime);
    this.insertOrAppend(treePath, overwrite);
    return true;
  },

  setClipInOutPoints: function(treePath, inTime, outTime) {
    app.enableQE();
    qe.source.clip.setInPoint(inTime);
    qe.source.clip.setOutPoint(outTime);
    return true;
  },

  printVTrack: function() {
    var activeSequence = app.project.activeSequence;
    return $._ext_JSON.stringify(Object.keys(activeSequence.videoTracks[0].prototype));
  },

  findClipByName: function(name, toJSON) {
    var foundChild;
    var allSequences = this.getAllSequences();
    this.getAllRootItemMediaArray().forEach(function(child) {
      var isChildASeq = false;
      /*for (var i = 0; i < allSequences.length; i++) {
        if (allSequences[i].projectItem.nodeId === child.nodeId) {
          isChildASeq = true
          break;
        }
      }*/
      if (!!child.treePath.match(new RegExp(name, 'g')) && !isChildASeq) {
        foundChild = child;
      }
    });
    if (toJSON) {
      return $._ext_JSON.stringify(foundChild);
    }
    return foundChild;
  },

  extractFrameRate: function(name, toJSON) {
    var result = this.extractFrameRateFromXMP(this.findClipXMP(name));
    if (toJSON) {
      return $._ext_JSON.stringify(result);
    }
    return result;
  },

  extractFrameRateFromXMP: function(xmp, toJSON) {
    var result = {};
    this.initXMP();
    var timecodeField = 'startTimecode';
    if (xmp.doesPropertyExist(XMPConst.NS_DM, timecodeField)) {
      result.startTimecode = xmp.getStructField(
        XMPConst.NS_DM,
        timecodeField,
        XMPConst.NS_DM,
        'timeValue',
      ).value;
      var format = xmp.getStructField(
        XMPConst.NS_DM,
        timecodeField,
        XMPConst.NS_DM,
        'timeFormat',
      ).value;
      switch (format) {
        case '24Timecode':
          result.frameRate = 24;
          break;
        case '25Timecode':
          result.frameRate = 25;
          break;
        case '2997DropTimecode':
          result.frameRate = 29.97;
          result.dropFrame = true;
          break;
        case '2997NonDropTimecode':
          result.frameRate = 29.97;
          result.dropFrame = false;
          break;
        case '30Timecode':
          result.frameRate = 30;
          break;
        case '50Timecode':
          result.frameRate = 50;
          break;
        case '5994DropTimecode':
          result.frameRate = 59.94;
          result.dropFrame = true;
          break;
        case '5994NonDropTimecode':
          result.frameRate = 59.94;
          result.dropFrame = false;
          break;
        case '60Timecode':
          result.frameRate = 60;
          break;
        case '23976Timecode':
          result.frameRate = 23.976;
          result.dropFrame = false;
          break;
        default:
          break;
      }
    } else if (xmp.doesPropertyExist(XMPConst.NS_DM, 'videoFrameRate')) {
      result.frameRate = parseFloat(
        xmp.getProperty(XMPConst.NS_DM, 'videoFrameRate').value,
      );
    } else if (xmp.doesPropertyExist(XMPConst.NS_DM, 'audioSampleRate')) {
      result.frameRate = parseInt(
        xmp.getProperty(XMPConst.NS_DM, 'audioSampleRate').value,
        10,
      );
    }
    if (toJSON) {
      return $._ext_JSON.stringify(result);
    }
    return result;
  },

  findClipXMP: function(name, toJSON) {
    var xmpBlob = this.findClipByName(name).getXMPMetadata();
    var xmp = new XMPMeta(xmpBlob);
    if (toJSON) {
      return $._ext_JSON.stringify({ data: xmp.serialize() });
    }
    return xmp;
  },

  findClipByTreePath: function(treePath) {
    var foundChild;
    var activeSequence = app.project.activeSequence;
    this.getAllRootItemMediaArray().forEach(function(child) {
      if (child.treePath === treePath) {
        foundChild = child;
      }
    });

    return foundChild;

    return $._ext_JSON.stringify(
      $._ext_UTILS.itterate(
        activeSequence.videoTracks,
        activeSequence.videoTracks.numItems,
      ),
    );

    $._ext_UTILS
      ._itterate(activeSequence.videoTracks, activeSequence.videoTracks.numItems)
      .forEach(function(child) {});

    var trackGroups = [foundChild.audioTracks, foundChild.videoTracks];
    return $._ext_JSON.stringify(foundChild);

    $._ext_UTILS
      .recurrsiveChildrenItterate(
        app.project.rootItem.children,
        app.project.rootItem.children.numItems,
      )
      .forEach(function(child) {
        return $._ext_JSON.stringify({ treePath: child.treePath });
        if (child.treePath === treePath) {
          return $._ext_JSON.stringify(child);
        }
      });
    if (app.project.rootItem.children.numItems > 0) {
      var projectItem = app.project.rootItem.children[0]; // assumes first item is footage.
      if (projectItem) {
        if (
          projectItem.type == ProjectItemType.CLIP ||
          projectItem.type == ProjectItemType.FILE
        ) {
          markers = projectItem.getMarkers();

          if (markers) {
            var num_markers = markers.numMarkers;

            var new_marker = markers.createMarker(12.345);

            var guid = new_marker.guid; // new in 11.1

            new_marker.name = 'Marker created by PProPanel.';
            new_marker.comments = 'Here are some comments, inserted by PProPanel.';
            new_marker.end = 15.6789;

            //default marker type == comment. To change marker type, call one of these:

            // new_marker.setTypeAsChapter();
            // new_marker.setTypeAsWebLink();
            // new_marker.setTypeAsSegmentation();
            // new_marker.setTypeAsComment();
          }
        } else {
          $._PPP_.updateEventPanel('Can only add markers to footage items.');
        }
      } else {
        $._PPP_.updateEventPanel('Could not find first projectItem.');
      }
    } else {
      $._PPP_.updateEventPanel('Project is empty.');
    }
  },

  getAllRootItemMediaArray: function() {
    var allMediaProjectItems = [];
    var i = 0;
    for (i; i < app.project.rootItem.children.numItems; i++) {
      var projectItem = app.project.rootItem.children[i];
      if (projectItem.children) {
        allMediaProjectItems = allMediaProjectItems.concat(
          $._ext_UTILS.recurrsiveChildrenItterate(
            projectItem.children,
            projectItem.children.numItems,
          ),
        );
      } else {
        allMediaProjectItems.push(projectItem);
      }
    }
    return allMediaProjectItems;
  },

  getAllRootItemMedia: function() {
    var allMediaProjectItems = [];
    var i = 0;
    for (i; i < app.project.rootItem.children.numItems; i++) {
      var projectItem = app.project.rootItem.children[i];
      if (projectItem.children) {
        allMediaProjectItems = allMediaProjectItems.concat(
          $._ext_UTILS.recurrsiveChildrenItterate(
            projectItem.children,
            projectItem.children.numItems,
          ),
        );
      } else {
        allMediaProjectItems.push(projectItem);
      }
    }
    return allMediaProjectItems;
  },

  /***************
      /////////
  ***************/

  getTree: function() {
    return $._ext_JSON.stringify({
      sequences: $._ext_UTILS
        .itterate(app.project.sequences, app.project.sequences.numSequences)
        .map(function(item) {
          return {
            name: item.name,
            treePath: item.projectItem.treePath,
            sequenceID: item.sequenceID,
            nodeId: item.projectItem.nodeId, // not availabe in 2015
          };
        }),
      rootItems: this.getAllRootItemMedia().map(function(item) {
        return {
          name: item.name,
          nodeId: item.nodeId, // not availabe in 2015
          treePath: item.treePath,
          videoTracks: item.videoTracks,
          audioTracks: item.audioTracks,
        };
      }),
    });
  },

  getVersionInfo: function() {
    return 'PPro ' + app.version + 'x' + app.build;
  },

  getUserName: function() {
    var homeDir = new File('~/');
    var userName = homeDir.displayName;
    homeDir.close();
    return userName;
  },

  keepPanelLoaded: function() {
    app.setExtensionPersistent('com.adobe.PProPanel', 0); // 0, while testing (to enable rapid reload); 1 for "Never unload me, even when not visible."
  },

  updateGrowingFile: function() {
    var numItems = app.project.rootItem.children.numItems;
    for (var i = 0; i < numItems; i++) {
      var currentItem = app.project.rootItem.children[i];
      if (currentItem) {
        currentItem.refreshMedia();
      }
    }
  },

  getSep: function() {
    if (Folder.fs == 'Macintosh') {
      return '/';
    } else {
      return '\\';
    }
  },

  saveProject: function() {
    app.project.save();
  },

  exportCurrentFrameAsPNG: function() {
    app.enableQE();
    var activeSequence = qe.project.getActiveSequence(); // note: make sure a sequence is active in PPro UI
    if (activeSequence) {
      var time = activeSequence.CTI.timecode; // CTI = Current Time Indicator.

      var removeThese = /:|;/gi; // Why? Because Windows chokes on colons.
      time = time.replace(removeThese, '_');
      var outputPath = new File('~/Desktop');
      var outputFileName =
        outputPath.fsName + $._PPP_.getSep() + time + '___' + activeSequence.name;

      activeSequence.exportFramePNG(time, outputFileName);
    } else {
      $._PPP_.updateEventPanel('No active sequence.');
    }
  },

  renameFootage: function() {
    var item = app.project.rootItem.children[0]; // assumes the zero-th item in the project is footage.
    if (item) {
      item.name = item.name + ', updated by PProPanel.';
    } else {
      $._PPP_.updateEventPanel('No project items found.');
    }
  },

  getActiveSequenceName: function() {
    if (app.project.activeSequence) {
      return app.project.activeSequence.name;
    } else {
      return 'No active sequence.';
    }
  },

  registerProjectPanelChangedFxn: function() {
    success = app.bind(
      'onSourceClipSelectedInProjectPanel',
      $._PPP_.projectPanelSelectionChanged,
    );
  },

  projectPanelSelectionChanged: function() {
    var remainingArgs = arguments.length;
    var message = arguments.length + ' items selected: ';

    for (var i = 0; i < arguments.length; i++) {
      message += arguments[i].name;
      remainingArgs--;
      if (remainingArgs > 1) {
        message += ', ';
      }
      if (remainingArgs === 1) {
        message += ', and ';
      }
      if (remainingArgs === 0) {
        message += '.';
      }
    }
    app.setSDKEventMessage(message, 'info');
  },

  getProjectPanelMeta: function() {
    $._PPP_.updateEventPanel(app.project.getProjectPanelMetadata());
  },

  setProjectPanelMeta: function() {
    metadata =
      "<?xml version='1.0'?><md.paths version='1.0'><metadata_path><internal>true</internal><namespace>http://ns.adobe.com/exif/1.0/</namespace><description>ColorSpace</description><entry_name>ColorSpace</entry_name><parent_id>http://ns.adobe.com/exif/1.0/</parent_id></metadata_path><metadata_path><internal>false</internal><namespace>http://amwa.tv/mxf/as/11/core/</namespace><description>audioTrackLayout</description><entry_name>audioTrackLayout</entry_name><parent_id>http://amwa.tv/mxf/as/11/core/</parent_id></metadata_path><metadata_path><internal>false</internal><namespace>http://ns.useplus.org/ldf/xmp/1.0/</namespace><description>ImageCreator</description><entry_name>ImageCreator</entry_name><parent_id>http://ns.useplus.org/ldf/xmp/1.0/</parent_id></metadata_path></md.paths>";
    app.project.setProjectPanelMetadata(metadata);
  },

  exportSequenceAsPrProj: function() {
    var activeSequence = app.project.activeSequence;
    if (activeSequence) {
      var startTimeOffset = activeSequence.zeroPoint;
      var prProjExtension = '.prproj';
      var outputName = activeSequence.name;
      var outFolder = Folder.selectDialog();

      if (outFolder) {
        var completeOutputPath =
          outFolder.fsName + $._PPP_.getSep() + outputName + prProjExtension;

        app.project.activeSequence.exportAsProject(completeOutputPath);

        $._PPP_.updateEventPanel(
          'Exported ' +
            app.project.activeSequence.name +
            ' to ' +
            completeOutputPath +
            '.',
        );
      } else {
        $._PPP_.updateEventPanel('Could not find or create output folder.');
      }

      // Here's how to import N sequences from a project.
      //
      // var seqIDsToBeImported = new Array;
      // seqIDsToBeImported[0] = ID1;
      // ...
      // seqIDsToBeImported[N] = IDN;
      //
      //app.project.importSequences(pathToPrProj, seqIDsToBeImported);
    } else {
      $._PPP_.updateEventPanel('No active sequence.');
    }
  },

  createSequenceMarkers: function() {
    var activeSequence = app.project.activeSequence;
    if (activeSequence) {
      var markers = activeSequence.markers;
      if (markers) {
        var numMarkers = markers.numMarkers;
        if (numMarkers > 0) {
          var marker_index = 1;
          for (
            var current_marker = markers.getFirstMarker();
            current_marker !== undefined;
            current_marker = markers.getNextMarker(current_marker)
          ) {
            if (current_marker.name !== '') {
              $._PPP_.updateEventPanel(
                'Marker ' + marker_index + ' name = ' + current_marker.name + '.',
              );
            } else {
              $._PPP_.updateEventPanel('Marker ' + marker_index + ' has no name.');
            }

            if (current_marker.end.seconds > 0) {
              $._PPP_.updateEventPanel(
                'Marker ' +
                  marker_index +
                  ' duration = ' +
                  (current_marker.end.seconds - current_marker.start.seconds) +
                  ' seconds.',
              );
            } else {
              $._PPP_.updateEventPanel('Marker ' + marker_index + ' has no duration.');
            }
            $._PPP_.updateEventPanel(
              'Marker ' +
                marker_index +
                ' starts at ' +
                current_marker.start.seconds +
                ' seconds.',
            );
            marker_index = marker_index + 1;
          }
        }
      }

      var newCommentMarker = markers.createMarker(12.345);
      newCommentMarker.name = 'Marker created by PProPanel.';
      newCommentMarker.comments = 'Here are some comments, inserted by PProPanel.';
      newCommentMarker.end = 15.6789;

      var newWebMarker = markers.createMarker(14.345);
      newWebMarker.name = 'Web marker created by PProPanel.';
      newWebMarker.comments = 'Here are some comments, inserted by PProPanel.';
      newWebMarker.end = 17.6789;
      newWebMarker.setTypeAsWebLink('http://www.adobe.com', 'frame target');
    } else {
      $._PPP_.updateEventPanel('No active sequence.');
    }
  },

  exportFCPXML: function() {
    if (app.project.activeSequence) {
      var projPath = new File(app.project.path);
      var parentDir = projPath.parent;
      var outputName = app.project.activeSequence.name;
      var xmlExtension = '.xml';
      var outputPath = Folder.selectDialog('Choose the output directory');

      if (outputPath) {
        var completeOutputPath =
          outputPath.fsName + $._PPP_.getSep() + outputName + xmlExtension;
        app.project.activeSequence.exportAsFinalCutProXML(completeOutputPath, 1); // 1 == suppress UI
        var info =
          'Exported FCP XML for ' +
          app.project.activeSequence.name +
          ' to ' +
          completeOutputPath +
          '.';
        $._PPP_.updateEventPanel(info);
      } else {
        $._PPP_.updateEventPanel('No output path chosen.');
      }
    } else {
      $._PPP_.updateEventPanel('No active sequence.');
    }
  },

  openInSource: function() {
    var fileToOpen = File.openDialog('Choose file to open.', 0, false);
    if (fileToOpen) {
      app.sourceMonitor.openFilePath(fileToOpen.fsName);
      app.sourceMonitor.play(1.73); // playback speed as float, 1.0 = normal speed forward
      fileToOpen.close();
    } else {
      $._PPP_.updateEventPanel('No file chosen.');
    }
  },

  searchForBinWithName: function(nameToFind) {
    // deep-search a folder by name in project
    var deepSearchBin = function(inFolder) {
      if (inFolder && inFolder.name === nameToFind && inFolder.type === 2) {
        return inFolder;
      } else {
        for (var i = 0; i < inFolder.children.numItems; i++) {
          if (inFolder.children[i] && inFolder.children[i].type === 2) {
            var foundBin = deepSearchBin(inFolder.children[i]);
            if (foundBin) return foundBin;
          }
        }
      }
      return undefined;
    };
    return deepSearchBin(app.project.rootItem);
  },

  importFiles: function() {
    if (app.project) {
      var fileOrFilesToImport = File.openDialog(
        'Choose files to import', // title
        0, // filter available files?
        true,
      ); // allow multiple?

      // New in 11.1; you can determine which bin will be targeted, before importing.

      var currentTargetBin = app.project.getInsertionBin();

      if (currentTargetBin.nodeId === app.project.rootItem.nodeId) {
        // If we're here, then the target bin is the root of the project.
      }
      if (fileOrFilesToImport) {
        // Of course, panels are welcome to override that default insertion bin behavior... :)
        var targetBin = $._PPP_.getPPPInsertionBin();
        if (targetBin) {
          targetBin.select();
          // We have an array of File objects; importFiles() takes an array of paths.
          var importThese = [];
          if (importThese) {
            for (var i = 0; i < fileOrFilesToImport.length; i++) {
              importThese[i] = fileOrFilesToImport[i].fsName;
            }
            app.project.importFiles(
              importThese,
              1, // suppress warnings
              targetBin,
              0,
            ); // import as numbered stills
          }
        } else {
          $._PPP_.updateEventPanel('Could not find or create target bin.');
        }
      }
    }
  },

  muteFun: function() {
    if (app.project.activeSequence) {
      for (var i = 0; i < app.project.activeSequence.audioTracks.numTracks; i++) {
        var currentTrack = app.project.activeSequence.audioTracks[i];
        if (Math.random() > 0.5) {
          currentTrack.setMute(!currentTrack.isMuted());
        }
      }
    } else {
      $._PPP_.updateEventPanel('No active sequence found.');
    }
  },

  disableImportWorkspaceWithProjects: function() {
    var prefToModify = 'FE.Prefs.ImportWorkspace';
    var appProperties = app.properties;

    if (appProperties) {
      var propertyExists = app.properties.doesPropertyExist(prefToModify);
      var propertyIsReadOnly = app.properties.isPropertyReadOnly(prefToModify);
      var propertyValue = app.properties.getProperty(prefToModify);

      // optional third parameter possible: 0 = non-persistent,  1 = persistent (default)
      appProperties.setProperty(prefToModify, false, 1);
      var safetyCheck = app.properties.getProperty(prefToModify);

      if (safetyCheck != propertyValue) {
        $._PPP_.updateEventPanel(
          "Changed 'Import Workspaces with Projects' from " +
            propertyValue +
            ' to ' +
            safetyCheck +
            '.',
        );
      }
    } else {
      $._PPP_.updateEventPanel('Properties not found.');
    }
  },

  replaceMedia: function() {
    //  Note:   This method of changing paths for projectItems is from the time
    //      before PPro supported full-res AND proxy paths for each projectItem.
    //      This can still be used, and will change the hi-res projectItem path, but
    //      if your panel supports proxy workflows, it should rely instead upon
    //      projectItem.setProxyPath() instead.

    var firstProjectItem = app.project.rootItem.children[0];
    if (firstProjectItem) {
      if (firstProjectItem.canChangeMediaPath()) {
        //  NEW in 9.0: setScaleToFrameSize() ensures that for all clips created from this footage,
        //  auto scale to frame size will be ON, regardless of the current user preference.
        //  This is important for proxy workflows, to avoid mis-scaling upon replacement.

        //  Addendum: This setting will be in effect the NEXT time the projectItem is added to a
        //  sequence; it will not affect or reinterpret clips from this projectItem, already in
        //  sequences.

        firstProjectItem.setScaleToFrameSize();

        var replacementMedia = File.openDialog(
          'Choose new media file, for ' + firstProjectItem.name,
          0, // file filter
          false,
        ); // allow multiple?

        if (replacementMedia) {
          firstProjectItem.name =
            replacementMedia.name + ', formerly known as ' + firstProjectItem.name;
          firstProjectItem.changeMediaPath(replacementMedia.fsName);
          replacementMedia.close();
        }
      } else {
        $._PPP_.updateEventPanel(
          "Couldn't change path of " + firstProjectItem.name + '.',
        );
      }
    } else {
      $._PPP_.updateEventPanel('No project items found.');
    }
  },

  openProject: function() {
    var filterString = '';
    if (Folder.fs === 'Windows') {
      filterString = 'All files:*.*';
    }
    var projToOpen = File.openDialog('Choose project:', filterString, false);
    if (projToOpen && projToOpen.exists) {
      app.openDocument(
        projToOpen.fsName,
        1, // suppress 'Convert Project' dialogs?
        1, // suppress 'Locate Files' dialogs?
        1,
      ); // suppress warning dialogs?
      projToOpen.close();
    }
  },

  exportFramesForMarkers: function() {
    app.enableQE();
    var activeSequence = app.project.activeSequence;
    if (activeSequence) {
      var markers = activeSequence.markers;
      var markerCount = markers.numMarkers;
      if (markerCount > 0) {
        var firstMarker = markers.getFirstMarker();

        activeSequence.setPlayerPosition(firstMarker.start.ticks);

        $._PPP_.exportCurrentFrameAsPNG();

        var previousMarker = 0;

        if (firstMarker) {
          for (var i = 0; i < markerCount; i++) {
            if (i === 0) {
              currentMarker = markers.getNextMarker(firstMarker);
            } else {
              currentMarker = markers.getNextMarker(previousMarker);
            }
            if (currentMarker) {
              activeSequence.setPlayerPosition(currentMarker.start.ticks);
              previousMarker = currentMarker;
              $._PPP_.exportCurrentFrameAsPNG();
            }
          }
        }
      } else {
        $._PPP_.updateEventPanel('No markers applied to ' + activeSequence.name + '.');
      }
    } else {
      $._PPP_.updateEventPanel('No active sequence.');
    }
  },

  createSequence: function(name, someID, deleteSequenceWithMatchingName, binName) {
    if (deleteSequenceWithMatchingName) {
      var sequence = this.searchForSequenceByKey('name', name);
      if (sequence) {
        app.project.deleteSequence(sequence);
      }
    }
    var someID = someID || 'xyz123';
    var seqName =
      name || prompt('Name of sequence?', '<<<default>>>', 'Sequence Naming Prompt');
    var seq = app.project.createNewSequence(seqName, someID);
    if (binName) {
      var bin = this.searchForBinWithName(binName);
      if (bin) {
        seq.projectItem.moveBin(bin);
      }
    }
  },

  cloneSequence: function() {
    var activeSequence = app.project.activeSequence;
    activeSequence.clone();
    // app.project.activeSequence = activeSequence.clone();
  },

  createSequenceFromPreset: function(
    name,
    presetPath,
    deleteSequenceWithMatchingName,
    deleteSequenceByNodeId,
  ) {
    if (deleteSequenceWithMatchingName) {
      var sequence = this.searchForSequenceByKey('name', name);
      if (sequence) {
        app.project.deleteSequence(sequence);
      }
    }
    if (deleteSequenceByNodeId) {
      var sequence = this.searchForSequenceByKey('nodeId', deleteSequenceByNodeId);
      if (sequence) {
        app.project.deleteSequence(sequence);
      }
    }
    var seqName =
      name || prompt('Name of sequence?', '<<<default>>>', 'Sequence Naming Prompt');
    app.enableQE();
    qe.project.newSequence(seqName, presetPath);
    return $._ext_JSON.stringify(this.searchForSequenceByKey('name', seqName));
  },
  /*
    createSequenceFromPreset: function(presetPath) {
      app.enableQE();
      var seqName = prompt('Name of sequence?', '<<<default>>>', 'Sequence Naming Prompt');
      if (seqName) {
        qe.project.newSequence(seqName, presetPath);
      }
    },*/

  transcode: function(outputPresetPath) {
    app.encoder.bind('onEncoderJobComplete', $._PPP_.onEncoderJobComplete);
    app.encoder.bind('onEncoderJobError', $._PPP_.onEncoderJobError);
    app.encoder.bind('onEncoderJobProgress', $._PPP_.onEncoderJobProgress);
    app.encoder.bind('onEncoderJobQueued', $._PPP_.onEncoderJobQueued);
    app.encoder.bind('onEncoderJobCanceled', $._PPP_.onEncoderJobCanceled);

    var firstProjectItem = app.project.rootItem.children[0];
    if (firstProjectItem) {
      app.encoder.launchEncoder(); // This can take a while; let's get the ball rolling.

      var fileOutputPath = Folder.selectDialog('Choose the output directory');
      if (fileOutputPath) {
        var outputName = firstProjectItem.name.search('[.]');
        if (outputName == -1) {
          outputName = firstProjectItem.name.length;
        }
        outFileName = firstProjectItem.name.substr(0, outputName);
        outFileName = outFileName.replace('/', '-');
        var completeOutputPath =
          fileOutputPath.fsName + $._PPP_.getSep() + outFileName + '.mxf';
        var removeFromQueue = false;
        var rangeToEncode = app.encoder.ENCODE_IN_TO_OUT;
        app.encoder.encodeProjectItem(
          firstProjectItem,
          completeOutputPath,
          outputPresetPath,
          rangeToEncode,
          removeFromQueue,
        );
        app.encoder.startBatch();
      }
    } else {
      $._PPP_.updateEventPanel('No project items found.');
    }
  },

  transcodeExternal: function(outputPresetPath) {
    app.encoder.launchEncoder();
    var fileToTranscode = File.openDialog('Choose file to open.', 0, false);
    if (fileToTranscode) {
      var fileOutputPath = Folder.selectDialog('Choose the output directory');
      if (fileOutputPath) {
        var srcInPoint = 1.0; // encode start time at 1s (optional--if omitted, encode entire file)
        var srcOutPoint = 3.0; // encode stop time at 3s (optional--if omitted, encode entire file)
        var removeFromQueue = false;

        var result = app.encoder.encodeFile(
          fileToTranscode.fsName,
          fileOutputPath.fsName,
          outputPresetPath,
          removeFromQueue,
          srcInPoint,
          srcOutPoint,
        );
      }
    }
  },

  render: function(outputPresetPath) {
    app.enableQE();
    var activeSequence = qe.project.getActiveSequence(); // we use a QE DOM function, to determine the output extension.
    if (activeSequence) {
      app.encoder.launchEncoder(); // This can take a while; let's get the ball rolling.

      var timeSecs = activeSequence.CTI.secs; // Just for reference, here's how to access the CTI
      var timeFrames = activeSequence.CTI.frames; // (Current Time Indicator), for the active sequence.
      var timeTicks = activeSequence.CTI.ticks;
      var timeString = activeSequence.CTI.timecode;

      var seqInPoint = app.project.activeSequence.getInPoint(); // new in 9.0
      var seqOutPoint = app.project.activeSequence.getOutPoint(); // new in 9.0

      var projPath = new File(app.project.path);
      var outputPath = Folder.selectDialog('Choose the output directory');

      if (outputPath && projPath.exists) {
        var outPreset = new File(outputPresetPath);
        if (outPreset.exists === true) {
          var outputFormatExtension = activeSequence.getExportFileExtension(
            outPreset.fsName,
          );
          if (outputFormatExtension) {
            var outputFilename = activeSequence.name + '.' + outputFormatExtension;

            var fullPathToFile =
              outputPath.fsName +
              $._PPP_.getSep() +
              activeSequence.name +
              '.' +
              outputFormatExtension;

            var outFileTest = new File(fullPathToFile);

            if (outFileTest.exists) {
              var destroyExisting = confirm(
                'A file with that name already exists; overwrite?',
                false,
                'Are you sure...?',
              );
              if (destroyExisting) {
                outFileTest.remove();
                outFileTest.close();
              }
            }

            app.encoder.bind('onEncoderJobComplete', $._PPP_.onEncoderJobComplete);
            app.encoder.bind('onEncoderJobError', $._PPP_.onEncoderJobError);
            app.encoder.bind('onEncoderJobProgress', $._PPP_.onEncoderJobProgress);
            app.encoder.bind('onEncoderJobQueued', $._PPP_.onEncoderJobQueued);
            app.encoder.bind('onEncoderJobCanceled', $._PPP_.onEncoderJobCanceled);

            // use these 0 or 1 settings to disable some/all metadata creation.

            app.encoder.setSidecarXMPEnabled(0);
            app.encoder.setEmbeddedXMPEnabled(0);

            /*

            For reference, here's how to export from within PPro (blocking further user interaction).

            var seq = app.project.activeSequence;

            if (seq) {
              seq.exportAsMediaDirect(fullPathToFile,
                          outPreset.fsName,
                          app.encoder.ENCODE_WORKAREA);

              Bonus: Here's how to compute a sequence's duration, in ticks. 254016000000 ticks/second.
              var sequenceDuration = app.project.activeSequence.end - app.project.activeSequence.zeroPoint;
            }

            */

            var jobID = app.encoder.encodeSequence(
              app.project.activeSequence,
              fullPathToFile,
              outPreset.fsName,
              app.encoder.ENCODE_WORKAREA,
              1,
            ); // Remove from queue upon successful completion?
            $._PPP_.message('jobID = ' + jobID);
            outPreset.close();
          }
        } else {
          $._PPP_.updateEventPanel('Could not find output preset.');
        }
      } else {
        $._PPP_.updateEventPanel('Could not find/create output path.');
      }
      projPath.close();
    } else {
      $._PPP_.updateEventPanel('No active sequence.');
    }
  },

  saveProjectAs: function() {
    var sessionCounter = 1;
    var outputPath = Folder.selectDialog('Choose the output directory');
    if (outputPath) {
      var absPath = outputPath.fsName;
      var outputName = String(app.project.name);
      var array = outputName.split('.', 2);

      outputName = array[0] + sessionCounter + '.' + array[1];
      sessionCounter++;

      var fullOutPath = absPath + $._PPP_.getSep() + outputName;
      app.project.saveAs(fullOutPath);
      app.openDocument(
        fullOutPath,
        1, // suppress 'Convert Project?' dialogs
        1, // suppress 'Locate Files' dialogs
        1,
      ); // suppress warning dialogs
    }
  },

  mungeXMP: function() {
    var projectItem = app.project.rootItem.children[0]; // assumes first item is footage.
    if (projectItem) {
      if (ExternalObject.AdobeXMPScript === undefined) {
        ExternalObject.AdobeXMPScript = new ExternalObject('lib:AdobeXMPScript');
      }

      if (ExternalObject.AdobeXMPScript !== undefined) {
        // safety-conscious!

        var xmpBlob = projectItem.getXMPMetadata();
        var xmp = new XMPMeta(xmpBlob);
        var oldSceneVal = '';
        var oldDMCreatorVal = '';

        if (xmp.doesPropertyExist(XMPConst.NS_DM, 'scene') === true) {
          var myScene = xmp.getProperty(XMPConst.NS_DM, 'scene');
          oldSceneVal = myScene.value;
        }

        if (xmp.doesPropertyExist(XMPConst.NS_DM, 'creator') === true) {
          var myCreator = xmp.getProperty(XMPConst.NS_DM, 'creator');
          oldCreatorVale = myCreator.value;
        }

        // Regardless of whether there WAS scene or creator data, set scene and creator data.

        xmp.setProperty(
          XMPConst.NS_DM,
          'scene',
          oldSceneVal + ' Added by PProPanel sample!',
        );
        xmp.setProperty(
          XMPConst.NS_DM,
          'creator',
          oldDMCreatorVal + ' Added by PProPanel sample!',
        );

        // That was the NS_DM creator; here's the NS_DC creator.

        var creatorProp = 'creator';
        var containsDMCreatorValue = xmp.doesPropertyExist(XMPConst.NS_DC, creatorProp);
        var numCreatorValuesPresent = xmp.countArrayItems(XMPConst.NS_DC, creatorProp);
        var CreatorsSeparatedBy4PoundSigns = '';

        if (numCreatorValuesPresent > 0) {
          for (var z = 0; z < numCreatorValuesPresent; z++) {
            CreatorsSeparatedBy4PoundSigns =
              CreatorsSeparatedBy4PoundSigns +
              xmp.getArrayItem(XMPConst.NS_DC, creatorProp, z + 1);
            CreatorsSeparatedBy4PoundSigns = CreatorsSeparatedBy4PoundSigns + '####';
          }
          $._PPP_.updateEventPanel(CreatorsSeparatedBy4PoundSigns);

          if (confirm('Replace previous?', false, 'Replace existing Creator?')) {
            xmp.deleteProperty(XMPConst.NS_DC, 'creator');
          }
          xmp.appendArrayItem(
            XMPConst.NS_DC, // If no values exist, appendArrayItem will create a value.
            creatorProp,
            numCreatorValuesPresent + ' creator values were already present.',
            null,
            XMPConst.ARRAY_IS_ORDERED,
          );
        } else {
          xmp.appendArrayItem(
            XMPConst.NS_DC,
            creatorProp,
            'PProPanel wrote the first value into NS_DC creator field.',
            null,
            XMPConst.ARRAY_IS_ORDERED,
          );
        }
        var xmpAsString = xmp.serialize(); // either way, serialize and write XMP.
        projectItem.setXMPMetadata(xmpAsString);
      }
    } else {
      $._PPP_.updateEventPanel('Project item required.');
    }
  },

  getProductionByName: function(nameToGet) {
    var production;
    for (var i = 0; i < productionList.numProductions; i++) {
      var currentProduction = productionList[i];

      if (currentProduction.name == nameToGet) {
        production = currentProduction;
      }
    }
    return production;
  },

  pokeAnywhere: function() {
    var token = app.anywhere.getAuthenticationToken();
    var productionList = app.anywhere.listProductions();
    var isProductionOpen = app.anywhere.isProductionOpen();
    if (isProductionOpen === true) {
      var sessionURL = app.anywhere.getCurrentEditingSessionURL();
      var selectionURL = app.anywhere.getCurrentEditingSessionSelectionURL();
      var activeSequenceURL = app.anywhere.getCurrentEditingSessionActiveSequenceURL();

      var theOneIAskedFor = $._PPP_.getProductionByName('test');

      if (theOneIAskedFor) {
        var out = theOneIAskedFor.name + ', ' + theOneIAskedFor.description;
        $._PPP_.updateEventPanel('Found: ' + out); // todo: put useful code here.
      }
    } else {
      $._PPP_.updateEventPanel('No Production open.');
    }
  },

  dumpOMF: function() {
    var activeSequence = app.project.activeSequence;
    if (activeSequence) {
      var outputPath = Folder.selectDialog('Choose the output directory');
      if (outputPath) {
        var absPath = outputPath.fsName;
        var outputName = String(activeSequence.name) + '.omf';

        var fullOutPathWithName = absPath + $._PPP_.getSep() + outputName;

        app.project.exportOMF(
          app.project.activeSequence, // sequence
          fullOutPathWithName, // output file path
          'OMFTitle', // OMF title
          48000, // sample rate (48000 or 96000)
          16, // bits per sample (16 or 24)
          1, // audio encapsulated flag (1 : yes or 0 : no)
          0, // audio file format (0 : AIFF or 1 : WAV)
          0, // trim audio files (0 : no or 1 : yes)
          0, // handle frames (if trim is 1, handle frames from 0 to 1000)
          0,
        ); // include pan flag (0 : no or 1 : yes)
      }
    } else {
      $._PPP_.updateEventPanel('No active sequence.');
    }
  },

  addClipMarkers: function() {
    if (app.project.rootItem.children.numItems > 0) {
      var projectItem = app.project.rootItem.children[0]; // assumes first item is footage.
      if (projectItem) {
        if (
          projectItem.type == ProjectItemType.CLIP ||
          projectItem.type == ProjectItemType.FILE
        ) {
          markers = projectItem.getMarkers();

          if (markers) {
            var num_markers = markers.numMarkers;

            var new_marker = markers.createMarker(12.345);

            var guid = new_marker.guid; // new in 11.1

            new_marker.name = 'Marker created by PProPanel.';
            new_marker.comments = 'Here are some comments, inserted by PProPanel.';
            new_marker.end = 15.6789;

            //default marker type == comment. To change marker type, call one of these:

            // new_marker.setTypeAsChapter();
            // new_marker.setTypeAsWebLink();
            // new_marker.setTypeAsSegmentation();
            // new_marker.setTypeAsComment();
          }
        } else {
          $._PPP_.updateEventPanel('Can only add markers to footage items.');
        }
      } else {
        $._PPP_.updateEventPanel('Could not find first projectItem.');
      }
    } else {
      $._PPP_.updateEventPanel('Project is empty.');
    }
  },

  getClipMarkers: function(clip) {
    var markers = clip.getMarkers();
    var result = [];
    var marker = markers.getFirstMarker();
    if (marker) {
      result.push(marker);
    }
    while (marker) {
      marker = markers.getNextMarker(marker);
      if (marker) {
        result.push(marker);
      }
    }
    return result;
  },

  modifyProjectMetadata: function() {
    var kPProPrivateProjectMetadataURI =
      'http://ns.adobe.com/premierePrivateProjectMetaData/1.0/';

    var namefield = 'Column.Intrinsic.Name';
    var tapename = 'Column.Intrinsic.TapeName';
    var desc = 'Column.PropertyText.Description';
    var logNote = 'Column.Intrinsic.LogNote';
    var newField = 'ExampleFieldName';

    if (app.isDocumentOpen()) {
      var projectItem = app.project.rootItem.children[0]; // just grabs first projectItem.
      if (projectItem) {
        if (ExternalObject.AdobeXMPScript === undefined) {
          ExternalObject.AdobeXMPScript = new ExternalObject('lib:AdobeXMPScript');
        }
        if (ExternalObject.AdobeXMPScript !== undefined) {
          // safety-conscious!
          var projectMetadata = projectItem.getProjectMetadata();
          var successfullyAdded = app.project.addPropertyToProjectMetadataSchema(
            newField,
            'ExampleFieldLabel',
            2,
          );

          var xmp = new XMPMeta(projectMetadata);
          var obj = xmp.dumpObject();

          // var aliases = xmp.dumpAliases();

          var namespaces = XMPMeta.dumpNamespaces();
          var found_name = xmp.doesPropertyExist(
            kPProPrivateProjectMetadataURI,
            namefield,
          );
          var found_tapename = xmp.doesPropertyExist(
            kPProPrivateProjectMetadataURI,
            tapename,
          );
          var found_desc = xmp.doesPropertyExist(kPProPrivateProjectMetadataURI, desc);
          var found_custom = xmp.doesPropertyExist(
            kPProPrivateProjectMetadataURI,
            newField,
          );
          var foundLogNote = xmp.doesPropertyExist(
            kPProPrivateProjectMetadataURI,
            logNote,
          );
          var oldLogValue = '';
          var appendThis = 'This log note inserted by PProPanel.';
          var appendTextWasActuallyNew = false;

          if (foundLogNote) {
            var oldLogNote = xmp.getProperty(kPProPrivateProjectMetadataURI, logNote);
            if (oldLogNote) {
              oldLogValue = oldLogNote.value;
            }
          }

          xmp.setProperty(kPProPrivateProjectMetadataURI, tapename, '***TAPENAME***');
          xmp.setProperty(kPProPrivateProjectMetadataURI, desc, '***DESCRIPTION***');
          xmp.setProperty(kPProPrivateProjectMetadataURI, namefield, '***NEWNAME***');
          xmp.setProperty(
            kPProPrivateProjectMetadataURI,
            newField,
            'PProPanel set this, using addPropertyToProjectMetadataSchema().',
          );

          var array = [];
          array[0] = tapename;
          array[1] = desc;
          array[2] = namefield;
          array[3] = newField;

          var concatenatedLogNotes = '';

          if (oldLogValue != appendThis) {
            // if that value is not exactly what we were going to add
            if (oldLogValue.length > 0) {
              // if we have a valid value
              concatenatedLogNotes +=
                'Previous log notes: ' + oldLogValue + '    ||||    ';
            }
            concatenatedLogNotes += appendThis;
            xmp.setProperty(
              kPProPrivateProjectMetadataURI,
              logNote,
              concatenatedLogNotes,
            );
            array[4] = logNote;
          }

          var str = xmp.serialize();
          projectItem.setProjectMetadata(str, array);

          // test: is it in there?

          var newblob = projectItem.getProjectMetadata();
          var newXMP = new XMPMeta(newblob);
          var foundYet = newXMP.doesPropertyExist(
            kPProPrivateProjectMetadataURI,
            newField,
          );

          if (foundYet) {
            $._PPP_.updateEventPanel(
              'PProPanel successfully added a field to the project metadata schema, and set a value for it.',
            );
          }
        }
      } else {
        $._PPP_.updateEventPanel('No project items found.');
      }
    }
  },

  updatePAR: function() {
    var item = app.project.rootItem.children[0];
    if (item) {
      if (item.type == ProjectItemType.FILE || item.type == ProjectItemType.CLIP) {
        // If there is an item, and it's either a clip or file...
        item.setOverridePixelAspectRatio(185, 100); // anamorphic is BACK!    ;)
      } else {
        $._PPP_.updateEventPanel('You cannot override the PAR of bins or sequences.');
      }
    } else {
      $._PPP_.updateEventPanel('No project items found.');
    }
  },

  getnumAEProjectItems: function() {
    var bt = new BridgeTalk();
    bt.target = 'aftereffects';
    bt.body = //'$._PPP_.updateEventPanel("Items in AE project: " + app.project.rootFolder.numItems);app.quit();';
      'alert("Items in AE project: " + app.project.rootFolder.numItems);app.quit();';
    bt.send();
  },

  updateEventPanel: function(message) {
    app.setSDKEventMessage(message, 'info');
    //app.setSDKEventMessage('Here is some information.', 'info');
    //app.setSDKEventMessage('Here is a warning.', 'warning');
    //app.setSDKEventMessage('Here is an error.', 'error');  // Very annoying; use sparingly.
  },

  walkAllBinsForFootage: function(parentItem, outPath) {
    for (var j = 0; j < parentItem.children.numItems; j++) {
      var currentChild = parentItem.children[j];
      if (currentChild) {
        if (currentChild.type == ProjectItemType.BIN) {
          $._PPP_.walkAllBinsForFootage(currentChild, outPath); // warning; recursion!
        } else {
          $._PPP_.dumpProjectItemXMP(currentChild, outPath);
        }
      }
    }
  },

  searchBinForProjItemByName: function(i, currentItem, nameToFind) {
    for (var j = i; j < currentItem.children.numItems; j++) {
      var currentChild = currentItem.children[j];
      if (currentChild) {
        if (currentChild.type == ProjectItemType.BIN) {
          return $._PPP_.searchBinForProjItemByName(j, currentChild, nameToFind); // warning; recursion!
        } else {
          if (currentChild.name == nameToFind) {
            return currentChild;
          } else {
            currentChild = currentItem.children[j + 1];
            if (currentChild) {
              return $._PPP_.searchBinForProjItemByName(0, currentChild, nameToFind);
            }
          }
        }
      }
    }
  },

  dumpXMPFromSequences: function() {
    var outPath = Folder.selectDialog('Choose the output directory');
    var projForSeq = 0;
    var seqCount = app.project.sequences.numSequences;

    for (var i = 0; i < seqCount; i++) {
      var currentSeq = app.project.sequences[i];
      if (currentSeq) {
        projForSeq = $._PPP_.searchBinForProjItemByName(
          0,
          app.project.rootItem,
          currentSeq.name,
        );
        if (projForSeq) {
          $._PPP_.dumpProjectItemXMP(projForSeq, outPath.fsName);
        } else {
          $._PPP_.updateEventPanel(
            "Couldn't find projectItem for sequence " + currentSeq.name,
          );
        }
      }
    }
  },

  dumpProjectItemXMP: function(projectItem, outPath) {
    var xmpBlob = projectItem.getXMPMetadata();
    var outFileName = projectItem.name + '.xmp';
    var completeOutputPath = outPath + $._PPP_.getSep() + outFileName;
    var outFile = new File(completeOutputPath);

    if (outFile) {
      outFile.encoding = 'UTF8';
      outFile.open('w', 'TEXT', '????');
      outFile.write(xmpBlob.toString());
      outFile.close();
    }
  },

  addSubClip: function() {
    var startTimeSeconds = 1.23743;
    var endTimeSeconds = 3.5235;
    var hasHardBoundaries = 0;

    var sessionCounter = 1;
    var takeVideo = 1; // optional, defaults to 1
    var takeAudio = 1; // optional, defaults to 1

    var projectItem = app.project.rootItem.children[0]; // just grabs the first item

    if (projectItem) {
      if (
        projectItem.type == ProjectItemType.CLIP ||
        projectItem.type == ProjectItemType.FILE
      ) {
        var newSubClipName = prompt(
          'Name of subclip?',
          projectItem.name + '_' + sessionCounter,
          'Name your subclip',
        );

        var newSubClip = projectItem.createSubClip(
          newSubClipName,
          startTimeSeconds,
          endTimeSeconds,
          hasHardBoundaries,
          takeVideo,
          takeAudio,
        );

        if (newSubClip) {
          newSubClip.setStartTime(12.345); // In seconds. New in 11.0
        }
      } else {
        $._PPP_.updateEventPanel('Could not sub-clip ' + projectItem.name + '.');
      }
    } else {
      $._PPP_.updateEventPanel('No project item found.');
    }
  },

  dumpXMPFromAllProjectItems: function() {
    var numItemsInRoot = app.project.rootItem.children.numItems;

    if (numItemsInRoot > 0) {
      var outPath = Folder.selectDialog('Choose the output directory');
      if (outPath) {
        for (var i = 0; i < numItemsInRoot; i++) {
          var currentItem = app.project.rootItem.children[i];
          if (currentItem) {
            if (currentItem.type == ProjectItemType.BIN) {
              $._PPP_.walkAllBinsForFootage(currentItem, outPath.fsName);
            } else {
              $._PPP_.dumpProjectItemXMP(currentItem, outPath.fsName);
            }
          }
        }
      }
    } else {
      $._PPP_.updateEventPanel('No project items found.');
    }
  },

  exportAAF: function() {
    var sessionCounter = 1;
    if (app.project.activeSequence) {
      var outputPath = Folder.selectDialog('Choose the output directory');
      if (outputPath) {
        var absPath = outputPath.fsName;
        var outputName = String(app.project.name);
        var array = outputName.split('.', 2);

        outputName = array[0] + sessionCounter + '.' + array[1];
        sessionCounter++;

        var fullOutPath = absPath + $._PPP_.getSep() + outputName + '.aaf';

        //var optionalPathToOutputPreset = null;  New in 11.0.0, you can specify an output preset.

        app.project.exportAAF(
          app.project.activeSequence, // which sequence
          fullOutPath, // output path
          1, // mix down video?
          0, // explode to mono?
          96000, // sample rate
          16, // bits per sample
          0, // embed audio?
          0, // audio file format? 0 = aiff, 1 = wav
          0, // trim sources?
          0,
          /*,               // number of 'handle' frames
                              optionalPathToOutputPreset*/
        ); // optional; .epr file to use
      } else {
        $._PPP_.updateEventPanel("Couldn't create AAF output.");
      }
    } else {
      $._PPP_.updateEventPanel('No active sequence.');
    }
  },

  setScratchDisk: function() {
    var scratchPath = Folder.selectDialog('Choose new scratch disk directory');
    if (scratchPath && scratchPath.exists) {
      app.setScratchDiskPath(scratchPath.fsName, ScratchDiskType.FirstAutoSaveFolder); // see ScratchDiskType object, in ESTK.
    }
  },

  getSequenceProxySetting: function() {
    var returnVal = 'No sequence detected.';
    var seq = app.project.activeSequence;

    if (seq) {
      if (seq.getEnableProxies() > 0) {
        returnVal = 'true';
      } else {
        returnVal = 'false';
      }
    }
    return returnVal;
  },

  toggleProxyState: function() {
    var seq = app.project.activeSequence;
    if (seq) {
      var update = 'Proxies for ' + seq.name + ' turned ';

      if (seq.getEnableProxies() > 0) {
        seq.setEnableProxies(false);
        update = update + 'OFF.';
        app.setSDKEventMessage(update, 'info');
      } else {
        seq.setEnableProxies(true);
        update = update + 'ON.';
        app.setSDKEventMessage(update, 'info');
      }
    } else {
      $._PPP_.updateEventPanel('No active sequence.');
    }
  },

  setProxiesON: function() {
    var firstProjectItem = app.project.rootItem.children[0];

    if (firstProjectItem) {
      if (firstProjectItem.canProxy()) {
        var shouldAttachProxy = true;
        if (firstProjectItem.hasProxy()) {
          shouldAttachProxy = confirm(
            firstProjectItem.name + ' already has an assigned proxy. Re-assign anyway?',
            false,
            'Are you sure...?',
          );
        }
        if (shouldAttachProxy) {
          var proxyPath = File.openDialog(
            'Choose proxy for ' + firstProjectItem.name + ':',
          );
          if (proxyPath.exists) {
            firstProjectItem.attachProxy(proxyPath.fsName, 0);
          } else {
            $._PPP_.updateEventPanel('Could not attach proxy from ' + proxyPath + '.');
          }
        }
      } else {
        $._PPP_.updateEventPanel(
          'Cannot attach a proxy to ' + firstProjectItem.name + '.',
        );
      }
    } else {
      $._PPP_.updateEventPanel('No project item available.');
    }
  },

  clearCache: function() {
    app.enableQE();

    MediaType = {};

    // Magical constants from Premiere Pro's internal automation..

    MediaType.VIDEO = '228CDA18-3625-4d2d-951E-348879E4ED93';
    MediaType.AUDIO = '80B8E3D5-6DCA-4195-AEFB-CB5F407AB009';
    MediaType.ANY = 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF';
    qe.project.deletePreviewFiles(MediaType.ANY);
    $._PPP_.updateEventPanel('All video and audio preview files deleted.');
  },

  randomizeSequenceSelection: function() {
    var sequence = app.project.activeSequence;

    if (sequence) {
      var trackGroups = [sequence.audioTracks, sequence.videoTracks];
      var trackGroupNames = ['audioTracks', 'videoTracks'];
      var updateUI = true;
      var before;

      for (var gi = 0; gi < 2; gi++) {
        $._PPP_.message(trackGroupNames[gi]);
        group = trackGroups[gi];
        for (var ti = 0; ti < group.numTracks; ti++) {
          var track = group[ti];
          var clips = track.clips;
          var transitions = track.transitions;
          var beforeSelected;
          var afterSelected;

          $._PPP_.message(
            'track : ' +
              ti +
              '  clip count: ' +
              clips.numTracks +
              '    transition count: ' +
              transitions.numTracks,
          );

          for (var ci = 0; ci < clips.numTracks; ci++) {
            var clip = clips[ci];
            name = clip.projectItem === undefined ? '<null>' : clip.projectItem.name;
            before = clip.isSelected();

            // randomly select clips
            clip.setSelected(Math.random() > 0.5, updateUI);

            beforeSelected = before ? 'Y' : 'N';
            afterSelected = clip.selected ? 'Y' : 'N';
            $._PPP_.message(
              'clip : ' +
                ci +
                '   ' +
                name +
                '   ' +
                beforeSelected +
                ' -> ' +
                afterSelected,
            );
          }

          for (var tni = 0; tni < transitions.numTracks; ++tni) {
            var transition = transitions[tni];
            before = transition.isSelected();

            // randomly select transitions
            transition.setSelected(Math.random() > 0.5, updateUI);

            beforeSelected = before ? 'Y' : 'N';
            afterSelected = transition.selected ? 'Y' : 'N';

            $._PPP_.message(
              'transition: ' + tni + '    ' + beforeSelected + ' -> ' + afterSelected,
            );
          }
        }
      }
    } else {
      $._PPP_.updateEventPanel('No active sequence found.');
    }
  },

  // Define a couple of callback functions, for AME to use during render.

  message: function(msg) {
    $.writeln(msg); // Using '$' object will invoke ExtendScript Toolkit, if installed.
  },

  onEncoderJobComplete: function(jobID, outputFilePath) {
    var eoName;

    if (Folder.fs == 'Macintosh') {
      eoName = 'PlugPlugExternalObject';
    } else {
      eoName = 'PlugPlugExternalObject.dll';
    }

    var suffixAddedByPPro = '_1'; // You should really test for any suffix.
    var withoutExtension = outputFilePath.slice(0, -4); // trusting 3 char extension
    var lastIndex = outputFilePath.lastIndexOf('.');
    var extension = outputFilePath.substr(lastIndex + 1);

    if (outputFilePath.indexOf(suffixAddedByPPro)) {
      $._PPP_.updateEventPanel(
        ' Output filename was changed: the output preset name may have been added, or there may have been an existing file with that name. This would be a good place to deal with such occurrences.',
      );
    }

    var mylib = new ExternalObject('lib:' + eoName);
    var eventObj = new CSXSEvent();

    eventObj.type = 'com.adobe.csxs.events.PProPanelRenderEvent';
    eventObj.data = 'Rendered Job ' + jobID + ', to ' + outputFilePath + '.';

    eventObj.dispatch();
  },

  onEncoderJobError: function(jobID, errorMessage) {
    var eoName;

    if (Folder.fs === 'Macintosh') {
      eoName = 'PlugPlugExternalObject';
    } else {
      eoName = 'PlugPlugExternalObject.dll';
    }

    var mylib = new ExternalObject('lib:' + eoName);
    var eventObj = new CSXSEvent();

    eventObj.type = 'com.adobe.csxs.events.PProPanelRenderEvent';
    eventObj.data = 'Job ' + jobID + ' failed, due to ' + errorMessage + '.';
    eventObj.dispatch();
  },

  onEncoderJobProgress: function(jobID, progress) {
    $._PPP_.message(
      'onEncoderJobProgress called. jobID = ' + jobID + '. progress = ' + progress + '.',
    );
  },

  onEncoderJobQueued: function(jobID) {
    app.encoder.startBatch();
  },

  onEncoderJobCanceled: function(jobID) {
    $._PPP_.message('OnEncoderJobCanceled called. jobID = ' + jobID + '.');
  },

  onPlayWithKeyframes: function() {
    var seq = app.project.activeSequence;
    if (seq) {
      var firstVideoTrack = seq.videoTracks[0];
      if (firstVideoTrack) {
        var firstClip = firstVideoTrack.clips[0];
        if (firstClip) {
          var clipComponents = firstClip.components;
          if (clipComponents) {
            for (var i = 0; i < clipComponents.numItems; ++i) {
              $._PPP_.message(
                'component ' +
                  i +
                  ' = ' +
                  clipComponents[i].matchName +
                  ' : ' +
                  clipComponents[i].displayName,
              );
            }
            if (clipComponents.numItems > 2) {
              // 0 = clip
              // 1 = Opacity
              var blur = clipComponents[2]; // Assume Gaussian Blur is the first effect applied to the clip.
              if (blur) {
                var blurProps = blur.properties;
                if (blurProps) {
                  for (var j = 0; j < blurProps.numItems; ++j) {
                    $._PPP_.message('param ' + j + ' = ' + blurProps[j].displayName);
                  }
                  var blurriness = blurProps[0];
                  if (blurriness) {
                    if (!blurriness.isTimeVarying()) {
                      blurriness.setTimeVarying(true);
                    }
                    for (var k = 0; k < 20; ++k) {
                      updateUI = k == 9; // Decide how often to update PPro's UI
                      blurriness.addKey(k);
                      var blurVal = Math.sin(3.14159 * i / 5) * 20 + 25;
                      blurriness.setValueAtKey(k, blurVal, updateUI);
                    }
                  }
                  var repeatEdgePixels = blurProps[2];
                  if (repeatEdgePixels) {
                    if (!repeatEdgePixels.getValue()) {
                      updateUI = true;
                      repeatEdgePixels.setValue(true, updateUI);
                    }
                  }
                  // look for keyframe nearest to 4s with 1/10 second tolerance
                  var keyFrameTime = blurriness.findNearestKey(4.0, 0.1);
                  if (keyFrameTime !== undefined) {
                    $._PPP_.message('Found keyframe = ' + keyFrameTime.seconds);
                  } else {
                    $._PPP_.message('Keyframe not found.');
                  }

                  // scan keyframes, forward

                  keyFrameTime = blurriness.findNearestKey(0.0, 0.1);
                  var lastKeyFrameTime = keyFrameTime;
                  while (keyFrameTime !== undefined) {
                    $._PPP_.message('keyframe @ ' + keyFrameTime.seconds);
                    lastKeyFrameTime = keyFrameTime;
                    keyFrameTime = blurriness.findNextKey(keyFrameTime);
                  }

                  // scan keyframes, backward
                  keyFrameTime = lastKeyFrameTime;
                  while (keyFrameTime !== undefined) {
                    $._PPP_.message('keyframe @ ' + keyFrameTime.seconds);
                    lastKeyFrameTime = keyFrameTime;
                    keyFrameTime = blurriness.findPreviousKey(keyFrameTime);
                  }

                  // get all keyframes

                  var blurKeyframesArray = blurriness.getKeys();
                  if (blurKeyframesArray) {
                    $._PPP_.message(blurKeyframesArray.length + ' keyframes found');
                  }

                  // remove keyframe at 19s
                  blurriness.removeKey(19);

                  // remove keyframes in range from 0s to 5s
                  var shouldUpdateUI = true;
                  blurriness.removeKeyRange(0, 5, shouldUpdateUI);
                }
              } else {
                $._PPP_.updateEventPanel(
                  'Please apply the Gaussian Blur effect to the first clip in the first video track of the active sequence.',
                );
              }
            }
          }
        }
      }
    } else {
      $._PPP_.updateEventPanel('No active sequence found.');
    }
  },

  extractFileNameFromPath: function(fullPath) {
    var lastDot = fullPath.lastIndexOf('.');
    var lastSep = fullPath.lastIndexOf('/');

    if (lastDot > -1) {
      return fullPath.substr(lastSep + 1, fullPath.length - (lastDot + 1));
    } else {
      return fullPath;
    }
  },

  onProxyTranscodeJobComplete: function(jobID, outputFilePath) {
    var suffixAddedByPPro = '_1'; // You should really test for any suffix.
    var withoutExtension = outputFilePath.slice(0, -4); // trusting 3 char extension
    var lastIndex = outputFilePath.lastIndexOf('.');
    var extension = outputFilePath.substr(lastIndex + 1);

    var wrapper = [];
    wrapper[0] = outputFilePath;

    var nameToFind = 'Proxies generated by PProPanel';
    var targetBin = $._PPP_.getPPPInsertionBin();
    if (targetBin) {
      app.project.importFiles(wrapper);
    }
  },

  onProxyTranscodeJobError: function(jobID, errorMessage) {
    $._PPP_.updateEventPanel(errorMessage);
  },

  onProxyTranscodeJobQueued: function(jobID) {
    app.encoder.startBatch();
  },

  ingestFiles: function(outputPresetPath) {
    app.encoder.bind('onEncoderJobComplete', $._PPP_.onProxyTranscodeJobComplete);
    app.encoder.bind('onEncoderJobError', $._PPP_.onProxyTranscodeJobError);
    app.encoder.bind('onEncoderJobQueued', $._PPP_.onProxyTranscodeJobQueued);
    app.encoder.bind('onEncoderJobCanceled', $._PPP_.onEncoderJobCanceled);

    if (app.project) {
      var fileOrFilesToImport = File.openDialog(
        'Choose full resolution files to import', // title
        0, // filter available files?
        true,
      ); // allow multiple?
      if (fileOrFilesToImport) {
        var nameToFind = 'Proxies generated by PProPanel';
        var targetBin = $._PPP_.searchForBinWithName(nameToFind);

        if (targetBin === 0) {
          // If panel can't find the target bin, it creates it.
          app.project.rootItem.createBin(nameToFind);
          targetBin = $._PPP_.searchForBinWithName(nameToFind);
        }
        if (targetBin) {
          targetBin.select();

          // We have an array of File objects; importFiles() takes an array of paths.
          var importThese = [];

          if (importThese) {
            for (var i = 0; i < fileOrFilesToImport.length; i++) {
              importThese[i] = fileOrFilesToImport[i].fsName;
              var justFileName = extractFileNameFromPath(importThese[i]);
              var suffix = '_PROXY.mp4';
              var containingPath = fileOrFilesToImport[i].parent.fsName;
              var completeProxyPath =
                containingPath + $._PPP_.getSep() + justFileName + suffix;

              var jobID = app.encoder.encodeFile(
                fileOrFilesToImport[i].fsName,
                completeProxyPath,
                outputPresetPath,
                0,
              );
            }

            app.project.importFiles(
              importThese,
              1, // suppress warnings
              targetBin,
              0,
            ); // import as numbered stills
          }
        } else {
          $._PPP_.updateEventPanel('Could not find or create target bin.');
        }
      } else {
        $._PPP_.updateEventPanel('No files to import.');
      }
    } else {
      $._PPP_.updateEventPanel('No project found.');
    }
  },

  insertOrAppend: function(treePath, overwrite) {
    var seq = app.project.activeSequence;
    if (seq) {
      var first = treePath
        ? this.findClipByTreePath(treePath)
        : app.project.rootItem.children[0];
      if (first) {
        var vTrack1 = seq.videoTracks[0];
        if (vTrack1) {
          // If there are already clips in this track,
          // append this one to the end. Otherwise,
          // insert at start time.

          if (vTrack1.clips.numItems > 0) {
            var lastClip = vTrack1.clips[vTrack1.clips.numItems - 1];
            if (lastClip && !overwrite) {
              vTrack1.insertClip(first, lastClip.end.seconds);
            } else if (lastClip && overwrite) {
              vTrack1.overwriteClip(first, lastClip.end.seconds);
            }
          } else {
            if (!overwrite) {
              vTrack1.insertClip(first, '00;00;00;00');
            } else {
              vTrack1.overwriteClip(first, '00;00;00;00');
            }
          }
        } else {
          $._PPP_.updateEventPanel('Could not find first video track.');
        }
      } else {
        $._PPP_.updateEventPanel("Couldn't locate first projectItem.");
      }
    } else {
      $._PPP_.updateEventPanel('No active sequence found.');
    }
  },

  overWrite: function() {
    var seq = app.project.activeSequence;
    if (seq) {
      var first = app.project.rootItem.children[0];
      if (first) {
        var vTrack1 = seq.videoTracks[0];
        if (vTrack1) {
          var now = seq.getPlayerPosition();
          vTrack1.overwriteClip(first, now.seconds);
        } else {
          $._PPP_.updateEventPanel('Could not find first video track.');
        }
      } else {
        $._PPP_.updateEventPanel("Couldn't locate first projectItem.");
      }
    } else {
      $._PPP_.updateEventPanel('No active sequence found.');
    }
  },

  closeFrontSourceClip: function() {
    app.sourceMonitor.closeClip();
  },

  closeAllClipsInSourceMonitor: function() {
    app.sourceMonitor.closeAllClips();
  },

  changeLabel: function() {
    var first = app.project.rootItem.children[0];
    if (first) {
      var newLabel = 4; // 4 = Cerulean. 0 = Violet, 15 = Yellow.
      var currentLabel = first.getColorLabel();
      app.setSDKEventMessage('Previous Label color = ' + currentLabel + '.', 'info');
      first.setColorLabel(newLabel);
      app.setSDKEventMessage('New Label color = ' + newLabel + '.', 'info');
    } else {
      $._PPP_.updateEventPanel("Couldn't locate first projectItem.");
    }
  },

  getPPPInsertionBin: function() {
    var nameToFind = "Here's where PProPanel puts things.";

    var targetBin = $._PPP_.searchForBinWithName(nameToFind);

    if (targetBin === 0) {
      // If panel can't find the target bin, it creates it.
      app.project.rootItem.createBin(nameToFind);
      targetBin = $._PPP_.searchForBinWithName(nameToFind);
    }
    if (targetBin) {
      targetBin.select();
      return targetBin;
    }
  },

  importComps: function() {
    var targetBin = $._PPP_.getPPPInsertionBin();
    if (targetBin) {
      var filterString = '';
      if (Folder.fs === 'Windows') {
        filterString = 'All files:*.*';
      }
      var aepToImport = File.openDialog(
        'Choose After Effects project', // title
        0, // filter available files?
        false,
      ); // allow multiple?
      if (aepToImport) {
        var importAll = confirm(
          'Import all compositions in project?',
          false,
          'Import all?',
        );
        if (importAll) {
          var result = app.project.importAllAEComps(aepToImport.fsName, targetBin);
        } else {
          var compName = prompt(
            'Name of composition to import?',
            '',
            'Which Comp to import',
          );
          if (compName) {
            var importAECompResult = app.project.importAEComps(
              aepToImport.fsName,
              [compName],
              targetBin,
            );
          } else {
            $._PPP_.updateEventPanel('Could not find Composition.');
          }
        }
      } else {
        $._PPP_.updateEventPanel('Could not open project.');
      }
    } else {
      $._PPP_.updateEventPanel('Could not find or create target bin.');
    }
  },
};
