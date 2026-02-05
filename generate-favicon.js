import sharp from "sharp";
import { readFileSync } from "fs";

// Read the SVG favicon
const svgBuffer = readFileSync("favicon.svg");

// Generate PNG favicon at different sizes
async function generateFavicons() {
  // 32x32 favicon.png (standard size)
  await sharp(svgBuffer).resize(32, 32).png().toFile("favicon.png");

  console.log("✓ Generated favicon.png (32x32)");

  // Optional: Generate other common sizes
  await sharp(svgBuffer).resize(16, 16).png().toFile("favicon-16x16.png");
  await sharp(svgBuffer).resize(32, 32).png().toFile("favicon-32x32.png");
  await sharp(svgBuffer).resize(180, 180).png().toFile("apple-touch-icon.png");

  console.log("✓ Generated favicon-16x16.png");
  console.log("✓ Generated favicon-32x32.png");
  console.log("✓ Generated apple-touch-icon.png (180x180)");
}

generateFavicons().catch(console.error);
