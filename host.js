'use strict';

const PProPanelExportEvents = {};

// Promisfy CSInterface.evalScript() function
function evalScript(command, errValue, errString) {
  const csInterface = new CSInterface();

  return new Promise(function (resolve, reject) {
    csInterface.evalScript(command, function (result) {
      if (result === csInterface.EvalScript_ErrMessage) {
        reject(new Error(result));
      } else if (errValue !== undefined && result === errValue) {
        reject(new Error(errString || result));
      } else {
        resolve(result);
      }
    });
  });
}

function evalScriptBool(command, errString) {
  const csInterface = new CSInterface();

  return new Promise(function (resolve, reject) {
    csInterface.evalScript(command, function (result) {
      if (result === false || result === 'false' || result === 0 || result === '0' || result === '') {
        reject(new Error(errString || result));
      } else if (result === true || result === 'true' || result === 1 || result === '1') {
        resolve(result);
      } else {
        reject(new Error(result));
      }
    });
  });
}

function evalScriptJSON(command, errString) {
  const csInterface = new CSInterface();

  return new Promise(function (resolve, reject) {
    csInterface.evalScript(command, function (resultStr) {
      let result;
      try {
        result = JSON.parse(resultStr);
      } catch (e) {
        // Probably error from evalScript.
        reject(new Error((errString ? (errString + ': ') : '') + resultStr));
        return;
      }
      if (result && result.error !== undefined) {
        reject(new Error((errString ? (errString + ': ') : '') + result.error));
      } else {
        resolve(result);
      }
    });
  });
}

// Usage:
// evalFunction('$._ext_PPRO.test', [42, true, 'string', 'needs some quotes']);
// evalScript only supports simple types, no arrays or objects.

function makeEvalCommand(name, args) {
  const argStrings = args.map(function (a) {
    return (typeof a === 'string') ? quoteString(a) : ('' + a);
  });
  return name + '(' + argStrings + ')';
}

function evalFunction(name, args, errValue, errString) {
  return evalScript(makeEvalCommand(name, args), errValue, errString);
}

function evalFunctionBool(name, args, errString) {
  return evalScriptBool(makeEvalCommand(name, args), errString);
}

function evalFunctionJSON(name, args, errString) {
  return evalScriptJSON(makeEvalCommand(name, args), errString);
}

function getActiveSequence() {
  return evalScriptJSON('$._ext_PPRO.getActiveSequence()');
}

function getActiveSequenceCurrentTime(sequenceID) {
  return evalFunction('$._ext_PPRO.getActiveSequenceCurrentTime', [sequenceID]);
}

function playActiveSequence(sequenceID, speed) {
  return evalFunctionBool('$._ext_PPRO.play', [sequenceID, (speed !== undefined) ? speed : 1]);
}

function stopActiveSequence(sequenceID) {
  return evalFunctionBool('$._ext_PPRO.stop', [sequenceID]);
}

function setPlayerPosition(sequenceID, secs) {
  return evalFunctionBool('$._ext_PPRO.setPlayerPosition', [sequenceID, secs]);
}

function getInstallerFileSuffix() {
  return '_Pr';
}

function exportSettings(options) {
  const o = options || {};
  const ext = o.ext || '.flac';
  const bitrate = o.bitrate || (128 * 1024);
  const preset = (ext === '.mp3') ? ('MP3 ' + Math.round(bitrate / 1024) + ' kbps Mono.epr') : 'FLAC 16kHz Mono.epr';
  const csInterface = new CSInterface();
  const OSVersion = csInterface.getOSInformation();
  const sep = (OSVersion.indexOf('Windows') >= 0) ? '\\' : '/';
  const presetPath = getPanelPath() + sep + 'payloads' + sep + preset;
  return { ext: ext, presetPath: presetPath };
}

