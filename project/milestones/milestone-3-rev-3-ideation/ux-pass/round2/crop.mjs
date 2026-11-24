import sharp from "sharp";
const [, , src, dst, l, t, w, h, k] = process.argv;
await sharp(src).extract({ left: +l, top: +t, width: +w, height: +h }).resize({ width: +w * (+k || 2) }).png().toFile(dst);
