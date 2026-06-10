/* ============================================================
   POST /api/upload — issues short-lived client tokens so the
   editor can upload photos/videos straight from the browser to
   Vercel Blob (no size squeeze through this function).
   Password-gated via clientPayload.

   Env: EDIT_PASSWORD, BLOB_READ_WRITE_TOKEN (added automatically
   when the Blob store is connected to the project).
   ============================================================ */
import { handleUpload } from "@vercel/blob/client";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a, b) {
  const A = Buffer.from(String(a ?? ""));
  const B = Buffer.from(String(b ?? ""));
  if (A.length !== B.length) {
    timingSafeEqual(A, A);
    return false;
  }
  return timingSafeEqual(A, B);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let pw = "";
        try {
          pw = JSON.parse(clientPayload || "{}").password || "";
        } catch (_) {}
        if (!process.env.EDIT_PASSWORD || !safeEqual(pw, process.env.EDIT_PASSWORD)) {
          throw new Error("Wrong password");
        }
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/avif",
            "video/mp4",
            "video/webm",
            "video/quicktime",
          ],
          maximumSizeInBytes: 300 * 1024 * 1024, // 300 MB — room for video teasers
          addRandomSuffix: true,
        };
      },
      // fires from Vercel's webhook after the browser finishes uploading;
      // nothing to do — content.js starts pointing at the URL on Publish
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(jsonResponse);
  } catch (e) {
    return res.status(400).json({ error: e.message || "Upload failed" });
  }
}