function exportSequence(options) {
  const bg = (options && options.background !== undefined) ? options.background : false;
  const o = exportSettings(options);
  return evalFunctionJSON('$._ext_PPRO.exportSequence', [o.presetPath, o.ext, getDocumentsPath(), bg])
    .then(function (result) {
      return new Promise(function (resolve, reject) {
        if (result.outputPath) {
          resolve(result);
        } else if (result.jobID !== undefined) {
          PProPanelExportEvents[result.jobID] = function (outputPath, error) {
            delete PProPanelExportEvents[result.jobID];
            if (outputPath) {
              resolve({ outputPath: outputPath });
            } else {
              reject(new Error(error || 'Export failed'));
            }
          };
        } else {
          reject(new Error(result.error || 'Export failed'));
        }
      });
    });
}

function buggyDraftJS() {
  const csInterface = new CSInterface();
  // CC 2018 (Mac only) has editing issues, for unknown reasons.
  const OSVersion = csInterface.getOSInformation();
  if (OSVersion.indexOf('Windows') >= 0) {
    return false;
  }
  const majorVersion = parseInt(csInterface.hostEnvironment.appVersion.split('.')[0], 0);
  return (majorVersion >= 12);
}

function buggyClipMarkerExport() {
  const csInterface = new CSInterface();
  // CC 2018 fixed super slow clip marker export when Speech Analysis is present.
  const majorVersion = parseInt(csInterface.hostEnvironment.appVersion.split('.')[0], 0);
  return (majorVersion < 12);
}

function supportsTranscodeItem() {
  return evalScriptBool('$._ext_PPRO.supportsEncodeItem()', 'Requires CC 2017');
}

function supportsTranscode() {
  const csInterface = new CSInterface();
  if (csInterface.hostEnvironment.appVersion.startsWith('11.1')) {
    return new Promise(function (resolve, reject) {
      reject(new Error('app.encoder.encodeFile is broken'));
    });
  }
  return evalScriptBool('$._ext_PPRO.supportsEncodeItem()', 'Requires CC 2017');
}

function transcodeFile(path, binName, options) {
  const o = exportSettings(options);
  return evalFunctionJSON('$._ext_PPRO.encodeFile', [o.presetPath, o.ext, path, getDocumentsPath(), binName || null])
    .then(function (result) {
      return new Promise(function (resolve, reject) {
        PProPanelExportEvents[result.jobID] = function (outputPath, error) {
          delete PProPanelExportEvents[result.jobID];
          if (outputPath) {
            resolve({ outputPath: outputPath });
          } else {
            reject(new Error(error || 'Encode failed'));
          }
        };
      });
    });
}

function transcodeItem(projectItemPath, options) {
  const o = exportSettings(options);
  return evalFunctionJSON('$._ext_PPRO.encodeItem', [o.presetPath, o.ext, projectItemPath, getDocumentsPath()])
    .then(function (result) {
      return new Promise(function (resolve, reject) {
        PProPanelExportEvents[result.jobID] = function (outputPath, error) {
          delete PProPanelExportEvents[result.jobID];
          if (outputPath) {
            resolve({ outputPath: outputPath });
          } else {
            reject(new Error(error || 'Encode failed'));
          }
        };
      });
    });
}

function openLoadDialog(prompt, fileTypes, multipleFiles, selected) {
  return evalFunctionJSON('$._ext_PPRO.openLoadDialog', [prompt, JSON.stringify(fileTypes), multipleFiles || false, selected || null]);
}

function openSaveDialog(prompt, fileType, selected) {
  return evalFunctionJSON('$._ext_PPRO.openSaveDialog', [prompt, fileType, selected || null]);
}

function openSelectDialog(prompt, selected) {
  return evalFunctionJSON('$._ext_PPRO.openSelectDialog', [prompt, selected || null]);
}

function exportMarkersToSequence(sequence, markers) {
  const sequenceJson = JSON.stringify(sequence);
  const markersJson = JSON.stringify(markers);

  return evalFunction('$._ext_PPRO.exportMarkersToSequence', [sequenceJson, markersJson]);
}

