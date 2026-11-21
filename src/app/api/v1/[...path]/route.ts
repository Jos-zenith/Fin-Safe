import { handle } from "@/server/api";

export const runtime = "nodejs";
// Plan drafting can call a live model, which may take a while. See AI_TIMEOUT_MS.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const run = (req: Request) => handle(req);
export const GET = run;
export const POST = run;
export const PUT = run;
export const DELETE = run;
