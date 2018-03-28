$._ext_XMP = {
  kPProPrivateProjectMetadataURI: 'http://ns.adobe.com/premierePrivateProjectMetaData/1.0/',
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
  initXMP: function () {
    if (ExternalObject.AdobeXMPScript === undefined) {
      ExternalObject.AdobeXMPScript = new ExternalObject('lib:AdobeXMPScript');
      if (ExternalObject.AdobeXMPScript === undefined) {
        return false;
      }
    }
    return true;
  },
  fixTranscripts: function (transcripts) {
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
  escapeString: function (s) {
    return s.replace(/[ \\]/g, function (x) { return '\\' + x; });
  },
  splitString: function (str) {
    var a = [];
    var elem = '';
    var s = str;
    while (s) {
      var c = s.substring(0, 1);
      if (c === '\\') {
        elem += s.substring(1, 2);
        s = s.substring(2);
      } else if (c === ' ') {
        a.push(elem);
        elem = '';
        s = s.substring(1);
      } else {
        elem += c;
        s = s.substring(1);
      }
    }
    if (elem) {
      a.push(elem);
    }
    return a;
  },
  getClipMediaStart: function (sequenceJson, clipJson) {
    var kPProPrivateProjectMetadataURI = 'http://ns.adobe.com/premierePrivateProjectMetaData/1.0/';
    var mediaStartField = 'Column.Intrinsic.SubclipStart';
    var result = {};
    var clip = $._ext_PPRO.getSequenceClip(sequenceJson, clipJson);
    if (clip && clip.projectItem) {
      if (!this.initXMP()) {
        return $._ext_JSON.stringify(result);
      }
      // Handle subclips
      var projectMetadata = clip.projectItem.getProjectMetadata();
      var projXMP = new XMPMeta(projectMetadata);
      if (projXMP.doesPropertyExist(kPProPrivateProjectMetadataURI, mediaStartField)) {
        var mediaStart = projXMP.getProperty(kPProPrivateProjectMetadataURI, mediaStartField).value;
        result.mediaStart = mediaStart;
      }
      var xmpBlob = clip.projectItem.getXMPMetadata();
      var xmp = new XMPMeta(xmpBlob);
      var timecodeField = 'startTimecode';
      if (xmp.doesPropertyExist(XMPConst.NS_DM, 'altTimecode')) {
        timecodeField = 'altTimecode';
      }
      if (xmp.doesPropertyExist(XMPConst.NS_DM, timecodeField)) {
        result.startTimecode = xmp.getStructField(XMPConst.NS_DM, timecodeField, XMPConst.NS_DM, 'timeValue').value;
        var format = xmp.getStructField(XMPConst.NS_DM, timecodeField, XMPConst.NS_DM, 'timeFormat').value;
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
        result.frameRate = parseFloat(xmp.getProperty(XMPConst.NS_DM, 'videoFrameRate').value);
      } else if (xmp.doesPropertyExist(XMPConst.NS_DM, 'audioSampleRate')) {
        result.frameRate = parseInt(xmp.getProperty(XMPConst.NS_DM, 'audioSampleRate').value, 10);
      }
    }
    return $._ext_JSON.stringify(result);
  },
  readXMP: function (xmp) {
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
        fieldPath = XMPUtils.composeStructFieldPath(this.schemaNS, path, this.schemaNS, 'startTime');
        fieldCount = xmp.countArrayItems(this.schemaNS, fieldPath);
        if (fieldCount > obj.words.length) {
          fieldCount = obj.words.length;
        }
        for (j = 1; j <= fieldCount; j++) {
          obj.words[j - 1].startTime = parseFloat(xmp.getArrayItem(this.schemaNS, fieldPath, j).value);
        }
        var startCount = fieldCount;
        // endTime
        fieldPath = XMPUtils.composeStructFieldPath(this.schemaNS, path, this.schemaNS, 'endTime');
        fieldCount = xmp.countArrayItems(this.schemaNS, fieldPath);
        if (fieldCount > obj.words.length) {
          fieldCount = obj.words.length;
        }
        for (j = 1; j <= fieldCount; j++) {
          obj.words[j - 1].endTime = parseFloat(xmp.getArrayItem(this.schemaNS, fieldPath, j).value);
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
        fieldPath = XMPUtils.composeStructFieldPath(this.schemaNS, path, this.schemaNS, 'confidence');
        fieldCount = xmp.countArrayItems(this.schemaNS, fieldPath);
        if (fieldCount > obj.words.length) {
          fieldCount = obj.words.length;
        }
        for (j = 1; j <= fieldCount; j++) {
          obj.words[j - 1].confidence = parseFloat(xmp.getArrayItem(this.schemaNS, fieldPath, j).value);
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
  writeXMP: function (xmp, obj) {
    var transcripts = obj.transcripts;
    var lang = obj.lang || 'en-US';
    var speakerMap = obj.speakers || {};
    var speakerIds = {};
    var speakerLabels = [];
    if (!XMPMeta.getNamespacePrefix(this.schemaNS)) {
      XMPMeta.registerNamespace(this.schemaNS, this.prefix);
    }
    // Delete old transcripts, if any.
    xmp.deleteProperty(this.schemaNS, this.speakerName);
    xmp.deleteProperty(this.schemaNS, this.transcriptsName);
    // Language
    xmp.setProperty(this.schemaNS, this.languageName, lang);
    // Transcripts array
    var i;
    for (i = 0; i < transcripts.length; i++) {
      xmp.appendArrayItem(this.schemaNS,
                          this.transcriptsName,
                          null,
                          XMPConst.PROP_IS_STRUCT,
                          XMPConst.ARRAY_IS_ORDERED);
      var path = XMPUtils.composeArrayItemPath(this.schemaNS,
                                               this.transcriptsName,
                                               XMPConst.ARRAY_LAST_ITEM);
      var t = transcripts[i];
      var words = t.words;
      var text = '';
      var w;
      var v;
      for (w = 0; w < words.length; w++) {
        if (text) {
          text += ' ';
        }
        text += this.escapeString(words[w].text);
      }
      xmp.setStructField(this.schemaNS, path, this.schemaNS, 'text', text);
      if (t.speaker !== undefined) {
        if (speakerIds[t.speaker] === undefined) {
          var label = speakerMap[t.speaker] || 'Unknown';
          speakerIds[t.speaker] = speakerLabels.length + 1;
          speakerLabels.push(label);
        }
        var speakerId = speakerIds[t.speaker];
        xmp.setStructField(this.schemaNS, path, this.schemaNS, 'speaker', speakerId);
      }
      var fieldPath;
      fieldPath = XMPUtils.composeStructFieldPath(this.schemaNS, path, this.schemaNS, 'startTime');
      for (w = 0; w < words.length; w++) {
        v = words[w].startTime;
        xmp.appendArrayItem(this.schemaNS,
                            fieldPath,
                            v,
                            0,
                            XMPConst.ARRAY_IS_ORDERED);
      }
      fieldPath = XMPUtils.composeStructFieldPath(this.schemaNS, path, this.schemaNS, 'endTime');
      for (w = 0; w < words.length; w++) {
        v = words[w].endTime;
        xmp.appendArrayItem(this.schemaNS,
                            fieldPath,
                            v,
                            0,
                            XMPConst.ARRAY_IS_ORDERED);
      }
      fieldPath = XMPUtils.composeStructFieldPath(this.schemaNS, path, this.schemaNS, 'confidence');
      for (w = 0; w < words.length; w++) {
        v = words[w].confidence;
        xmp.appendArrayItem(this.schemaNS,
                            fieldPath,
                            v,
                            0,
                            XMPConst.ARRAY_IS_ORDERED);
      }
    }
    // Speaker labels
    for (i = 0; i < speakerLabels.length; i++) {
      xmp.appendArrayItem(this.schemaNS,
                          this.speakerName,
                          speakerLabels[i],
                          0,
                          XMPConst.ARRAY_IS_ORDERED);
    }
    var xmpAsString = xmp.serialize(); // serialize and write XMP.
    return xmpAsString;
  },
  parseFrameRate: function (rate) {
    var result = 1; // Default frame rate for XMP.
    if (rate) {
      if (rate[0] === 'f') {
        var r = rate.substr(1);
        basis = r.split('s');
        if (basis.length === 2) {
          result = parseInt(basis[0], 10) / parseInt(basis[1], 10);
        } else {
          result = parseInt(r, 10);
        }
      }
    }
    return result;
  },
  parseTimeValue: function (value, rate) {
    if (value === 'maximum') {
      return 1000000;
    }
    var fields = ('' + value).split('f');
    if (fields.length === 2) {
      return parseInt(fields[0], 10) / this.parseFrameRate('f' + fields[1]);
    }
    return parseInt(value, 10) / rate;
  },
  readSpeechAnalysis: function (xmp) {
    var result = this.emptyObject;
    var count = xmp.countArrayItems(XMPConst.NS_DM, 'Tracks');
    if (count > 0) {
      for (var i = 1; i <= count; i++) {
        var path = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, 'Tracks', i);
        var type = xmp.getStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'trackType').value;
        if (type === 'Speech') {
          var rate = xmp.getStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'frameRate');
          rate = this.parseFrameRate(rate && rate.value);
          result = { transcripts: [], speakers: {}, lang: 'en-US' };
          var markersPath = XMPUtils.composeStructFieldPath(XMPConst.NS_DM, path, XMPConst.NS_DM, 'markers');
          var words = [];
          var markers = xmp.countArrayItems(XMPConst.NS_DM, markersPath);
          var speaker;
          var speakerMap = {};
          var speakers = [];
          for (var j = 1; j <= markers; j++) {
            var markerJ = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, markersPath, j);
            var obj = {};
            obj.startTime = this.parseTimeValue(xmp.getStructField(XMPConst.NS_DM, markerJ, XMPConst.NS_DM, 'startTime').value, rate);
            obj.endTime = this.parseTimeValue(xmp.getStructField(XMPConst.NS_DM, markerJ, XMPConst.NS_DM, 'duration').value, rate) + obj.startTime;
            obj.text = xmp.getStructField(XMPConst.NS_DM, markerJ, XMPConst.NS_DM, 'name').value;
            obj.confidence = xmp.getStructField(XMPConst.NS_DM, markerJ, XMPConst.NS_DM, 'probability').value / 100;
            if (!speaker) {
              speaker = xmp.getStructField(XMPConst.NS_DM, markerJ, XMPConst.NS_DM, 'speaker');
              speaker = speaker ? speaker.value : undefined;
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
  deleteSpeechAnalysis: function (xmp) {
    var count = xmp.countArrayItems(XMPConst.NS_DM, 'Tracks');
    for (var i = count; i >= 1; i--) {
      var path = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, 'Tracks', i);
      var type = xmp.getStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'trackType').value;
      if (type === 'Speech') {
        xmp.deleteArrayItem(XMPConst.NS_DM, 'Tracks', i);
      }
    }
  },
  writeSpeechAnalysis: function (xmp, obj) {
    var transcripts = obj.transcripts;
    var speakers = obj.speakers || {};
    var name = 'Transcriptive';
    if (obj.lang) {
      name += ' (' + obj.lang + ')';
    }
    this.deleteSpeechAnalysis(xmp);
    xmp.appendArrayItem(XMPConst.NS_DM, 'Tracks',
                        null,
                        XMPConst.PROP_IS_STRUCT,
                        XMPConst.ARRAY_IS_UNORDERED);
    var path = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, 'Tracks',
                                             XMPConst.ARRAY_LAST_ITEM);
    xmp.setStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'trackName', name);
    xmp.setStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'trackType', 'Speech');
    xmp.setStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'frameRate', 'f1000');
    var markersPath = XMPUtils.composeStructFieldPath(XMPConst.NS_DM, path, XMPConst.NS_DM, 'markers');
    for (var i = 0; i < transcripts.length; i++) {
      var t = transcripts[i];
      var words = t.words;
      for (var w = 0; w < words.length; w++) {
        var word = words[w];
        xmp.appendArrayItem(XMPConst.NS_DM, markersPath,
                            null,
                            XMPConst.PROP_IS_STRUCT,
                            XMPConst.ARRAY_IS_ORDERED);
        var markerN = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, markersPath,
                                                    XMPConst.ARRAY_LAST_ITEM);
        xmp.setStructField(XMPConst.NS_DM, markerN, XMPConst.NS_DM, 'startTime', Math.round(word.startTime * 1000));
        xmp.setStructField(XMPConst.NS_DM, markerN, XMPConst.NS_DM, 'duration', Math.round((word.endTime - word.startTime) * 1000));
        xmp.setStructField(XMPConst.NS_DM, markerN, XMPConst.NS_DM, 'name', word.text);
        if (t.speaker !== undefined && speakers[t.speaker]) {
          xmp.setStructField(XMPConst.NS_DM, markerN, XMPConst.NS_DM, 'speaker', speakers[t.speaker]);
        }
        xmp.setStructField(XMPConst.NS_DM, markerN, XMPConst.NS_DM, 'probability', Math.round(word.confidence * 100));
      }
    }
    var xmpAsString = xmp.serialize(); // serialize and write XMP.
    return xmpAsString;
  },
  writeSpeechAnalysisMarkers: function (xmp, obj, clip) {
    var markers = obj.markers || [];
    var name = 'Transcriptive';
    if (obj.lang) {
      name += ' (' + obj.lang + ')';
    }
    var rate = 1000;
    this.deleteSpeechAnalysis(xmp);
    xmp.appendArrayItem(XMPConst.NS_DM, 'Tracks',
                        null,
                        XMPConst.PROP_IS_STRUCT,
                        XMPConst.ARRAY_IS_UNORDERED);
    var path = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, 'Tracks',
                                             XMPConst.ARRAY_LAST_ITEM);
    xmp.setStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'trackName', name);
    xmp.setStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'trackType', 'Speech');
    xmp.setStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'frameRate', 'f' + rate);
    var markersPath = XMPUtils.composeStructFieldPath(XMPConst.NS_DM, path, XMPConst.NS_DM, 'markers');
    for (var i = 0; i < markers.length; i++) {
      var marker = markers[i];
      xmp.appendArrayItem(XMPConst.NS_DM, markersPath,
                          null,
                          XMPConst.PROP_IS_STRUCT,
                          XMPConst.ARRAY_IS_ORDERED);
      var markerN = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, markersPath,
                                                  XMPConst.ARRAY_LAST_ITEM);
      xmp.setStructField(XMPConst.NS_DM, markerN, XMPConst.NS_DM, 'startTime', Math.round(marker.startTime * rate));
      xmp.setStructField(XMPConst.NS_DM, markerN, XMPConst.NS_DM, 'duration', Math.round(marker.duration * rate));
      xmp.setStructField(XMPConst.NS_DM, markerN, XMPConst.NS_DM, 'name', marker.name);
      if (marker.speaker !== undefined) {
        xmp.setStructField(XMPConst.NS_DM, markerN, XMPConst.NS_DM, 'speaker', marker.speaker);
      }
      xmp.setStructField(XMPConst.NS_DM, markerN, XMPConst.NS_DM, 'probability', Math.round(marker.probability * 100));
    }
    var xmpAsString = xmp.serialize(); // serialize and write XMP.
    return xmpAsString;
  },
  deleteClipMarkers: function (xmp, tpath, clip) {
    // $._ext_PPRO.message('deleteClipMarkers');
    // the idea here is go through each marker and delete any with 'Transcriptive' in the name
    var cIn = parseFloat(clip.inPoint.seconds);
    var cOut = parseFloat(clip.outPoint.seconds);
    var rate = xmp.getStructField(XMPConst.NS_DM, tpath, XMPConst.NS_DM, 'frameRate');
    rate = this.parseFrameRate(rate && rate.value);
    var markersPath = XMPUtils.composeStructFieldPath(XMPConst.NS_DM, tpath, XMPConst.NS_DM, 'markers');
    var markers = xmp.countArrayItems(XMPConst.NS_DM, markersPath);
    for (var i = markers; i >= 1; i--) {
      var path = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, markersPath, i);
      var start = this.parseTimeValue(xmp.getStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'startTime').value, rate);
      // $._ext_PPRO.message('start' + ' ' + start + ' cIn ' + cIn + ' cOut ' + cOut);
      if (start >= cIn && start < cOut) {
        var name = xmp.getStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'name').value;
        // $._ext_PPRO.message('name' + ' ' + name);
        if (name.search('Transcriptive') >= 0) {
          xmp.deleteArrayItem(XMPConst.NS_DM, markersPath, i);
        }
      }
    }
  },
  writeClipMarkers: function (xmp, markers, clip) {
    var rate = 1000;
    var path;
    var count = xmp.countArrayItems(XMPConst.NS_DM, 'Tracks');
    for (var t = count; t >= 1; t--) {
      var tpath = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, 'Tracks', t);
      var type = xmp.getStructField(XMPConst.NS_DM, tpath, XMPConst.NS_DM, 'trackType').value;
      if (type === 'Comment') {
        path = tpath;
        this.deleteClipMarkers(xmp, path, clip);
        break;
      }
    }
    count = -1;
    if (path) {
      rate = xmp.getStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'frameRate');
      rate = this.parseFrameRate(rate && rate.value);
    } else {
      xmp.appendArrayItem(XMPConst.NS_DM, 'Tracks',
                          null,
                          XMPConst.PROP_IS_STRUCT,
                          XMPConst.ARRAY_IS_UNORDERED);
      path = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, 'Tracks',
                                           XMPConst.ARRAY_LAST_ITEM);
      xmp.setStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'trackName', 'Comment');
      xmp.setStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'trackType', 'Comment');
      xmp.setStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'frameRate', 'f' + rate);
      count = 0;
    }
    var markersPath = XMPUtils.composeStructFieldPath(XMPConst.NS_DM, path, XMPConst.NS_DM, 'markers');
    if (count < 0) {
      count = xmp.countArrayItems(XMPConst.NS_DM, markersPath);
    }
    var j = 1;
    for (var i = 0; i < markers.length; i++) {
      var marker = markers[i];
      var startTime = Math.round(marker.start * rate);
      var startJ = null;
      // Find position in existing markers.
      while (j <= count) {
        if (startJ === null) {
          var markerJ = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, markersPath, j);
          startJ = xmp.getStructField(XMPConst.NS_DM, markerJ, XMPConst.NS_DM, 'startTime').value;
        }
        if (startJ >= startTime) {
          break;
        }
        j++;
        startJ = null;
      }
      var index;
      if (j <= count) {
        xmp.insertArrayItem(XMPConst.NS_DM, markersPath,
                            j, null,
                            XMPConst.PROP_IS_STRUCT);
        index = j;
      } else {
        xmp.appendArrayItem(XMPConst.NS_DM, markersPath,
                            null,
                            XMPConst.PROP_IS_STRUCT,
                            XMPConst.ARRAY_IS_ORDERED);
        index = XMPConst.ARRAY_LAST_ITEM;
      }
      j++;
      count++;
      var markerN = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, markersPath, index);
      xmp.setStructField(XMPConst.NS_DM, markerN, XMPConst.NS_DM, 'startTime', startTime);
      if (marker.duration !== undefined && marker.duration > 0) {
        xmp.setStructField(XMPConst.NS_DM, markerN, XMPConst.NS_DM, 'duration', Math.round(marker.duration * rate));
      }
      if (marker.name !== undefined) {
        xmp.setStructField(XMPConst.NS_DM, markerN, XMPConst.NS_DM, 'name', marker.name);
      }
      if (marker.comments !== undefined) {
        xmp.setStructField(XMPConst.NS_DM, markerN, XMPConst.NS_DM, 'comment', marker.comments);
      }
    }
    var xmpAsString = xmp.serialize(); // serialize and write XMP.
    return xmpAsString;
  },
  readSpeechAnalysisFromClip: function (sequenceJson, clipJson, punctuate) {
    var result = {};
    var clip = $._ext_PPRO.getSequenceClip(sequenceJson, clipJson);
    if (clip && clip.projectItem) {
      if (!this.initXMP()) {
        return $._ext_JSON.stringify(result);
      }
      var c = $._ext_JSON.parse(clipJson);
      if (!c.start) {
        c.start = clip.start;
      }
      if (!c.end) {
        c.end = clip.end;
      }
      if (!c.inPoint) {
        c.inPoint = clip.inPoint;
      }
      if (!c.outPoint) {
        c.outPoint = clip.outPoint;
      }
      var xmp_blob = clip.projectItem.getXMPMetadata();
      var xmp = new XMPMeta(xmp_blob);
      var count = xmp.countArrayItems(XMPConst.NS_DM, 'Tracks');
      if (count > 0) {
        for (var i = 1; i <= count; i++) {
          var path = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, 'Tracks', i);
          var type = xmp.getStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'trackType').value;
          if (type === 'Speech') {
            var name = xmp.getStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'trackName').value;
            var markers = [];
            var rate = xmp.getStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'frameRate');
            rate = this.parseFrameRate(rate && rate.value);
            var markersPath = XMPUtils.composeStructFieldPath(XMPConst.NS_DM, path, XMPConst.NS_DM, 'markers');
            var words = [];
            var markersCount = xmp.countArrayItems(XMPConst.NS_DM, markersPath);
            var speaker;
            var speakerMap = {};
            var speakers = [];
            for (var j = 1; j <= markersCount; j++) {
              var markerJ = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, markersPath, j);
              var fields = ['startTime', 'duration', 'name', 'probability', 'speaker'];
              var obj = {};
              for (var f = 0; f < fields.length; f++) {
                var v = xmp.getStructField(XMPConst.NS_DM, markerJ, XMPConst.NS_DM, fields[f]);
                if (v !== undefined && v.value !== undefined) {
                  obj[fields[f]] = v.value;
                }
              }
              obj.startTime = this.parseTimeValue(obj.startTime, rate);
              obj.duration = this.parseTimeValue(obj.duration, rate);
              obj.probability /= 100;
              var endTime = obj.startTime + obj.duration;
              if (obj.startTime < c.outPoint.seconds &&
                  endTime >= c.inPoint.seconds) {
                if (obj.startTime < c.inPoint.seconds) {
                  obj.startTime = c.inPoint.seconds;
                }
                if (endTime > c.outPoint.seconds) {
                  endTime = c.outPoint.seconds;
                }
                var scale = (c.end.seconds - c.start.seconds) / (c.outPoint.seconds - c.inPoint.seconds);
                obj.startTime = (obj.startTime - c.inPoint.seconds) * scale + c.start.seconds;
                endTime = (endTime - c.inPoint.seconds) * scale + c.start.seconds;
                obj.duration = endTime - obj.startTime;
                if (punctuate && markers.length === 0 && j > 1) {
                  // Capitalize first word of clipped sentence.
                  obj.name = obj.name.charAt(0).toUpperCase().concat(obj.name.slice(1));
                }
                markers.push(obj);
              } else if (punctuate && obj.startTime >= c.outPoint.seconds && markers.length > 0) {
                // Add period to end of clipped sentence.
                if (markers[markers.length - 1].name.slice(-1).search('[.?!]') < 0) {
                  markers[markers.length - 1].name += '.';
                }
              }
            }
            result = { frameRate: rate, trackType: type, markers: markers };
            var lang;
            if (name) {
              var cmp = 'Transcriptive (';
              if (name.substr(0, cmp.length) === cmp) {
                lang = name.substr(cmp.length);
                if (lang.substr(-1) === ')') {
                  lang = lang.substr(0, lang.length - 1);
                }
              }
            }
            if (lang) {
              result.lang = lang;
            }
            break;
          }
        }
      }
    }
    return $._ext_JSON.stringify(result);
  },
  testSpeechAnalysisFromClip: function (sequenceJson, clipJson) {
    var result = false;
    var clip = $._ext_PPRO.getSequenceClip(sequenceJson, clipJson);
    if (clip && clip.projectItem) {
      if (!this.initXMP()) {
        return $._ext_JSON.stringify(result);
      }
      var c = $._ext_JSON.parse(clipJson);
      if (!c.start) {
        c.start = clip.start;
      }
      if (!c.end) {
        c.end = clip.end;
      }
      if (!c.inPoint) {
        c.inPoint = clip.inPoint;
      }
      if (!c.outPoint) {
        c.outPoint = clip.outPoint;
      }
      var xmp_blob = clip.projectItem.getXMPMetadata();
      var xmp = new XMPMeta(xmp_blob);
      var count = xmp.countArrayItems(XMPConst.NS_DM, 'Tracks');
      if (count > 0) {
        for (var i = 1; i <= count; i++) {
          var path = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, 'Tracks', i);
          var type = xmp.getStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'trackType').value;
          if (type === 'Speech') {
            var name = xmp.getStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'trackName').value;
            var rate = xmp.getStructField(XMPConst.NS_DM, path, XMPConst.NS_DM, 'frameRate');
            rate = this.parseFrameRate(rate && rate.value);
            var markersPath = XMPUtils.composeStructFieldPath(XMPConst.NS_DM, path, XMPConst.NS_DM, 'markers');
            var markersCount = xmp.countArrayItems(XMPConst.NS_DM, markersPath);
            for (var j = 1; j <= markersCount && !result; j++) {
              var markerJ = XMPUtils.composeArrayItemPath(XMPConst.NS_DM, markersPath, j);
              var fields = ['startTime', 'duration'];
              var obj = {};
              for (var f = 0; f < fields.length; f++) {
                var v = xmp.getStructField(XMPConst.NS_DM, markerJ, XMPConst.NS_DM, fields[f]);
                if (v !== undefined && v.value !== undefined) {
                  obj[fields[f]] = v.value;
                }
              }
              obj.startTime = this.parseTimeValue(obj.startTime, rate);
              obj.duration = this.parseTimeValue(obj.duration, rate);
              var endTime = obj.startTime + obj.duration;
              if (obj.startTime < c.outPoint.seconds &&
                  endTime >= c.inPoint.seconds) {
                result = true;
                break;
              }
            }
          }
        }
      }
    }
    return $._ext_JSON.stringify(result);
  },
  writeSpeechAnalysisToClip: function (sequenceJson, clipJson, markersJson) {
    var clip = $._ext_PPRO.getSequenceClip(sequenceJson, clipJson);
    if (clip && clip.projectItem) {
      if (!this.initXMP()) {
        return false;
      }
      var xmp_blob = clip.projectItem.getXMPMetadata();
      var xmp = new XMPMeta(xmp_blob);
      var markers = $._ext_JSON.parse(markersJson);
      var xmpAsString = this.writeSpeechAnalysisMarkers(xmp, markers, clip);
      clip.projectItem.setXMPMetadata(xmpAsString);
      clip.projectItem.refreshMedia();
      return true;
    }
    return false;
  },
  writeSpeechAnalysisToSidecar: function (path, sequenceJson, clipJson, markersJson) {
    var clip = $._ext_PPRO.getSequenceClip(sequenceJson, clipJson);
    var result = false;
    if (clip && clip.projectItem) {
      if (!this.initXMP()) {
        return false;
      }
      var file = new File(path);
      file.encoding = 'UTF8';
      if (file.open('e')) {
        xmp = new XMPMeta(file.read());
        var obj = $._ext_JSON.parse(markersJson);
        var xmpAsString = this.writeSpeechAnalysisMarkers(xmp, obj, clip);
        if (file.seek(0)) {
          result = file.write(xmpAsString);
        }
        file.close();
        var mediaPath = path.substr(0, path.length - 4);
        $._ext_PPRO.refreshMediaPath(mediaPath);
      }
    }
    return result;
  },
  writeSpeechAnalysisToClipFile: function (path, sequenceJson, clipJson, markersJson) {
    if (!this.initXMP()) {
      return false;
    }
    if (path.split('.').pop().toLowerCase() === 'xmp') {
      return this.writeSpeechAnalysisToSidecar(path, sequenceJson, clipJson, markersJson);
    }
    try {
      var file = new File(path);
      var xmpFile = new XMPFile(file.fsName,
                                XMPConst.UNKNOWN,
                                XMPConst.OPEN_FOR_UPDATE | XMPConst.OPEN_ONLY_XMP);
      var xmp = xmpFile.getXMP();
      if (!xmp) {
        xmp = new XMPMeta();
      }
      var obj = $._ext_JSON.parse(markersJson);
      this.writeSpeechAnalysisMarkers(xmp, obj, clip);
      if (xmpFile.canPutXMP(xmp)) {
        xmpFile.putXMP(xmp);
        xmpFile.closeFile(XMPConst.CLOSE_UPDATE_SAFELY);
        $._ext_PPRO.refreshMediaPath(path);
        return true;
      }
    } catch (err) {
      return false;
    }
    return false;
  },
  importSpeechAnalysisFromItem: function (projectItemPath) {
    var projectItem = $._ext_PPRO.projectItemFromPath(projectItemPath);
    var result = this.emptyObject;
    if (projectItem) {
      if (!this.initXMP()) {
        return $._ext_JSON.stringify(result);
      }
      var xmp_blob = projectItem.getXMPMetadata();
      var xmp = new XMPMeta(xmp_blob);
      result = this.readSpeechAnalysis(xmp);
    }
    return $._ext_JSON.stringify(result);
  },
  exportSpeechAnalysisToItem: function (projectItemPath, transcriptsJson) {
    var projectItem = $._ext_PPRO.projectItemFromPath(projectItemPath);
    if (projectItem) {
      if (!this.initXMP()) {
        return false;
      }
      var xmp_blob = projectItem.getXMPMetadata();
      var xmp = new XMPMeta(xmp_blob);
      var obj = $._ext_JSON.parse(transcriptsJson);
      var xmpAsString = this.writeSpeechAnalysis(xmp, obj);
      projectItem.setXMPMetadata(xmpAsString);
      projectItem.refreshMedia();
      return true;
    }
    return false;
  },
  deleteSpeechAnalysisFromClip: function (sequenceJson, clipJson) {
    var clip = $._ext_PPRO.getSequenceClip(sequenceJson, clipJson);
    if (clip && clip.projectItem) {
      if (!this.initXMP()) {
        return false;
      }
      var xmp_blob = clip.projectItem.getXMPMetadata();
      var xmp = new XMPMeta(xmp_blob);
      this.deleteSpeechAnalysis(xmp);
      var xmpAsString = xmp.serialize(); // serialize and write XMP.
      clip.projectItem.setXMPMetadata(xmpAsString);
      clip.projectItem.refreshMedia();
      return true;
    }
    return false;
  },
  fileSupportsXMP: function (path) {
    try {
      if (!this.initXMP()) {
        return false;
      }
      var file = new File(path);
      var xmpFile = new XMPFile(file.fsName, XMPConst.UNKNOWN, XMPConst.OPEN_FOR_READ);
      var info = xmpFile.getFileInfo();
      if ((info.handlerFlags & XMPConst.HANDLER_CAN_INJECT_XMP) &&
          (info.handlerFlags & XMPConst.HANDLER_CAN_EXPAND)) {
        return true;
      }
    } catch (err) {
      return false;
    }
    return false;
  },
  importSpeechAnalysisFromFile: function (path) {
    var result = this.emptyObject;
    if (!this.initXMP()) {
      return $._ext_JSON.stringify(result);
    }
    try {
      var file = new File(path);
      var xmpFile = new XMPFile(file.fsName,
                                XMPConst.UNKNOWN,
                                XMPConst.OPEN_FOR_READ | XMPConst.OPEN_ONLY_XMP);
      var xmp = xmpFile.getXMP();
      result = this.readSpeechAnalysis(xmp);
    } catch (err) {
      return $._ext_JSON.stringify(result);
    }
    return $._ext_JSON.stringify(result);
  },
  exportSpeechAnalysisToSidecar: function (path, transcriptsJson) {
    if (!this.initXMP()) {
      return false;
    }
    var result = false;
    var file = new File(path);
    file.encoding = 'UTF8';
    if (file.open('e')) {
      xmp = new XMPMeta(file.read());
      var obj = $._ext_JSON.parse(transcriptsJson);
      var xmpAsString = this.writeSpeechAnalysis(xmp, obj);
      if (file.seek(0)) {
        result = file.write(xmpAsString);
      }
      file.close();
      var mediaPath = path.substr(0, path.length - 4);
      $._ext_PPRO.refreshMediaPath(mediaPath);
    }
    return result;
  },
  exportSpeechAnalysisToFile: function (path, transcriptsJson) {
    if (!this.initXMP()) {
      return false;
    }
    if (path.split('.').pop().toLowerCase() === 'xmp') {
      return this.exportSpeechAnalysisToSidecar(path, transcriptsJson);
    }
    try {
      var file = new File(path);
      var xmpFile = new XMPFile(file.fsName,
                                XMPConst.UNKNOWN,
                                XMPConst.OPEN_FOR_UPDATE | XMPConst.OPEN_ONLY_XMP);
      var xmp = xmpFile.getXMP();
      if (!xmp) {
        xmp = new XMPMeta();
      }
      var obj = $._ext_JSON.parse(transcriptsJson);
      this.writeSpeechAnalysis(xmp, obj);
      if (xmpFile.canPutXMP(xmp)) {
        xmpFile.putXMP(xmp);
        xmpFile.closeFile(XMPConst.CLOSE_UPDATE_SAFELY);
        $._ext_PPRO.refreshMediaPath(path);
        return true;
      }
    } catch (err) {
      return false;
    }
    return false;
  },
  exportMarkersToClip: function (sequenceJson, clipJson, markersJson) {
    var clip = $._ext_PPRO.getSequenceClip(sequenceJson, clipJson);
    if (clip && clip.projectItem) {
      if (clip.projectItem.type === ProjectItemType.CLIP ||
          clip.projectItem.type === ProjectItemType.FILE) {
        var markerObjs = $._ext_JSON.parse(markersJson);
        $._ext_PPRO.exportMarkers(clip.projectItem.getMarkers(), markerObjs, clip);
        return true;
      }
    }
    return false;
  },
  exportMarkersToClipXMP: function (sequenceJson, clipJson, markersJson) {
    var clip = $._ext_PPRO.getSequenceClip(sequenceJson, clipJson);
    if (clip && clip.projectItem) {
      if (!this.initXMP()) {
        return false;
      }
      var xmp_blob = clip.projectItem.getXMPMetadata();
      var xmp = new XMPMeta(xmp_blob);
      var markers = $._ext_JSON.parse(markersJson);
      var xmpAsString = this.writeClipMarkers(xmp, markers, clip);
      clip.projectItem.setXMPMetadata(xmpAsString);
      clip.projectItem.refreshMedia();
      return true;
    }
    return false;
  },
  // See discussion of project metadata here:
  // https://forums.adobe.com/thread/2169243
  loadTranscriptsXMP: function () {
    var activeSequence = app.project.activeSequence;
    if (activeSequence) {
      if (!this.initXMP()) {
        return $._ext_JSON.stringify(this.emptyObject);
      }
      var xmp_blob = activeSequence.projectItem.getProjectMetadata();
      var xmp = new XMPMeta(xmp_blob);
      if (xmp.doesPropertyExist(this.kPProPrivateProjectMetadataURI, this.projectField)) {
        var result = xmp.getProperty(this.kPProPrivateProjectMetadataURI, this.projectField);
        if (result) {
          var x = new XMPMeta(result.value);
          result = this.readXMP(x);
          return $._ext_JSON.stringify(result);
        }
      }
    }
    return $._ext_JSON.stringify(this.emptyObject);
  },
  loadTranscripts: function (sequenceJson) {
    var sequenceObj = $._ext_JSON.parse(sequenceJson);
    var activeSequence = $._ext_PPRO.searchForSequence(sequenceObj);
    if (!activeSequence) {
      activeSequence = app.project.activeSequence;
    }
    if (activeSequence) {
      if (!this.initXMP()) {
        return $._ext_JSON.stringify(this.emptyObject);
      }
      var xmp_blob = activeSequence.projectItem.getProjectMetadata();
      var xmp = new XMPMeta(xmp_blob);
      if (xmp.doesPropertyExist(this.kPProPrivateProjectMetadataURI, this.projectField)) {
        var result = xmp.getProperty(this.kPProPrivateProjectMetadataURI, this.projectField);
        if (result) {
          if (result.value.substring(0, 1) === '{') {
            return result.value;
          }
          // Backwards compatibility
          var x = new XMPMeta(result.value);
          result = this.readXMP(x);
          return $._ext_JSON.stringify(result);
        }
      }
    }
    return $._ext_JSON.stringify(this.emptyObject);
  },
  loadTranscriptsPosition: function (sequenceJson) {
    var sequenceObj = $._ext_JSON.parse(sequenceJson);
    var activeSequence = $._ext_PPRO.searchForSequence(sequenceObj);
    if (!activeSequence) {
      activeSequence = app.project.activeSequence;
    }
    if (activeSequence) {
      if (!this.initXMP()) {
        return $._ext_JSON.stringify(this.emptyObject);
      }
      var xmp_blob = activeSequence.projectItem.getProjectMetadata();
      var xmp = new XMPMeta(xmp_blob);
      if (xmp.doesPropertyExist(this.kPProPrivateProjectMetadataURI, this.positionField)) {
        var result = xmp.getProperty(this.kPProPrivateProjectMetadataURI, this.positionField);
        if (result) {
          return result.value;
        }
      }
    }
    return '';
  },
  saveTranscriptsXMP: function (sequenceJson, transcriptsJson) {
    var transcribedSeq = $._ext_JSON.parse(sequenceJson);
    var curSequence = $._ext_PPRO.searchForSequence(transcribedSeq);
    if (curSequence) {
      if (!this.initXMP()) {
        return false;
      }
      var xmp_blob = curSequence.projectItem.getProjectMetadata();
      var xmp = new XMPMeta(xmp_blob);
      var obj = $._ext_JSON.parse(transcriptsJson);
      var transXMP = new XMPMeta();
      var xmpAsString = this.writeXMP(transXMP, obj);
      // 2 means text type.
      var successfullyAdded = app.project.addPropertyToProjectMetadataSchema(this.projectField, this.projectLabel, 2);
      if (successfullyAdded) {
        var array = [];
        xmp.setProperty(this.kPProPrivateProjectMetadataURI,
                        this.projectField, xmpAsString);
        array[0] = this.projectField;
        var str = xmp.serialize();
        curSequence.projectItem.setProjectMetadata(str, array);
        return true;
      }
    }
    return false;
  },
  saveTranscripts: function (sequenceJson, transcriptsJson) {
    var transcribedSeq = $._ext_JSON.parse(sequenceJson);
    var curSequence = $._ext_PPRO.searchForSequence(transcribedSeq);
    if (curSequence) {
      if (!this.initXMP()) {
        return false;
      }
      var xmp_blob = curSequence.projectItem.getProjectMetadata();
      var xmp = new XMPMeta(xmp_blob);
      // 2 means text type.
      var successfullyAdded = app.project.addPropertyToProjectMetadataSchema(this.projectField, this.projectLabel, 2);
      if (successfullyAdded) {
        var array = [];
        xmp.setProperty(this.kPProPrivateProjectMetadataURI,
                        this.projectField, transcriptsJson);
        array[0] = this.projectField;
        var str = xmp.serialize();
        curSequence.projectItem.setProjectMetadata(str, array);
        return true;
      }
    }
    return false;
  },
  saveTranscriptsPosition: function (sequenceJson, pos) {
    var transcribedSeq = $._ext_JSON.parse(sequenceJson);
    var curSequence = $._ext_PPRO.searchForSequence(transcribedSeq);
    if (curSequence) {
      if (!this.initXMP()) {
        return false;
      }
      var xmp_blob = curSequence.projectItem.getProjectMetadata();
      var xmp = new XMPMeta(xmp_blob);
      // 2 means text type.
      var successfullyAdded = app.project.addPropertyToProjectMetadataSchema(this.positionField, this.positionLabel, 2);
      if (successfullyAdded) {
        var array = [];
        xmp.setProperty(this.kPProPrivateProjectMetadataURI,
                        this.positionField, pos.toString());
        array[0] = this.positionField;
        var str = xmp.serialize();
        curSequence.projectItem.setProjectMetadata(str, array);
        return true;
      }
    }
    return false;
  }
};