function exportMarkersToClip(sequence, clip, markers) {
  const sequenceJson = JSON.stringify(sequence);
  const clipJson = JSON.stringify(clip);
  const markersJson = JSON.stringify(markers);
  return evalFunction('$._ext_XMP.exportMarkersToClip', [sequenceJson, clipJson, markersJson]);
}

function getProjectItems(binName, audioTracks, videoTracks) {
  const audio = (audioTracks === undefined) ? true : audioTracks;
  const video = (videoTracks === undefined) ? false : videoTracks;
  return evalFunctionJSON('$._ext_PPRO.getProjectItems', [binName || '', audio, video]);
}

function getSequence(sequence) {
  return evalFunctionJSON('$._ext_PPRO.getSequence', [JSON.stringify(sequence)]);
}

function getSequenceItems(sequence, audioTracks, videoTracks) {
  const audio = (audioTracks === undefined) ? true : audioTracks;
  const video = (videoTracks === undefined) ? false : videoTracks;
  return evalFunctionJSON('$._ext_PPRO.getSequenceItems', [JSON.stringify(sequence), audio, video]);
}

function getSequenceClips(sequence) {
  return evalFunctionJSON('$._ext_PPRO.getSequenceClips', [JSON.stringify(sequence)]);
}

function getClipMediaStart(sequence, clip) {
  return evalFunctionJSON('$._ext_XMP.getClipMediaStart', [JSON.stringify(sequence), JSON.stringify(clip)]);
}

function readSpeechAnalysisFromClip(sequence, clip, punctuate) {
  return evalFunctionJSON('$._ext_XMP.readSpeechAnalysisFromClip', [JSON.stringify(sequence), JSON.stringify(clip), punctuate]);
}

function testSpeechAnalysisFromClip(sequence, clip) {
  return evalFunction('$._ext_XMP.testSpeechAnalysisFromClip', [JSON.stringify(sequence), JSON.stringify(clip)]);
}

function importFiles(files, binName) {
  return evalFunctionBool('$._ext_PPRO.importFiles', [JSON.stringify(files), binName || '']);
}

function findImportedFiles(files, binName) {
  return evalFunctionJSON('$._ext_PPRO.findImportedFiles', [JSON.stringify(files), binName || '']);
}

function findUniqueBin(binName) {
  return evalFunction('$._ext_PPRO.findUniqueBin', [binName]);
}

function deleteBin(binName) {
  return evalFunctionBool('$._ext_PPRO.deleteBin', [binName]);
}

/**
 * Prepare a string to be used with evalScript.
 *
 * @param {String} s Input string
 * @returns {String} Quoted string
 */
function quoteString(s) {
  // From json2:
  const escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
  const meta = { // table of character substitutions
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '\\': '\\\\',
    '"': '\\"'
  };
  // If the string contains no control characters, no quote characters, and no
  // backslash characters, then we can safely slap some quotes around it.
  // Otherwise we must also replace the offending characters with safe escape
  // sequences.
  escapable.lastIndex = 0;
  return escapable.test(s) ? '"' + s.replace(escapable, function (a) {
    const c = meta[a];
    return typeof c === 'string'
      ? c
      : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
  }) + '"' : '"' + s + '"';
}

/**
 * Get the path to the SecretSauce ExternalObject.
 *
 * @returns {String} Path to SecretSauce ExternalObject
 */
function getSecretSaucePath() {
  const csInterface = new CSInterface();
  const OSVersion = csInterface.getOSInformation();
  const sep = (OSVersion.indexOf('Windows') >= 0) ? '\\' : '/';

  let libpath = csInterface.getSystemPath(SystemPath.EXTENSION);
  libpath = libpath.concat(sep, 'ExternalObjects', sep, 'SecretSauce');
  if (OSVersion.indexOf('Windows') >= 0) {
    libpath += '.dll';
  }

  return libpath;
}

