import { NextResponse } from "next/server";
import { getSamplesForUser, insertHealthSamples } from "@/db/queries/health-samples";
import { getSession } from "@/db/auth-dal";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sampleType = searchParams.get("sampleType");
  if (!sampleType) {
    return NextResponse.json({ error: "sampleType is required" }, { status: 400 });
  }

  const samples = await getSamplesForUser(session.user.id, sampleType);
  return NextResponse.json({ samples });
}

type IncomingSample = {
  sampleType: string;
  value: number;
  unit?: string | null;
  startDate: string;
  endDate: string;
  sourceName?: string | null;
  externalId?: string | null;
  metadata?: unknown;
};

function parseSample(input: unknown): IncomingSample | null {
  if (typeof input !== "object" || input === null) return null;
  const row = input as Record<string, unknown>;

  if (typeof row.sampleType !== "string" || row.sampleType.length === 0) return null;
  if (typeof row.value !== "number" || Number.isNaN(row.value)) return null;
  if (typeof row.startDate !== "string" || Number.isNaN(Date.parse(row.startDate))) return null;
  if (typeof row.endDate !== "string" || Number.isNaN(Date.parse(row.endDate))) return null;
  if (row.unit !== undefined && row.unit !== null && typeof row.unit !== "string") return null;
  if (row.sourceName !== undefined && row.sourceName !== null && typeof row.sourceName !== "string") {
    return null;
  }
  if (row.externalId !== undefined && row.externalId !== null && typeof row.externalId !== "string") {
    return null;
  }

  return {
    sampleType: row.sampleType,
    value: row.value,
    unit: (row.unit as string | null | undefined) ?? null,
    startDate: row.startDate,
    endDate: row.endDate,
    sourceName: (row.sourceName as string | null | undefined) ?? null,
    externalId: (row.externalId as string | null | undefined) ?? null,
    metadata: row.metadata ?? null,
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawSamples = Array.isArray(body)
    ? body
    : body !== null && typeof body === "object" && Array.isArray((body as Record<string, unknown>).samples)
      ? (body as Record<string, unknown>).samples
      : [body];

  const parsed = (rawSamples as unknown[]).map(parseSample);
  if (parsed.length === 0 || parsed.some((sample) => sample === null)) {
    return NextResponse.json(
      {
        error:
          "Each sample requires sampleType (string), value (number), startDate and endDate (ISO strings)",
      },
      { status: 400 },
    );
  }

  const rows = (parsed as IncomingSample[]).map((sample) => ({
    userId: session.user.id,
    sampleType: sample.sampleType,
    value: sample.value,
    unit: sample.unit ?? null,
    startDate: new Date(sample.startDate),
    endDate: new Date(sample.endDate),
    sourceName: sample.sourceName ?? null,
    externalId: sample.externalId ?? null,
    metadata: sample.metadata ?? null,
  }));

  const inserted = await insertHealthSamples(rows);
  return NextResponse.json({ samples: inserted }, { status: 201 });
}
