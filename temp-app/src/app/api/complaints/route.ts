import { NextResponse } from 'next/server';

// Temporary in-memory DB for the hackathon
const complaints: any[] = [];

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const childName = data.get('childName');
    const locationStr = data.get('location');
    const image = data.get('image'); // File
    
    // In real app we store the file to S3, for now we just create a record
    const id = Date.now().toString();
    const newComplaint = {
      id,
      childName,
      location: locationStr ? JSON.parse(locationStr as str) : { lat: 40.7128, lng: -74.0060 },
      status: 'Active',
      createdAt: new Date().toISOString()
    };
    
    complaints.push(newComplaint);
    
    return NextResponse.json({ success: true, id, complaint: newComplaint });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: true, complaints });
}
