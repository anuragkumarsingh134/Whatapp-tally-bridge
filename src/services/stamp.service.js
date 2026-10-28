const Jimp = require('jimp');
const CONSTANTS = require('../config/constants');

function applyRateCode(text) {
  if (!text) return '';
  return text.replace(/Rs\.(\d+)/g, (_, rateNumber) => {
    const codedRate = rateNumber.split('').map((char, index) => {
      if (index === 0) {
        return CONSTANTS.RATE_CODE_MAP[char] || char;
      }
      return char;
    }).join('');
    return `Rs.${codedRate}`;
  });
}

async function stampImage(sourcePath, destPath, text, useRateCode) {
  try {
    let displayText = text;
    if (useRateCode === 'Yes') {
      displayText = applyRateCode(displayText);
    }

    const image = await Jimp.read(sourcePath);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const font = await Jimp.loadFont(Jimp.FONT_SANS_128_BLACK);

    const textWidth = Jimp.measureText(font, displayText);
    const textHeight = Jimp.measureTextHeight(font, displayText, textWidth);

    const textCanvas = await new Promise((resolve, reject) => {
      new Jimp(textWidth + 20, textHeight, 0x00000000, (err, img) => {
        if (err) reject(err);
        else resolve(img);
      });
    });

    for (let i = 0; i < 3; i++) {
      textCanvas.print(font, i, 0, displayText);
    }

    let targetWidth = width * 0.85;
    let targetHeight = textCanvas.bitmap.height * (targetWidth / textCanvas.bitmap.width);
    const maxHeight = height * 0.06;

    if (targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = textCanvas.bitmap.width * (targetHeight / textCanvas.bitmap.height);
    }

    textCanvas.resize(Math.floor(targetWidth), Math.floor(targetHeight));
    const bannerHeight = Math.floor(textCanvas.bitmap.height * 1.4);

    const newCanvas = await new Promise((resolve, reject) => {
      new Jimp(width, height + bannerHeight, 0xFFFFFFFF, (err, img) => {
        if (err) reject(err);
        else resolve(img);
      });
    });

    newCanvas.composite(image, 0, 0);
    newCanvas.composite(
      textCanvas,
      Math.floor((width - textCanvas.bitmap.width) / 2),
      Math.floor(height + ((bannerHeight - textCanvas.bitmap.height) / 2))
    );

    await newCanvas.writeAsync(destPath);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  applyRateCode,
  stampImage
};

