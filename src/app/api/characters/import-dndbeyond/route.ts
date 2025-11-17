import { NextRequest, NextResponse } from 'next/server';
import { importFromDndBeyond, isValidDndBeyondUrl } from '@/lib/dndbeyond-importer';
import { fetchCharacterFromDDB, parseCharacterData } from '@/lib/dndbeyond-api';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { url, campaignId, playerName, cobaltToken } = await request.json();

    if (!url || !campaignId) {
      return NextResponse.json(
        { error: 'Missing required fields: url and campaignId' },
        { status: 400 }
      );
    }

    // Validate URL
    if (!isValidDndBeyondUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid D&D Beyond character URL. Must be a public character URL.' },
        { status: 400 }
      );
    }

    // Extract character ID from URL
    const characterIdMatch = url.match(/\/characters\/(\d+)/);
    if (!characterIdMatch) {
      return NextResponse.json(
        { error: 'Could not extract character ID from URL' },
        { status: 400 }
      );
    }
    const characterId = characterIdMatch[1];

    let characterData;

    // Try Cobalt token method first if token provided
    if (cobaltToken) {
      console.log(`Importing character ${characterId} using Cobalt token...`);
      const apiResponse = await fetchCharacterFromDDB(characterId, cobaltToken);

      if (!apiResponse.success) {
        return NextResponse.json(
          { error: apiResponse.message || 'Failed to fetch character from D&D Beyond API' },
          { status: 400 }
        );
      }

      characterData = parseCharacterData(apiResponse.data);
    } else {
      // Fallback to web scraping
      console.log(`Importing character from ${url} using web scraping...`);
      characterData = await importFromDndBeyond(url);
    }

    // Check if this character already exists for this campaign
    const existingPlayer = await prisma.player.findFirst({
      where: {
        campaignId,
        dndBeyondUrl: url,
      },
    });

    if (existingPlayer) {
      // Update existing character
      const updatedPlayer = await prisma.player.update({
        where: { id: existingPlayer.id },
        data: {
          characterName: characterData.characterName,
          name: playerName || characterData.playerName || existingPlayer.name,
          characterRace: characterData.race,
          characterClass: characterData.class,
          level: characterData.level,
          imageUrl: characterData.imageUrl || existingPlayer.imageUrl,
          backstory: characterData.backstory || existingPlayer.backstory,
          characterData: characterData as any,
          lastSyncedAt: new Date(),
        },
      });

      return NextResponse.json({
        player: updatedPlayer,
        message: 'Character updated successfully',
        isUpdate: true,
      });
    }

    // Create new player/character
    const newPlayer = await prisma.player.create({
      data: {
        campaignId,
        characterName: characterData.characterName,
        name: playerName || characterData.playerName || 'Unknown Player',
        characterRace: characterData.race,
        characterClass: characterData.class,
        level: characterData.level,
        imageUrl: characterData.imageUrl,
        backstory: characterData.backstory,
        dndBeyondUrl: url,
        lastSyncedAt: new Date(),
        characterData: characterData as any,
      },
    });

    return NextResponse.json({
      player: newPlayer,
      message: 'Character imported successfully',
      isUpdate: false,
    });
  } catch (error: any) {
    console.error('Error importing D&D Beyond character:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to import character from D&D Beyond',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
