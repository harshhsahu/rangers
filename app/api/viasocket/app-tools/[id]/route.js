import { NextResponse } from "next/server";
import { AuthError, errorResponse, requireAgentAccess } from "@/lib/apiAuth";
import { getViaSocketAppToolsCollection } from "@/lib/mongo";

export const runtime = "nodejs";

/** DELETE /api/viasocket/app-tools/:id — remove one app tool from its agent. The viaSocket connection stays. */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const tools = await getViaSocketAppToolsCollection();
    const row = await tools.findOne({ _id: String(id) });
    if (!row) return NextResponse.json({ success: false, error: "Tool not found" }, { status: 404 });

    await requireAgentAccess(request, { agentId: row.agent_id });
    await tools.deleteOne({ _id: row._id });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    console.error("[viasocket] delete app tool failed", error?.message || error);
    return NextResponse.json({ success: false, error: "Could not remove the app tool" }, { status: 500 });
  }
}
