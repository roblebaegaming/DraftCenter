import { NextResponse } from "next/server";
import { requireOwner } from "../../../../lib/ownerOperations";
export async function GET(request) { const access = await requireOwner(request); return NextResponse.json({ owner: !access.error }, { status: access.error ? access.status : 200 }); }
