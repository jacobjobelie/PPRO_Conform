const { v4 } = require('uuid');
const { WatsonPostprocess } = require('digitalanarchy.helpers');

export function newTranscriptId() {
  /* eslint-disable */
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));
  /* eslint-enable */
}

export function fixTranscripts(transcripts) {
  const ts = transcripts; // eslint prevents modifying parameters
  let next;
  let last;
  let i;
  for (i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (typeof t.speaker === 'string') {
      t.speaker = Number(t.speaker);
    }
  }
  // Don't let times go backwards.
  ts.forEach(t => {
    t.words.forEach(w0 => {
      const w = w0;
      if (last === undefined) {
        last = w.startTime;
      }
      w.startTime = Math.max(w.startTime, last);
      w.endTime = Math.max(w.startTime, w.endTime);
      last = w.startTime;
    });
  });
  i = ts.length;
  while (i > 0) {
    --i;
    const t = ts[i];
    let w = t.words.length;
    while (w > 0) {
      --w;
      const word = t.words[w];
      if (next === undefined) {
        next = word.endTime;
      }
      word.nextStartTime = next;
      word.wordId = word.wordId || v4();
      // endTime might be epsilon larger than nextStartTime, due to adding start + duration in some JSON formats
      word.endTime = Math.min(word.endTime, word.nextStartTime);
      // Don't let times go backwards.
      word.startTime = Math.min(word.startTime, word.endTime);
      next = word.startTime;
      // In early versions, JSON might have encoded this as null
      if (word.transcriptIndex === undefined || word.transcriptIndex === null) {
        word.transcriptIndex = i;
      }
    }
    if (t.words.length > 0) {
      t.startTime = t.words[0].startTime;
      t.endTime = t.words[t.words.length - 1].endTime;
    }
  }
  // Add transcript ids
  for (let tIndex = 0; tIndex < transcripts.length; tIndex++) {
    const t = transcripts[tIndex];
    t.nextStartTime = transcripts[tIndex + 1] ? transcripts[tIndex + 1].startTime : transcripts[tIndex].endTime;
    if (!t.id) {
      t.id = newTranscriptId();
    }
    for (let wIndex = 0; wIndex < t.words.length; wIndex++) {
      const word = t.words[wIndex];
      if (!word.transcriptId) {
        word.transcriptId = t.id;
      }
    }
  }
}

const WORD_LIMIT = 300; // the max amount of word allowed in a transcript
const WORD_BREAK = 250; // the amount of words the new transcripts should be broken into - this should be less than WORD_LIMIT

export function reduceTranscripts(transcripts) {
  const maxWordLength = transcripts.reduce((max, t) => {
    return t.words.length > max ? t.words.length : max;
  }, 0);
  if (maxWordLength > WORD_LIMIT) {
    let splitTranscripts = [];
    transcripts.forEach(t => {
      if (t.words.length > WORD_LIMIT) {
        // over the limit, break this up
        splitTranscripts = splitTranscripts.concat(reduceTranscript(t));
      } else {
        splitTranscripts.push(t);
      }
    });
    return splitTranscripts;
  }
  return transcripts;
}

export const importSpeechToText = (results, options = {}) => {
  const startTime = options.startTime || 0;
  if (options.ignoreSpeakers && (results.speakers || results.speaker_labels)) {
    return importSpeechToText({ ...results, speakers: null, speaker_labels: null, speaker_names: null },
                              { ...options, ignoreSpeakers: false });
  }
  const maxSpeakers = options.maxSpeakers || 10;
  const questions = (options.questions === undefined) ? true : options.questions;
  if (results && results.results && results.results[0].alternatives) {
    const lang = results.lang || options.lang;
    const processLang = (options.verbatim || results.verbatim) ? 'verbatim' : lang;
    let fixed = results;
    if (options.fixSpeakers) {
      fixed = { ...results };
      if (results.speaker_names !== undefined) {
        const fixedSpeakers = {};
        Object.keys(results.speaker_names).forEach(i => {
          fixedSpeakers[Number(i)] = results.speaker_names[i];
        });
        fixed.speaker_names = fixedSpeakers;
      }
      if (results.speaker_labels !== undefined) {
        fixed.speaker_labels = results.speaker_labels.map(s => {
          return { ...s, speaker: Number(s.speaker) };
        });
      }
    }
    const speakers = fixed.speaker_names;
    return WatsonPostprocess.watsonPostprocess(fixed, processLang || 'en-US', startTime, maxSpeakers, questions)
      .then(data => {
        const result = { transcripts: data, lang, speakers };
        result.transcripts = reduceTranscripts(result.transcripts);
        fixTranscripts(result.transcripts);
        return result;
      });
  }
  throw new Error('JSON is not from any speech service');
};