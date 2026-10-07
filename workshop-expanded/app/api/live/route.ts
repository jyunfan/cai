import { getRawDb } from "../../../db";
import { liveAction, liveSnapshot, LiveError } from "../../../lib/live-service";
const headers = {"Cache-Control": "no-store"};
async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const secret = request.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
    let result;
    if (request.method === "GET") result = await liveSnapshot(getRawDb(), url.searchParams.get("code") || "", secret);
    else {
      if (request.headers.get("Origin") && request.headers.get("Origin") !== url.origin) throw new LiveError("請從同一網站送出操作。", 403);
      if (!request.headers.get("Content-Type")?.includes("application/json")) throw new LiveError("請使用 JSON 格式。", 415);
      const raw = await request.text();
      if (raw.length > 500000) throw new LiveError("題庫過大，請縮減至 100 題以內。", 413);
      let body; try { body = JSON.parse(raw); } catch { throw new LiveError("題庫 JSON 格式有誤。"); }
      result = await liveAction(getRawDb(), body, secret);
    }
    return Response.json(result, {headers});
  } catch (error) {
    if (error instanceof LiveError) return Response.json({error: error.message}, {status: error.status, headers});
    console.error("Live quiz request failed", error);
    return Response.json({error: "搶答服務暫時無法連線，請保留此頁並稍後重試。"}, {status: 503, headers});
  }
}
export const GET = handle;
export const POST = handle;
