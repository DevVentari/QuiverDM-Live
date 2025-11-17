'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Flex,
  Heading,
  Text,
  Button,
  TextField,
  Dialog,
  Box,
} from '@radix-ui/themes';
import { Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';

const TEMP_USER_ID = 'temp-user'; // TODO: Replace with actual auth

interface DndBeyondImportProps {
  campaignId: string;
  onImportComplete?: (playerId: string) => void;
}

export default function DndBeyondImport({ campaignId, onImportComplete }: DndBeyondImportProps) {
  const [url, setUrl] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [cobaltToken, setCobaltToken] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDialog, setShowDialog] = useState(false);

  // Fetch saved Cobalt cookie from user settings
  const { data: savedCobaltCookie } = trpc.userSettings.getDecryptedKey.useQuery(
    { userId: TEMP_USER_ID, keyName: 'dndBeyondCobaltCookie' },
    { enabled: showDialog } // Only fetch when dialog is open
  );

  // Pre-populate Cobalt token when dialog opens or when saved cookie is loaded
  useEffect(() => {
    if (showDialog && savedCobaltCookie) {
      setCobaltToken(savedCobaltCookie);
    }
  }, [showDialog, savedCobaltCookie]);

  const handleImport = async () => {
    if (!url.trim()) {
      setError('Please enter a D&D Beyond character URL');
      return;
    }

    setError('');
    setSuccess('');
    setIsImporting(true);

    try {
      const response = await fetch('/api/characters/import-dndbeyond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          campaignId,
          playerName: playerName.trim() || undefined,
          cobaltToken: cobaltToken.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import character');
      }

      setSuccess(data.message);
      setUrl('');
      setPlayerName('');
      setCobaltToken('');

      // Close dialog after a brief delay
      setTimeout(() => {
        setShowDialog(false);
        setSuccess('');
        if (onImportComplete && data.player) {
          onImportComplete(data.player.id);
        }
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to import character from D&D Beyond');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog.Root open={showDialog} onOpenChange={setShowDialog}>
      <Dialog.Trigger>
        <Button size="3">
          <Download size={20} />
          Import from D&D Beyond
        </Button>
      </Dialog.Trigger>

      <Dialog.Content style={{ maxWidth: 550 }}>
        <Dialog.Title>Import Character from D&D Beyond</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Import complete character data using your D&D Beyond Cobalt token for full access to spells, features, and equipment.
        </Dialog.Description>

        <Flex direction="column" gap="4">
          {/* D&D Beyond URL */}
          <Box>
            <Text size="2" weight="bold" mb="1" color="gray">
              D&D Beyond Character URL *
            </Text>
            <TextField.Root
              placeholder="https://www.dndbeyond.com/characters/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              size="3"
              disabled={isImporting}
            />
            <Text size="1" color="gray" style={{ marginTop: '4px' }}>
              Example: https://www.dndbeyond.com/characters/12345678
            </Text>
          </Box>

          {/* Cobalt Token (Recommended) */}
          <Box>
            <Flex justify="between" align="center" mb="1">
              <Text size="2" weight="bold" color="violet">
                Cobalt Token (Recommended for full data)
              </Text>
              {savedCobaltCookie && (
                <Text size="1" color="green">
                  ✓ Using saved token
                </Text>
              )}
            </Flex>
            <TextField.Root
              placeholder="Paste your CobaltSession cookie value here..."
              value={cobaltToken}
              onChange={(e) => setCobaltToken(e.target.value)}
              size="3"
              disabled={isImporting}
              type="password"
            />
            <Text size="1" color="gray" style={{ marginTop: '4px' }}>
              {savedCobaltCookie
                ? 'Your saved Cobalt cookie has been loaded automatically. You can override it here if needed.'
                : 'With a Cobalt token, we can import ALL character data (spells, feats, equipment). Without it, only basic info is available. Save it in Settings → API Keys to avoid re-entering.'}
            </Text>
          </Box>

          {/* Player Name (Optional) */}
          <Box>
            <Text size="2" weight="bold" mb="1" color="gray">
              Player Name (Optional)
            </Text>
            <TextField.Root
              placeholder="e.g., John Smith"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              size="3"
              disabled={isImporting}
            />
            <Text size="1" color="gray" style={{ marginTop: '4px' }}>
              If not provided, will use the name from D&D Beyond
            </Text>
          </Box>

          {/* Error Message */}
          {error && (
            <Card style={{ backgroundColor: 'var(--red-3)', borderColor: 'var(--red-7)' }}>
              <Flex align="center" gap="2">
                <AlertCircle size={20} className="text-red-500" />
                <Text size="2" color="red">{error}</Text>
              </Flex>
            </Card>
          )}

          {/* Success Message */}
          {success && (
            <Card style={{ backgroundColor: 'var(--green-3)', borderColor: 'var(--green-7)' }}>
              <Flex align="center" gap="2">
                <CheckCircle size={20} className="text-green-500" />
                <Text size="2" color="green">{success}</Text>
              </Flex>
            </Card>
          )}

          {/* Import Button */}
          <Flex gap="3" justify="end">
            <Dialog.Close>
              <Button variant="soft" color="gray" disabled={isImporting}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              onClick={handleImport}
              disabled={isImporting || !url.trim()}
            >
              {isImporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Import Character
                </>
              )}
            </Button>
          </Flex>

          {/* Help Text */}
          <Box style={{ borderTop: '1px solid var(--gray-6)', paddingTop: '12px' }}>
            <Text size="1" color="gray">
              <strong>How to get your Cobalt Token:</strong>
              <br />
              1. Log into D&D Beyond in your browser
              <br />
              2. Open Developer Tools (F12 or Right-click → Inspect)
              <br />
              3. Go to the &quot;Application&quot; (Chrome) or &quot;Storage&quot; (Firefox) tab
              <br />
              4. Under &quot;Cookies&quot; → &quot;https://www.dndbeyond.com&quot;
              <br />
              5. Find the &quot;CobaltSession&quot; cookie and copy its Value
              <br />
              6. Paste it in the &quot;Cobalt Token&quot; field above
              <br />
              <br />
              <strong style={{ color: 'var(--violet-11)' }}>
                ✨ With Cobalt token: Complete character data (spells, feats, equipment)
              </strong>
              <br />
              <strong>Without token: Basic info only (name, race, class, level)</strong>
            </Text>
          </Box>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
