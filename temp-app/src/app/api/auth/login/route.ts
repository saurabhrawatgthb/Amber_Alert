import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { username, password } = await request.json();
  if (username === 'police' && password === 'admin123') {
    return NextResponse.json({ token: 'mock-jwt-token-1234', success: true });
  }
  return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
}
