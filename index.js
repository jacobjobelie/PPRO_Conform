const { v4 } = require('uuid');
const Parse = require('path-parse');

const requestJSON = async function(url) {
  const response = await fetch(url);
  const json = await response.json();
  return json
};


const insertClip = async clip => {
  const { treePath } = await window.evalFunctionJSON('$._PPP_.findClipByName', [
    clip.clipName ? clip.clipName : Parse(clip.mediaPath).base,
    true,
  ]);
  const inTime = clip.startTime.toFixed(3).toString()
  const outTime = (clip.startTime + clip.duration).toFixed(3).toString()

  console.log(treePath);
  console.log(inTime, outTime);
  const timeValues = await window.evalFunctionJSON('$._PPP_.extractFrameRate', [clip.clipName, true]);
  const timecode = window.DigitalAnarchy.Timecode.fromSeconds(inTime, { frameRate: timeValues.frameRate, dropFrame: timeValues.dropFrame });

  return window.evalFunction('$._PPP_.addClipToSequenceTimeline', [
    treePath,
    window.DigitalAnarchy.Timecode.fromSeconds(inTime, { frameRate: timeValues.frameRate, dropFrame: timeValues.dropFrame }),
    window.DigitalAnarchy.Timecode.fromSeconds(outTime, { frameRate: timeValues.frameRate, dropFrame: timeValues.dropFrame }),
  ]);
};

window.InsertClips = async() => {
  /* const response = await request('http://0.0.0.0:4433/output.json');
   console.log(clipJson);
   const clipNames = clipJson.map(clip => {
     return clip.clipName;
   });
   const insertResponse = await Promise.all(clipJson.map(clip => insertClip(clip)));*/
}

/*************
*

THE START TIMES ARE ACCORDING TO THE TIMELINE IN THE DATA

WE NEED TO CONVERT TO CLIP IN/OUT TIMES




*************/

window.Conform = async() => {
  const transcripts = await requestJSON('http://0.0.0.0:4433/output.json');
  const clipJson = await requestJSON('http://0.0.0.0:4433/clipData.json');
  const conformingClips = window.DigitalAnarchy.Conforming.fromJSON(transcripts, clipJson)
  console.log(conformingClips);
  const seqName = 'Conformed sequence';
  const binName = 'newBin';
  const seqID = uuidv4();

  const userName = await window.evalFunction('$._PPP_.getUserName', []);

  const csInterface = new CSInterface();
  const OSVersion = csInterface.getOSInformation();
  const sep = OSVersion.indexOf('Windows') >= 0 ? '\\' : '/';
  const v = csInterface.hostEnvironment.appVersion.substring(0, 4)
  var presetPath = `${csInterface.getSystemPath(SystemPath.MY_DOCUMENTS)}${sep}Adobe${sep}Premiere\ Pro${sep}${v}${sep}Profile-${userName}${sep}Settings${sep}Custom${sep}Alexia.sqpreset`;
  // await window.evalFunction('$._PPP_.cloneSequence', [])

  //const rr = await window.evalFunctionJSON('$._PPP_.findClipByName', ["Alexia", true]);
  //console.log(rr);
  /* const seqResponse = await window.evalFunction('$._PPP_.createSequence', [
    seqName,
    seqID,
    true,
    binName,
    true
  ]);*/

  const seqResponse = await window.evalFunctionJSON('$._PPP_.createSequenceFromPreset', [
    seqName,
    presetPath,
  ]);
  console.log(seqResponse);
  const insertResponse = await Promise.all(conformingClips.slice(0,2).map(clip => insertClip(clip)));
  // clipJson.forEach(createClip);

  /*console.log(clipJson);
  console.log(clipNames);*/
};