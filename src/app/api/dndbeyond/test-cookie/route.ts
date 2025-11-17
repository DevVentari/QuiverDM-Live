import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cookie } = body;

    // Validate cookie format
    if (!cookie || typeof cookie !== 'string') {
      return NextResponse.json({ error: 'Cookie is required' }, { status: 400 });
    }

    if (cookie.trim().length === 0) {
      return NextResponse.json({ error: 'Cookie cannot be empty' }, { status: 400 });
    }

    // Test the cookie by making a request to D&D Beyond API
    // Note: This is a mock implementation. In production, you would:
    // 1. Make actual API calls to D&D Beyond
    // 2. Handle CORS and authentication properly
    // 3. Consider rate limiting

    try {
      const response = await fetch('https://www.dndbeyond.com/api/config/json', {
        headers: {
          Cookie: `CobaltSession=${cookie}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        console.error('D&D Beyond config API returned:', response.status);
        return NextResponse.json(
          { error: 'Unable to verify cookie with D&D Beyond. Please check the cookie value.' },
          { status: 401 }
        );
      }

      // Try to get character data to verify authentication
      const characterResponse = await fetch(
        'https://character-service.dndbeyond.com/character/v5/characters',
        {
          headers: {
            Cookie: `CobaltSession=${cookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        }
      );

      if (!characterResponse.ok) {
        console.error('D&D Beyond character API returned:', characterResponse.status);
        return NextResponse.json(
          { error: 'Cookie appears invalid or expired. Please get a fresh cookie from D&D Beyond.' },
          { status: 401 }
        );
      }

      // Cookie is valid!
      return NextResponse.json({
        success: true,
        message: 'Cookie verified successfully! You can now import characters.',
      });
    } catch (fetchError: any) {
      console.error('Fetch error:', fetchError);

      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timed out. D&D Beyond may be unavailable.' },
          { status: 504 }
        );
      }

      return NextResponse.json(
        { error: 'Unable to connect to D&D Beyond. Please try again later.' },
        { status: 503 }
      );
    }
  } catch (error: any) {
    console.error('Error testing D&D Beyond cookie:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to test cookie. Please try again.' },
      { status: 500 }
    );
  }
}
