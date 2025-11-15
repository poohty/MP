import { z } from "zod";
import { publicProcedure } from "../../create-context";

export default publicProcedure
  .input(
    z.object({
      imageUrl: z.string().url(),
      pageUrl: z.string().url().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const { imageUrl, pageUrl } = input;

    console.log(`[Proxy] Fetching image: ${imageUrl}`);
    console.log(`[Proxy] Page URL: ${pageUrl || "not provided"}`);

    try {
      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      };

      if (pageUrl) {
        try {
          const pageOrigin = new URL(pageUrl).origin;
          headers["Referer"] = pageOrigin;
          console.log(`[Proxy] Set Referer to: ${pageOrigin}`);
        } catch {
          console.log(`[Proxy] Failed to parse page URL, skipping Referer`);
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(imageUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log(`[Proxy] Failed to fetch image: HTTP ${response.status}`);
        return {
          success: false,
          error: `HTTP ${response.status}`,
        };
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.startsWith("image/")) {
        console.log(
          `[Proxy] Invalid content-type: ${contentType || "none"}`
        );
        return {
          success: false,
          error: "Invalid content type",
        };
      }

      const contentLength = response.headers.get("content-length");
      const contentSize = contentLength ? parseInt(contentLength, 10) : 0;
      const MAX_FILE_SIZE = 10 * 1024 * 1024;

      if (contentSize > 0 && contentSize > MAX_FILE_SIZE) {
        console.log(
          `[Proxy] Image too large: ${(contentSize / 1024 / 1024).toFixed(2)}MB`
        );
        return {
          success: false,
          error: "Image too large",
        };
      }

      if (contentSize > 0 && contentSize < 1024) {
        console.log(`[Proxy] Content too small: ${contentSize} bytes`);
        return {
          success: false,
          error: "Content too small",
        };
      }

      const arrayBuffer = await response.arrayBuffer();

      if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
        console.log(
          `[Proxy] Downloaded content too large: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`
        );
        return {
          success: false,
          error: "Downloaded content too large",
        };
      }

      if (arrayBuffer.byteLength < 1024) {
        console.log(
          `[Proxy] Downloaded content too small: ${arrayBuffer.byteLength} bytes`
        );
        return {
          success: false,
          error: "Downloaded content too small",
        };
      }

      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const base64Data = `data:${contentType};base64,${base64}`;

      console.log(
        `[Proxy] Successfully converted image to base64 (${base64Data.length} chars)`
      );

      return {
        success: true,
        base64Data,
        contentType,
      };
    } catch (error: any) {
      console.log(`[Proxy] Error fetching image:`, error.message || error);
      return {
        success: false,
        error: error.message || "Unknown error",
      };
    }
  });