/**
 * Get the path to the top level directory of the panel.
 *
 * @returns {String} Path to top level directory of the panel
 */
function getPanelPath() {
  const csInterface = new CSInterface();
  return csInterface.getSystemPath(SystemPath.EXTENSION);
}

/**
 * Gets the saved username and password as { 'username': '', 'password': '' }
 *
 * @param {String} serverName Internet domain
 * @param {String} path URL path = ""
 * @returns {Object} as { 'username': '', 'password': '' }
 */
function findInternetPassword(serverName, path) {
  return evalFunctionJSON('$._ext_SecretSauce.findInternetPassword', [getSecretSaucePath(), serverName.replace('https://', ''), path || ''], 'findInternetPassword');
}

/**
 * Gets the generic saved username and password as { 'username': '', 'password': '' }
 *
 * @param {String} serviceName Service name
 * @returns {Object} as { 'username': '', 'password': '' }
 */
function findGenericPassword(serviceName) {
  return evalFunctionJSON('$._ext_SecretSauce.findGenericPassword', [getSecretSaucePath(), serviceName], 'findGenericPassword');
}

/**
 * Save username and password.
 *
 * @param {String} account Username
 * @param {String} passwd Password
 * @param {String} serverName Internet domain
 * @param {String} path URL path = ""
 * @returns {bool} Success or failure
 */
function addInternetPassword(account, passwd, serverName, path) {
  return evalFunctionBool('$._ext_SecretSauce.addInternetPassword', [getSecretSaucePath(), account, passwd, serverName.replace('https://', ''), path || ''], 'Unable to save password.');
}

/**
 * Save generic username and password.
 *
 * @param {String} account Username
 * @param {String} passwd Password
 * @param {String} serviceName Service name
 * @returns {bool} Success or failure
 */
function addGenericPassword(account, passwd, serviceName) {
  return evalFunctionBool('$._ext_SecretSauce.addGenericPassword', [getSecretSaucePath(), account, passwd, serviceName], 'Unable to save password.');
}

/**
 * Deletes the saved username and password.
 *
 * @param {String} serverName Internet domain
 * @param {String} path URL path = ""
 * @returns {bool} Success or failure
 */
function deleteInternetPassword(serverName, path) {
  return evalFunctionBool('$._ext_SecretSauce.deleteInternetPassword', [getSecretSaucePath(), serverName.replace('https://', ''), path || ''], 'deleteInternetPassword');
}

/**
 * Deletes the generic saved username and password.
 *
 * @param {String} serviceName Service name
 * @returns {bool} Success or failure
 */
function deleteGenericPassword(serviceName) {
  return evalFunctionBool('$._ext_SecretSauce.deleteGenericPassword', [getSecretSaucePath(), serviceName], 'deleteGenericPassword');
}

/**
 * Perform Watson postprocessing.  To add speakers to broadband results,
 * copy "speaker_labels" from narrowband results before this call.
 *
 * @param {Object} results Results from Watson speech-to-text.
 * @param {String} lang Language, currently: ar-AR en-UK en-US es-ES fr-FR ja-JP pt-BR zh-CN
 * @param {Number} startTime Starting time of data in seconds.
 * @param {Number} maxSpeakers Maximum number of unique speakers.
 * @param {bool} questions Identify questions.
 * @param {String} ignore Words to ignore.
 * @param {String} interrogatives Words to identify a question.
 * @param {String} core Words to identify a question, if followed by a verb.
 * @param {String} verbs Verbs to identify a question.
 * @returns {Promise} Object formatted as: { transcripts: data, speakers: {}, lang: 'en-US' }
 */
function watsonPostprocess(results, lang, startTime, maxSpeakers, questions, ignore, interrogatives, core, verbs) {
  return evalFunctionJSON('$._ext_SecretSauce.watsonPostprocess', [getSecretSaucePath(), JSON.stringify(results), lang, startTime, maxSpeakers || 10, questions, ignore || '', interrogatives || '', core || '', verbs || '']);
}

