import { exec } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Compress a PDF file using Ghostscript and generate a compressed thumbnail using pdftoppm + sharp
 *
 * @param {string} inputPath - Path to the original PDF
 * @param {string} outputPath - Path to save the compressed PDF
 * @param {string} quality - Ghostscript quality: screen | ebook | printer | prepress | default
 * @returns {Promise<{ thumbnailPath: string }>}
 */
export async function compressPDF(inputPath: string, outputPath: string, quality = 'printer') {
  // Step 1: Compress PDF using Ghostscript
  const compressCmd = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/${quality} -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;

  await new Promise<void>((resolve, reject) => {
    exec(compressCmd, (error) => {
      if (error) {
        console.error('Compression failed:', error.message);
        return reject(error);
      }
      resolve();
    });
  });

  // Step 2: Generate thumbnail using pdftoppm
  const baseName = path.basename(outputPath).replace(/\.\w+$/, '');
  const outputDir = path.join(path.dirname(outputPath), 'thumb');
  const thumbOutputBase = path.join(outputDir, baseName);
  const rawThumbPath = `${thumbOutputBase}.jpg`; // Initial uncompressed thumb
  const finalThumbPath = `${thumbOutputBase}_compressed.jpg`; // Final compressed version

  try {
    await fs.access(outputDir);
  } catch {
    await fs.mkdir(outputDir, { recursive: true });
  }

  const thumbCmd = `pdftoppm -jpeg -f 1 -singlefile "${outputPath}" "${thumbOutputBase}"`;

  await new Promise<void>((resolve, reject) => {
    exec(thumbCmd, (error) => {
      if (error) {
        console.error('Thumbnail generation failed:', error.message);
        return reject(error);
      }
      resolve();
    });
  });

  // Step 3: Compress the JPEG thumbnail using sharp
  // await sharp(rawThumbPath)
  //   .jpeg({ quality: 60 }) // adjust quality as needed
  //   .toFile(finalThumbPath);

	await sharp(rawThumbPath)
      .resize(parseInt(process.env.THUMB_SIZE as string), parseInt(process.env.THUMB_SIZE as string), {
        fit: 'inside',         // Keeps aspect ratio within the bounds
        withoutEnlargement: true, // Prevents upscaling
      })
      .webp({
        quality: parseInt(process.env.THUMB_QUALITY as string),
      })
      .toFile(finalThumbPath);

  // Delete raw (uncompressed) thumbnail
  await fs.unlink(rawThumbPath).catch(() => {});
  await fs.unlink(inputPath).catch(() => {});

  return { compressedPdfPath: outputPath, thumbnailPath: finalThumbPath };
}
