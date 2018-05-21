module.exports  = {
  removeWordsMiddle: (transcript, toRemove = 0, maxWordsPercent = 30) => {
    const words = [...transcript.words];
    let wordNumToRemove = !!toRemove
      ? toRemove
      : Math.floor(words.length * (Math.random() * maxWordsPercent / 100));
    var _i = 0;
    while (wordNumToRemove > 0) {
      if (Math.random() > 0.5) {
        words.splice(_i, 1);
        wordNumToRemove--;
      }
      _i = (_i + 1) % words.length;
    }
    return { ...transcript, words };
  },
  removeRange: (transcript, range = [0, 0]) => {
    const words = [...transcript.words];
    if (range[1]) {
      words.splice(range[0], range[1]);
    }
    return { ...transcript, words };
  },
};