/**
 * Perform Speechmatics postprocessing
 * To add speakers from a Watson narrowband pass,
 * copy "speaker_labels" from narrowband results before this call.
 *
 * @param {Object} results Results from Speechmatics.
 * @param {String} lang Language, currently: ca cs de el en-AU en-GB en-US es fi fr hi hu it ja nl pl pt ro ru sv
 * @param {Number} startTime Starting time of data in seconds.
 * @param {Number} maxSpeakers Maximum number of unique speakers.
 * @param {bool} questions Identify questions.
 * @param {String} ignore Words to ignore.
 * @param {String} interrogatives Words to identify a question.
 * @param {String} core Words to identify a question, if followed by a verb.
 * @param {String} verbs Verbs to identify a question.
 * @returns {Promise} Object formatted as: { transcripts: data, speakers: {}, lang: 'en-US' }
 */
function speechmaticsPostprocess(results, lang, startTime, maxSpeakers, questions, ignore, interrogatives, core, verbs) {
  return evalFunctionJSON('$._ext_SecretSauce.speechmaticsPostprocess', [getSecretSaucePath(), JSON.stringify(results), lang, startTime, maxSpeakers || 10, questions || '', ignore || '', interrogatives || '', core || '', verbs || '']);
}

/**
 * Perform VoiceBase postprocessing
 * To add speakers from a Watson narrowband pass,
 * copy "speaker_labels" from narrowband results before this call.
 *
 * @param {Object} results Results from VoiceBase.
 * @param {String} lang Language, currently: en-AU en-UK en-US pt-BR es-LA
 * @param {Number} startTime Starting time of data in seconds.
 * @param {Number} maxSpeakers Maximum number of unique speakers.
 * @param {bool} questions Identify questions.
 * @param {String} ignore Words to ignore.
 * @param {String} interrogatives Words to identify a question.
 * @param {String} core Words to identify a question, if followed by a verb.
 * @param {String} verbs Verbs to identify a question.
 * @returns {Promise} Object formatted as: { transcripts: data, speakers: {}, lang: 'en-US' }
 */
function voicebasePostprocess(results, lang, startTime, maxSpeakers, questions, ignore, interrogatives, core, verbs) {
  return evalFunctionJSON('$._ext_SecretSauce.voicebasePostprocess', [getSecretSaucePath(), JSON.stringify(results), lang, startTime, maxSpeakers || 10, questions || '', ignore || '', interrogatives || '', core || '', verbs || '']);
}

/**
 * Returns the user's documents directory.
 *
 * @returns {String} User's documents directory.
 */
function getDocumentsPath() {
  const csInterface = new CSInterface();
  return csInterface.getSystemPath(SystemPath.MY_DOCUMENTS);
}

/**
 * Move a file to the trash folder.
 *
 * @param {String} filename Path to file
 * @returns {bool} Success or failure.
 */
function moveFileToTrash(filename) {
  return evalFunction('$._ext_SecretSauce.moveFileToTrash', [getSecretSaucePath(), filename]);
}

/**
 * Read values from the user's preferences.
 * Any number of key strings can be provided in 'arguments'.
 * Keys can specify a type by prepending one of bool: integer: number: string:
 * Keys can contain dots, which return sub objects (and create registry subkeys on Windows).
 * No arguments means to read all saved preferences.
 * On Windows:
 * Numbers might save been saved as strings, so specify type or call parseFloat() or Number().
 * Booleans are saved as integers, i.e. 0 or 1.
 *
 * @returns {Object} Object or for one argument, string, Number, bool, or null (not present).
 */
function readPreferences() {
  if (arguments.length === 1 && typeof arguments[0] === 'object') {
    return evalFunctionJSON('$._ext_SecretSauce.readPreferences',
                            [getSecretSaucePath(), JSON.stringify(arguments[0])],
                            'readPreferences failed');
  }
  // Make sure we have an array.
  const args = [];
  for (let i = 0; i < arguments.length; i++) {
    args.push(arguments[i]);
  }
  return evalFunctionJSON('$._ext_SecretSauce.readPreferences',
                          [getSecretSaucePath(), JSON.stringify(args)],
                          'readPreferences failed');
}

