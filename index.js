const { v4 } = require('uuid');
const Parse = require('path-parse');

const requestJSON = async function(url) {
  const response = await fetch(url);
  const json = await response.json();
  return json;
};

const insertClip = async clip => {
  const clipData = await window.evalFunctionJSON('$._PPP_.findClipByName', [
    `${clip.clipName}.mp4`,
    true,
  ]);
  const { treePath } = clipData;
  console.log(clipData);
  console.log(treePath);
  const inTime = clip.startTime.toFixed(3).toString();
  const outTime = (clip.startTime + clip.duration).toFixed(3).toString();

  //const timeValues = await window.evalFunctionJSON('$._PPP_.extractFrameRate', [clip.clipName, true]);
  /*console.log(treePath);
  console.log(inTime, outTime);
  console.log(timeValues);*/
  // const timecode = window.DigitalAnarchy.Timecode.fromSeconds(inTime, { frameRate: timeValues.frameRate, dropFrame: timeValues.dropFrame });

  return window.evalFunction('$._PPP_.addClipToSequenceTimeline', [
    treePath,
    window.DigitalAnarchy.Timecode.fromSeconds(inTime, {
      frameRate: 59.7,
      dropFrame: false,
    }),
    window.DigitalAnarchy.Timecode.fromSeconds(outTime, {
      frameRate: 59.7,
      dropFrame: false,
    }),
    /*window.DigitalAnarchy.Timecode.fromSeconds(inTime, { frameRate: timeValues.frameRate, dropFrame: timeValues.dropFrame }),
window.DigitalAnarchy.Timecode.fromSeconds(outTime, { frameRate: timeValues.frameRate, dropFrame: timeValues.dropFrame }),*/
  ]);
};

window.InsertClips = async () => {
  /* const response = await request('http://0.0.0.0:4433/output.json');
   console.log(clipJson);
   const clipNames = clipJson.map(clip => {
     return clip.clipName;
   });
   const insertResponse = await Promise.all(clipJson.map(clip => insertClip(clip)));*/
};

/*************
*

THE START TIMES ARE ACCORDING TO THE TIMELINE IN THE DATA

WE NEED TO CONVERT TO CLIP IN/OUT TIMES




*************/

window.Conform = async () => {
  const transcripts = await requestJSON('http://0.0.0.0:4433/output.json');
  const clipJson = await requestJSON('http://0.0.0.0:4433/clipData.json');
  const conformingClips = window.DigitalAnarchy.Conforming.fromJSON(
    transcripts,
    clipJson,
  );
  const presetName = 'PProPanel';
  const seqName = 'Conformed sequence';
  const binName = 'newBin';
  const seqID = uuidv4();

  const userName = await window.evalFunction('$._PPP_.getUserName', []);

  const csInterface = new CSInterface();
  const OSVersion = csInterface.getOSInformation();
  const sep = OSVersion.indexOf('Windows') >= 0 ? '\\' : '/';
  const v = csInterface.hostEnvironment.appVersion.substring(0, 2) + '.0';
  var presetPath = `${csInterface.getSystemPath(
    SystemPath.MY_DOCUMENTS,
  )}${sep}Adobe${sep}Premiere\ Pro${sep}${v}${sep}Profile-${userName}${sep}Settings${sep}Custom${sep}${presetName}.sqpreset`;
  console.log(presetPath);
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

  const insertResponse = await conformingClips.reduce(
    (promise, clip) =>
      promise.then(result => insertClip(clip).then(Array.prototype.concat.bind(result))),
    Promise.resolve([]),
  );
  // clipJson.forEach(createClip);

  /*console.log(clipJson);
  console.log(clipNames);*/
};

window.XMP = async () => {
  const tree = await window.evalFunctionJSON('$._PPP_.getTree', []);

  const seqResponse = await Promise.all(
    tree.rootItems
      //.filter(obj => obj.name.indexOf('mov') > -1)
      .map(obj =>
        window.evalFunctionJSON('$._ext_POWERSERACH_XMP.getFileMetadata', [
          JSON.stringify(obj),
          false,
        ]),
      ),
  );

  const extractFields = schemas => {
    const fields = {};
    schemas.forEach(schema => {
      schema.filter(prop => prop.path.indexOf('/?xml') < 0).forEach(prop => {
        const { value } = prop;
        const category = prop.path.split(':')[0];
        const name = prop.path.split(':')[1];
        let arrayIndexStr = name.split('[')[1];
        arrayIndexStr = !!arrayIndexStr
          ? parseInt(arrayIndexStr.substring(0, 1), 10)
          : null;
        const isArrayItem = !_.isNil(arrayIndexStr);
        const nameExtracted = isArrayItem ? name.split('[')[0] : name;
        const obj = {
          category,
          key: isArrayItem ? nameExtracted : name,
          value,
        };
        if (isArrayItem) {
          if (_.isArray(fields[nameExtracted])) {
            console.log(obj);
            fields[nameExtracted].push(obj);
          } else {
            console.log(nameExtracted);
            console.log(obj);
          }
        } else {
          const arr = prop.isArray && obj.value.length ? [obj] : [];
          fields[name] = prop.isArray ? arr : obj;
        }
      });
    });
    return fields;
  };

  const returnObject = seqResponse.map(result => ({
    ...result.projectItem,
    markers: result.markers,
    fields: extractFields(result.schemas),
  }));

  console.log(seqResponse);
  console.log(returnObject);
  // const seqResponse = await window.evalFunctionJSON('$._ext_POWERSERACH_XMP.getFileMetadata', [
};
