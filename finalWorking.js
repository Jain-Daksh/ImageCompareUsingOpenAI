const prompt = `
Compare the two images carefully to find visual differences .

IMPORTANT: Use a coordinate system from 0 to 1000 for both x and y.
- (0,0) is the top-left corner.
- (1000,1000) is the bottom-right corner.

Detect ALL meaningful visual differences. 
For each difference, provide the bounding box using these normalized coordinates.

Return ONLY a JSON array in this exact format:
[{"x": 0, "y": 0, "w": 100, "h": 100, "label": "description"}]

No extra text.
Do NOT include markdown blocks like \`\`\`json 
`;

import fs from 'fs/promises';
import { createCanvas, loadImage } from 'canvas';
import pixelmatch from 'pixelmatch';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();
const openai = new OpenAI({
  apiKey: '',
});

/* -------------------- UTIL -------------------- */

function bufferToDataURL(buffer, mime = 'image/png') {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

/* -------------------- AI SEMANTIC DIFF -------------------- */

async function getAIDifferences(path1, path2) {
  const buf1 = await fs.readFile(path1);
  const buf2 = await fs.readFile(path2);

  const img1 = bufferToDataURL(buf1);
  const img2 = bufferToDataURL(buf2);

  const response = await openai.responses.create({
    model: 'gpt-5.2',
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          { type: 'input_image', image_url: img1 },
          { type: 'input_image', image_url: img2 },
        ],
      },
    ],
  });

  const text = response.output_text;
  console.log('AI RAW OUTPUT:\n', text);

  try {
    // Fix: Remove markdown formatting if the AI includes it
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error('AI did not return valid JSON. Raw output was:', text);
    return [];
  }
}

/* -------------------- IMAGE DIFF -------------------- */

async function compareImagesAI(imgPath1, imgPath2, outputPath) {
  const baseImg = await loadImage(imgPath1);

  const width = baseImg.width;
  const height = baseImg.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1️⃣ Draw base image (Image 1 exactly as-is)
  ctx.drawImage(baseImg, 0, 0);

  // 2️⃣ Get AI semantic differences
  const aiDiffs = await getAIDifferences(imgPath1, imgPath2);

  // 3️⃣ Styling
  ctx.lineWidth = 3;
  ctx.font = '18px Arial';
  ctx.textBaseline = 'top';
  // for (const diff of aiDiffs) {
  //   // Convert normalized (0-1000) coordinates to actual pixel values
  //   // const scaleX = width / 1000000;
  //   // const scaleY = height / 1000000;

  //   const realX = diff.x;
  //   const realY = diff.y;
  //   const realW = diff.w;
  //   const realH = diff.h;

  //   // Draw the highlight using the 'real' pixel values
  //   ctx.fillStyle = 'rgba(255, 0, 0, 0.25)';
  //   ctx.fillRect(realX, realY, realW, realH);

  //   ctx.strokeStyle = 'red';
  //   ctx.strokeRect(realX, realY, realW, realH);

  //   // Label positioning
  //   const padding = 6;
  //   const textWidth = ctx.measureText(diff.label).width;
  //   const labelHeight = 22;

  //   ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  //   ctx.fillRect(
  //     realX,
  //     realY - labelHeight,
  //     textWidth + padding * 2,
  //     labelHeight
  //   );

  //   ctx.fillStyle = 'white';
  //   ctx.fillText(diff.label, realX + padding, realY - labelHeight + 3);
  // }

  for (const diff of aiDiffs) {
    // These convert the 0-1000 AI units into Pixel percentages
    const scaleX = width / 1000;
    const scaleY = height / 1000;

    // We use Math.floor to ensure we are drawing on clean pixel boundaries
    const realX = Math.floor(diff.x * scaleX);
    const realY = Math.floor(diff.y * scaleY);
    const realW = Math.floor(diff.w * scaleX);
    const realH = Math.floor(diff.h * scaleY);

    // DRAWING THE BOX
    ctx.lineWidth = 4; // Make it thicker to be sure you see it
    ctx.strokeStyle = 'red';
    ctx.strokeRect(realX, realY, realW, realH);

    // Transparent fill
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.fillRect(realX, realY, realW, realH);

    // DRAWING THE LABEL
    const padding = 8;
    const labelHeight = 25;
    ctx.font = 'bold 20px Arial';
    const textWidth = ctx.measureText(diff.label).width;

    // Fix: If the box is too high, put label inside
    let labelY = realY - labelHeight;
    if (labelY < 0) labelY = realY + 5;

    ctx.fillStyle = 'black';
    ctx.fillRect(realX, labelY, textWidth + padding * 2, labelHeight);

    ctx.fillStyle = 'white';
    ctx.fillText(diff.label, realX + padding, labelY + 4);
  }

  // 4️⃣ If no differences
  if (aiDiffs.length === 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, width, 40);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('No visual differences detected', 10, 8);
  }

  // 5️⃣ Save output
  const buffer = canvas.toBuffer('image/png');
  await fs.writeFile(outputPath, buffer);

  console.log(`✅ Marked image saved: ${outputPath}`);
}

/* -------------------- RUN -------------------- */

// compareImagesAI('1.png', '2.png', '20.png');
// compareImagesAI('bed1.png', 'bed2.png', 'bed20.png');
compareImagesAI('whatsapp1.jpeg', 'whatsapp2.jpeg', 'whatsapp5.jpeg');