/**
 * Write key/value pairs to the user's preferences.
 * Keys can specify a type by prepending one of bool: integer: number: string:
 * Values can be a String, Number, or bool.  The same type must always be used for a key.
 * On Windows:
 * Keys can contain dots, or this can be constructed with object values.
 * Registry values are either strings or integers.
 * A Number will be saved as a string unless type is "integer".
 * A bool will be saved as an integer.
 *
 * @param {Object} keyValues Object containing key/value pairs.
 * @param {String} forceType Force value to this type.
 * @returns {Promise} Success or failure.
 */
function writePreferences(keyValues, forceType) {
  return evalFunctionBool('$._ext_SecretSauce.writePreferences',
                          [getSecretSaucePath(), JSON.stringify(keyValues), forceType || ''],
                          'writePreferences failed');
}

/**
 * Get maximum allowed sequence duration in seconds.
 * This function can be easily cracked so this is only
 * for the user's benefit, e.g. preventing unnecessary billing.
 *
 * @returns {Number} Maximum duration in seconds.
 */
function getMaxDuration() {
  return evalFunctionJSON('$._ext_SecretSauce.getMaxDuration', [getSecretSaucePath()])
    .then(function (secs) {
      return secs;
    }).catch(function (error) {
      return 0.0;
    });
}

/**
 * Authorize serial number.
 *
 * @param {String} name Name
 * @param {String} org Organization
 * @param {String} serial Serial number
 * @returns {Object} Object formatted as { valid, trial, expiration, maxDuration }
 */
function authorizeSerialNumber(name, org, serial) {
  return evalFunctionJSON('$._ext_SecretSauce.authorizeSerialNumber', [getSecretSaucePath(), name, org, serial]);
}

/**
 * Network checking for serial number.
 * This function can be easily cracked.
 *
 * @returns {String} Network error message
 */
function netError() {
  return evalFunction('$._ext_SecretSauce.netError', [getSecretSaucePath()]);
}

/**
 * Load serial number.
 * This function can be easily cracked so this is only
 * for the user's benefit, e.g. preventing unnecessary billing.
 *
 * @returns {Object} Object formatted as { valid, trial, expiration, maxDuration }
 */
function startupSpeech() {
  return evalFunctionJSON('$._ext_SecretSauce.startup', [getSecretSaucePath()]);
}

function handlePProPanelExportEvent(event, retries) {
  try {
    const jobID = event.data.jobID;
    const callback = PProPanelExportEvents[jobID];
    if (callback) {
      callback(event.data.outputFilePath, event.data.error);
    } else {
      setTimeout(function () {
        if (retries === 10) {
          console.log(`com.adobe.csxs.events.PProPanelExportEvent: ${jobID} not found`);
        } else {
          handlePProPanelExportEvent(event, (retries || 0) + 1);
        }
      }, 1000);
    }
  } catch (err) {
    console.log(err);
  }
}

/**
 * Load Secret Sauce.
 *
 * @returns {Promise} Promise for completion.
 */
function loadSpeech() {
  const csInterface = new CSInterface();
  csInterface.addEventListener('com.adobe.csxs.events.PProPanelExportEvent', function (event) {
    handlePProPanelExportEvent(event);
  });
  return evalFunction('$._ext_SecretSauce.load', [getSecretSaucePath()]);
}

/**
 * Open URL in a new window.
 *
 * @param {String} url URL to open.
 */
function openURL(url) {
  const csInterface = new CSInterface();
  csInterface.openURLInDefaultBrowser(url);
}

