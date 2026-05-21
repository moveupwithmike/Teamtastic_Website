const { Jimp, intToRGBA, rgbaToInt } = require('jimp');

async function main() {
  console.log('Reading public/logo-highfive.png...');
  const image = await Jimp.read('public/logo-highfive.png');
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  
  // Convert white background to transparent
  console.log('Converting white pixels to transparent...');
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelColor = image.getPixelColor(x, y);
      const rgba = intToRGBA(pixelColor);
      
      // If the pixel is very white, make it transparent
      if (rgba.r > 240 && rgba.g > 240 && rgba.b > 240) {
        rgba.a = 0;
        image.setPixelColor(rgbaToInt(rgba.r, rgba.g, rgba.b, 0), x, y);
      }
    }
  }
  
  console.log('Writing transparent logo to public/logo-highfive-transparent.png...');
  await image.write('public/logo-highfive-transparent.png');
  console.log('Logo background removal completed successfully!');
}

main().catch(console.error);
