const { Jimp, intToRGBA, rgbaToInt } = require('jimp');

async function main() {
  console.log('Reading emcee-energetic-white.png...');
  const image = await Jimp.read('public/emcee-energetic-white.png');
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  
  // Array to track background pixels: 0 = unvisited, 1 = background, 2 = visited non-background
  const bgMask = new Array(width * height).fill(0);
  
  // Queue for flood fill
  const queue = [];
  
  // Helper to get index
  const getIndex = (x, y) => y * width + x;
  
  // Initialize queue with border pixels
  for (let x = 0; x < width; x++) {
    queue.push([x, 0]);
    queue.push([x, height - 1]);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push([0, y]);
    queue.push([width - 1, y]);
  }
  
  // Thresholds
  // Pure background is very white (all channels above 240)
  const isWhiteBG = (r, g, b) => {
    return r > 240 && g > 240 && b > 240;
  };
  
  console.log('Running flood-fill from edges to locate background...');
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const idx = getIndex(x, y);
    if (bgMask[idx] !== 0) continue;
    
    // Get color
    const pixelColor = image.getPixelColor(x, y);
    const rgba = intToRGBA(pixelColor);
    
    if (isWhiteBG(rgba.r, rgba.g, rgba.b)) {
      bgMask[idx] = 1; // Mark as background
      
      // Add neighbors
      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1]
      ];
      
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = getIndex(nx, ny);
          if (bgMask[nidx] === 0) {
            queue.push([nx, ny]);
          }
        }
      }
    } else {
      bgMask[idx] = 2; // Visited but not background
    }
  }
  
  console.log('Applying transparency and feathering the edges...');
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = getIndex(x, y);
      const pixelColor = image.getPixelColor(x, y);
      const rgba = intToRGBA(pixelColor);
      
      if (bgMask[idx] === 1) {
        // Pure background - make fully transparent
        rgba.a = 0;
        image.setPixelColor(rgbaToInt(rgba.r, rgba.g, rgba.b, 0), x, y);
      } else {
        // Check if adjacent to background to feather the edges
        let isAdjacentToBg = false;
        const neighbors = [
          [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
          [x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1]
        ];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (bgMask[getIndex(nx, ny)] === 1) {
              isAdjacentToBg = true;
              break;
            }
          }
        }
        
        if (isAdjacentToBg) {
          // Edge/Border pixel!
          const maxVal = Math.max(rgba.r, rgba.g, rgba.b);
          if (maxVal > 220) {
            // Smoothly feather alpha based on whiteness:
            // 255 becomes fully transparent (0), 220 becomes fully opaque (255)
            const alphaFactor = (255 - maxVal) / (255 - 220);
            rgba.a = Math.max(0, Math.min(255, Math.floor(alphaFactor * 255)));
            
            // Subtract white bleed from the edges to darken them and match the black polo / skin tone
            rgba.r = Math.max(0, Math.floor(rgba.r - (255 - rgba.r) * 0.4));
            rgba.g = Math.max(0, Math.floor(rgba.g - (255 - rgba.g) * 0.4));
            rgba.b = Math.max(0, Math.floor(rgba.b - (255 - rgba.b) * 0.4));
            
            image.setPixelColor(rgbaToInt(rgba.r, rgba.g, rgba.b, rgba.a), x, y);
          }
        }
      }
    }
  }
  
  console.log('Writing transparent PNG to public/emcee-energetic-transparent.png...');
  await image.write('public/emcee-energetic-transparent.png');
  console.log('Successfully completed refined background removal!');
}

main().catch(console.error);