/**
 * Register hotkeys.  See CEP HTML Extension Cookbook for the intermediate format.
 * keyEvents follows the style of mousetrap and is mapped to CEP format,
 * including OS specific integers for key codes.
 *
 * @param {String} keyEvents String of keys matching the mousetrap module.
 */
function registerHotkeys(keyEvents) {
  const csInterface = new CSInterface();
  const libpath = quoteString(getSecretSaucePath());
  const k = quoteString(keyEvents);
  csInterface.evalScript(`$._ext_SecretSauce.getKeyEvents(${libpath}, ${k})`, csInterface.registerKeyEventsInterest);
}

/**
 * Translate Mousetrap hotkeys to their unshifted, keyboard dependent equivalents.
 *
 * @param {String} hotkeys String of keys matching the mousetrap module.
 * @returns {Promise} String of unshifted hotkeys.
 */
function unshiftHotkeys(hotkeys) {
  return evalFunction('$._ext_SecretSauce.unshiftHotkeys', [getSecretSaucePath(), hotkeys]);
}

/**
 * Test if a file supports XMP.
 *
 * @param {String} file Path to file.
 * @returns {bool} True if supported.
 */
function fileSupportsXMP(file) {
  return evalFunctionJSON('$._ext_XMP.fileSupportsXMP', [file]);
}

function buggyXMP(file) {
  if (file.toLowerCase().endsWith('.mts')) {
    const csInterface = new CSInterface();
    // Windows has issues with XMP in MTS.
    const OSVersion = csInterface.getOSInformation();
    if (OSVersion.indexOf('Windows') >= 0) {
      // When Premiere is fixed, do something like this:
      // const majorVersion = parseInt(csInterface.hostEnvironment.appVersion.split('.')[0], 0);
      // return (majorVersion >= 12);
      return true;
    }
  }
  return false;
}

/**
 * Load transcripts from clip XMP.
 * Return value is formatted as: { transcripts: data, speakers: {}, lang: 'en-US' }
 *
 * @param {String} file Path to file.
 * @returns {Object} Object formatted as: { transcripts: data, speakers: {}, lang: 'en-US' }
 */
function importSpeechAnalysisFromFile(file) {
  return evalFunctionJSON('$._ext_XMP.importSpeechAnalysisFromFile', [file]);
}

/**
 * Load transcripts from clip XMP.
 * Return value is formatted as: { transcripts: data, speakers: {}, lang: 'en-US' }
 *
 * @param {String} projectItem Project item tree path.
 * @returns {Object} Object formatted as: { transcripts: data, speakers: {}, lang: 'en-US' }
 */
function importSpeechAnalysisFromItem(projectItem) {
  return evalFunctionJSON('$._ext_XMP.importSpeechAnalysisFromItem', [projectItem]);
}

/**
 * Save transcripts to a file's XMP.
 *
 * @param {String} file Path to file.
 * @param {Object} transcripts Formatted as: { transcripts: data, speakers: {}, lang: 'en-US' }
 * @returns {Promise} Success or failure.
 */
function exportSpeechAnalysisToFile(file, transcripts) {
  const transcriptsJson = JSON.stringify(transcripts);
  return evalFunctionBool('$._ext_XMP.exportSpeechAnalysisToFile', [file, transcriptsJson]);
}

/**
 * Write Speech Analysis markers to clip XMP.
 *
 * @param {Object} sequence Active sequence
 * @param {Object} clip Clip in sequence
 * @param {Object} markers Array of marker objects
 * @returns {Promise} Success or failure.
 */
function writeSpeechAnalysisToClip(sequence, clip, markers) {
  const sequenceJson = JSON.stringify(sequence);
  const clipJson = JSON.stringify(clip);
  const markersJson = JSON.stringify(markers);
  if (clip.mediaPath && this.buggyXMP(clip.mediaPath)) {
    return evalFunction('$._ext_XMP.writeSpeechAnalysisToClipFile', [clip.mediaPath + '.xmp', sequenceJson, clipJson, markersJson]);
  }
  return evalFunction('$._ext_XMP.writeSpeechAnalysisToClip', [sequenceJson, clipJson, markersJson]);
}

