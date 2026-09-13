import { NextResponse } from "next/server";
import {
  consentSignalForSampleType,
  getSamplesForUser,
  insertHealthSamples,
} from "@/db/queries/health-samples";
import { getSession } from "@/db/auth-dal";
import { getSignalConsentState } from "@/db/queries/product-state";
import {
  HealthSampleRequestSchema,
  normalizeHealthSampleRequest,
} from "@/lib/contracts";

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

  const parsed = HealthSampleRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid health sample payload",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const samples = normalizeHealthSampleRequest(parsed.data);
  const allowed = [];
  const skipped = [];
  for (const sample of samples) {
    const signal = consentSignalForSampleType(sample.sampleType);
    const consentState = signal ? await getSignalConsentState(session.user.id, signal) : "disabled";
    if (consentState === "disabled") {
      skipped.push({ externalId: sample.externalId ?? null, sampleType: sample.sampleType, reason: "not_consented" });
      continue;
    }
    allowed.push(sample);
  }

  const rows = allowed.map((sample) => ({
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
  return NextResponse.json({
    samples: inserted,
    acceptedCount: inserted.length,
    skippedCount: skipped.length,
    skipped,
  }, { status: 201 });
}
