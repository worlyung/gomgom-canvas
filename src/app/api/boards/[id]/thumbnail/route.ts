import { NextResponse } from "next/server";
import { safeId, readImages } from "@/lib/board-store";
import sharp from "sharp";
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const id = safeId((await ctx.params).id);
  if (!id) return new NextResponse(null, { status: 400 });
  try {
    const src = Object.values(readImages(id))[0];
    if (!src) return new NextResponse(null, { status: 404 });
    const image = await sharp(Buffer.from(src.split(",")[1], "base64"))
      .resize(160, 160, { fit: "inside" })
      .webp()
      .toBuffer();
    return new NextResponse(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