/**
 * Save transcripts to a file's XMP.
 *
 * @param {String} projectItem Project item tree path.
 * @param {Object} transcripts Formatted as: { transcripts: data, speakers: {}, lang: 'en-US' }
 * @returns {Promise} Success or failure.
 */
function exportSpeechAnalysisToItem(projectItem, transcripts) {
  const _self = this;
  return evalFunction('$._ext_PPRO.getProjectItemMediaPath', [projectItem])
    .then(function (mediaPath) {
      if (mediaPath && _self.buggyXMP(mediaPath)) {
        return exportSpeechAnalysisToFile(mediaPath + '.xmp', transcripts);
      }
      const transcriptsJson = JSON.stringify(transcripts);
      return evalFunctionBool('$._ext_XMP.exportSpeechAnalysisToItem', [projectItem, transcriptsJson]);
    });
}

/**
 * Delete Speech Analysis markers from clip XMP.
 *
 * @param {Object} sequence Active sequence
 * @param {Object} clip Clip in sequence
 * @returns {Promise} Success or failure.
 */
function deleteSpeechAnalysisFromClip(sequence, clip) {
  const sequenceJson = JSON.stringify(sequence);
  const clipJson = JSON.stringify(clip);
  return evalFunction('$._ext_XMP.deleteSpeechAnalysisFromClip', [sequenceJson, clipJson]);
}

/**
 * Load transcripts from sequence metadata.
 * Return value is formatted as: { transcripts: data, speakers: {}, lang: 'en-US' }
 *
 * @param {Object} sequence Active sequence (optional)
 * @returns {Object} Object formatted as: { transcripts: data, speakers: {}, lang: 'en-US' }
 */
function loadTranscripts(sequence) {
  const sequenceJson = JSON.stringify(sequence || null);
  return evalFunctionJSON('$._ext_XMP.loadTranscripts', [sequenceJson]);
}

/**
 * Load position from sequence metadata.
 *
 * @param {Object} sequence Active sequence (optional)
 * @returns {Number} Position in seconds.
 */
function loadTranscriptsPosition(sequence) {
  const sequenceJson = JSON.stringify(sequence || null);
  return evalFunctionJSON('$._ext_XMP.loadTranscriptsPosition', [sequenceJson]);
}

/**
 * Save transcripts to sequence metadata.
 *
 * @param {Object} sequence Active sequence
 * @param {Object} transcripts Formatted as: { transcripts: data, speakers: {}, lang: 'en-US' }
 * @returns {Promise} Success or failure.
 */
function saveTranscripts(sequence, transcripts) {
  const sequenceJson = JSON.stringify(sequence);
  const transcriptsJson = JSON.stringify(transcripts);
  return evalFunctionBool('$._ext_XMP.saveTranscripts', [sequenceJson, transcriptsJson],
                          'saveTranscripts failed');
}

/**
 * Save position to sequence metadata.
 *
 * @param {Object} sequence Active sequence
 * @param {Number} pos Position in seconds
 * @returns {Promise} Success or failure.
 */
function saveTranscriptsPosition(sequence, pos) {
  const sequenceJson = JSON.stringify(sequence);
  return evalFunctionBool('$._ext_XMP.saveTranscriptsPosition', [sequenceJson, pos],
                          'saveTranscriptsPosition failed');
}

/* Legacy functions */

function loadTranscriptsXMP() {
  return evalFunctionJSON('$._ext_XMP.loadTranscriptsXMP', []);
}

function saveTranscriptsXMP(sequence, transcripts) {
  const sequenceJson = JSON.stringify(sequence);
  const transcriptsJson = JSON.stringify(transcripts);
  return evalFunctionBool('$._ext_XMP.saveTranscriptsXMP', [sequenceJson, transcriptsJson],
                          'saveTranscriptsXMP failed');
}
