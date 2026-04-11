import { NextResponse } from 'next/server';

// In-memory store for alerts (survives within server process lifetime)
const complaints: Map<string, any> = new Map();

export async function POST(request: Request) {
  try {
    const data        = await request.formData();
    const childName   = data.get('childName') as string;
    const camIdStr    = data.get('startCameraId') as string | null;
    const imageFile   = data.get('image') as File | null;
    const timeStr     = data.get('timeStr') as string | null;

    const startCameraId = camIdStr ? parseInt(camIdStr, 10) : 1;

    // Convert image to base64
    let imageBase64: string | null = null;
    if (imageFile && imageFile.size > 0) {
      const bytes    = await imageFile.arrayBuffer();
      const buffer   = Buffer.from(bytes);
      const mimeType = imageFile.type || 'image/jpeg';
      imageBase64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
      console.log(`[COMPLAINTS] Image stored: ${imageFile.name} (${Math.round(imageFile.size / 1024)}KB)`);
    }

    const id = `ALERT-${Date.now()}`;
    const newComplaint = {
      id,
      childName,
      startCameraId,   // ← graph node, replaces lat/lng
      imageBase64,
      status:     'Active',
      timeStr:    timeStr || new Date().toISOString(),
      createdAt:  new Date().toISOString(),
    };

    complaints.set(id, newComplaint);
    console.log(`[COMPLAINTS] Created: ${id} for "${childName}" | start camera: ${startCameraId}`);

    return NextResponse.json({
      success: true,
      id,
      complaint: { ...newComplaint, imageBase64: imageBase64 ? '[STORED]' : null },
    });
  } catch (err: any) {
    console.error('[COMPLAINTS] Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id  = url.searchParams.get('id');

  if (id) {
    const complaint = complaints.get(id);
    if (!complaint) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, complaint });
  }

  const list = Array.from(complaints.values()).map((c) => ({
    ...c,
    imageBase64: c.imageBase64 ? '[IMAGE_STORED]' : null,
  }));

  return NextResponse.json({ success: true, complaints: list });
}
