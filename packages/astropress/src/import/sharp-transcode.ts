import sharp from "sharp";

export async function transcodeViaSharp(input: Buffer): Promise<Buffer> {
	return sharp(input).toBuffer();
}
